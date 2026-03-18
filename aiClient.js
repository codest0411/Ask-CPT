/**
 * aiClient.js
 * ULTRA-ROBUST MODE: Refined error handling for "Context Invalidated".
 */

const aiClient = {
  // Best available free models
  OPENROUTER_MODELS: [
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemma-2-9b-it:free",
    "qwen/qwen-2.5-7b-instruct:free",
    "mistralai/mistral-7b-instruct:free"
  ],

  async generateSolution(problemData, language = 'javascript') {
    const { title, description, examples, constraints } = problemData;
    
    const config = window.ASK_CPT_CONFIG || {};
    const groqKey = config.GROQ_API_KEY || "";
    const openaiKey = config.OPENAI_API_KEY || "";
    const openrouterKey = config.OPENROUTER_API_KEY || "";

    if (!groqKey && !openaiKey) {
      throw new Error("API Keys missing! Please set them up in config.js");
    }

    const prompt = `Solve LeetCode: "${title}". ${description}. Language: ${language}. Raw code ONLY.`;

    let errorLog = [];

    // 1. Try Groq (Primary) - Using Updated Llama 3.3
    try {
      this.updateStatus("Checking Groq Speed Brain...");
      const res = await this.callBackgroundAI({
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
        body: { model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0 }
      });
      if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
    } catch (err) { 
        if (this.isContextError(err)) throw err;
        errorLog.push(`Groq: ${err.message}`); 
    }

    // 2. Try OpenAI (Backup)
    try {
      this.updateStatus("Trying OpenAI...");
      const res = await this.callBackgroundAI({
        url: "https://api.openai.com/v1/chat/completions",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
        body: { model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }] }
      });
      if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
    } catch (err) { 
        if (this.isContextError(err)) throw err;
        errorLog.push(`OpenAI: ${err.message}`); 
    }

    // 3. Try OpenRouter Fallbacks
    for (const model of this.OPENROUTER_MODELS) {
      try {
        this.updateStatus(`Trying Fallback AI ${this.OPENROUTER_MODELS.indexOf(model)+1}/4...`);
        const res = await this.callBackgroundAI({
          url: "https://openrouter.ai/api/v1/chat/completions",
          headers: { 
            "Content-Type": "application/json", 
            "Authorization": `Bearer ${openrouterKey}`,
            "HTTP-Referer": "https://leetcode.com",
            "X-Title": "AI Assistant"
          },
          body: { model: model, messages: [{ role: "user", content: prompt }] }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (err) { 
          if (this.isContextError(err)) throw err;
          errorLog.push(`${model}: ${err.message}`); 
      }
    }

    throw new Error(`Connection Error: ${errorLog.slice(0, 2).join(" | ")}`);
  },

  async fixSolution(problemData, currentCode, errorText, language = 'javascript') {
    const { title, description } = problemData;
    const prompt = `
You are an expert coder. 
The user's code for "${title}" has a bug or failed a test case.

Error Message/Output:
${errorText || "The code produced the WRONG ANSWER for the hidden test cases. It is logically incorrect."}

Current Code:
${currentCode}

CRITICAL INSTRUCTIONS:
1. The current code is BROKEN. Do NOT output the exact same code again.
2. Analyze the Error Message (if any) or the problem description to find the logical flaw, edge case, or syntax error.
3. Fix the bug and provide the fully corrected ${language} solution.
4. Output ONLY the raw code, nothing else. No markdown formatting (\`\`\`), no explanations.`;

    const config = window.ASK_CPT_CONFIG || {};
    const groqKey = config.GROQ_API_KEY || "";
    const openaiKey = config.OPENAI_API_KEY || "";

    // Try Groq first for fix
    try {
      this.updateStatus("Fixing code with Groq...");
      const res = await this.callBackgroundAI({
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
        body: { model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.1 }
      });
      if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
    } catch (e) {
      console.warn("Groq fix failed", e);
    }
    
    // Fallback to OpenAI if Groq fails
    try {
      this.updateStatus("Fixing code with OpenAI...");
      const res = await this.callBackgroundAI({
        url: "https://api.openai.com/v1/chat/completions",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
        body: { model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.1 }
      });
      if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
    } catch (e) {
      throw new Error(`Failed to fix code: ${e.message}`);
    }
  },

  isContextError(err) {
    if (err.message.includes("context invalidated")) {
      throw new Error("⚠️ Please REFRESH LeetCode to apply assistant updates.");
    }
    return false;
  },

  updateStatus(msg) {
    if (window.ui) window.ui.setStatus(msg, null);
  },

  async callBackgroundAI(payload) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: 'AI_ASSISTANT_FETCH', payload }, response => {
          if (chrome.runtime.lastError) {
             const msg = chrome.runtime.lastError.message;
             if (msg.includes("context invalidated")) {
                reject(new Error("context invalidated"));
             } else {
                reject(new Error("Connection to background failed. Reload extension."));
             }
          } else if (response && response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response?.error || "Unknown Error"));
          }
        });
      } catch (e) {
        if (e.message.includes("context invalidated")) {
           reject(new Error("context invalidated"));
        } else {
           reject(e);
        }
      }
    });
  },

  cleanCode(rawCode) {
    // If the AI used markdown code blocks, extract ONLY what's inside the block
    const blockRegex = /```[a-zA-Z]*\n([\s\S]*?)```/;
    const match = rawCode.match(blockRegex);
    if (match && match[1]) {
       return match[1].trim();
    }
    // Otherwise fallback to stripping any stray backticks just in case
    return rawCode.replace(/```[a-zA-Z]*\n?|```/g, "").trim();
  }
};

window.aiClient = aiClient;
window.ui = typeof ui !== 'undefined' ? ui : null;
