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

  async getKeys() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([
        'groqKey', 'groqModel',
        'openaiKey', 'openaiModel',
        'claudeKey', 'claudeModel',
        'geminiKey', 'geminiModel',
        'deepseekKey', 'deepseekModel',
        'openrouterKey', 'openrouterModel',
        'customUrl', 'customKey', 'customModel'
      ], (result) => {
        const config = (typeof window !== 'undefined' && window.ASK_CPT_CONFIG) ? window.ASK_CPT_CONFIG : {};
        resolve({
          groqKey: result.groqKey || config.GROQ_API_KEY || "",
          groqModel: result.groqModel || "llama-3.3-70b-versatile",
          openaiKey: result.openaiKey || config.OPENAI_API_KEY || "",
          openaiModel: result.openaiModel || "gpt-4o-mini",
          claudeKey: result.claudeKey || "",
          claudeModel: result.claudeModel || "claude-3-7-sonnet-latest",
          geminiKey: result.geminiKey || "",
          geminiModel: result.geminiModel || "gemini-2.5-flash",
          deepseekKey: result.deepseekKey || "",
          deepseekModel: result.deepseekModel || "deepseek-chat",
          openrouterKey: result.openrouterKey || config.OPENROUTER_API_KEY || "",
          openrouterModel: result.openrouterModel || "",
          customUrl: result.customUrl || "",
          customKey: result.customKey || "",
          customModel: result.customModel || ""
        });
      });
    });
  },

  async generateSolution(problemData, language = 'javascript') {
    const { title, description, examples, constraints } = problemData;

    const keys = await this.getKeys();
    const groqKey = keys.groqKey;
    const groqModel = keys.groqModel;
    const openaiKey = keys.openaiKey;
    const openaiModel = keys.openaiModel;
    const claudeKey = keys.claudeKey;
    const claudeModel = keys.claudeModel;
    const geminiKey = keys.geminiKey;
    const geminiModel = keys.geminiModel;
    const deepseekKey = keys.deepseekKey;
    const deepseekModel = keys.deepseekModel;
    const openrouterKey = keys.openrouterKey;
    const openrouterModel = keys.openrouterModel;
    const customUrl = keys.customUrl;
    const customKey = keys.customKey;
    const customModel = keys.customModel;

    if (!groqKey && !openaiKey && !claudeKey && !geminiKey && !deepseekKey && !customUrl && !openrouterKey) {
      this.updateStatus("❌ Click ⚙️ to add your API Keys");
      throw new Error("API Keys missing! Click ⚙️ Settings on the AI panel to add them.");
    }

    const prompt = `
Solve this coding problem: "${title}".

Description:
${description || ""}

Examples (Input and Output):
${examples || ""}

Constraints:
${constraints || ""}

CRITICAL INSTRUCTIONS:
1. You MUST deeply analyze the Examples (inputs/outputs) and Constraints before writing code.
2. Account for all edge cases and constraints to ensure it passes all hidden tests.
3. Write the optimal, fully functional solution in ${language}.
4. Return ONLY the raw runnable code. No markdown blocks (\`\`\`), no explanations, no conversational text.
`.trim();
    let errorLog = [];

    // 0. Try Custom Provider
    if (customUrl) {
      try {
        this.updateStatus("Trying Custom Provider...");
        const headers = { "Content-Type": "application/json" };
        if (customKey) headers["Authorization"] = `Bearer ${customKey}`;
        const res = await this.callBackgroundAI({
          url: customUrl,
          headers: headers,
          body: { model: customModel || "default", messages: [{ role: "user", content: prompt }], temperature: 0 }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (err) {
        if (this.isContextError(err)) throw err;
        errorLog.push(`Custom: ${err.message}`);
      }
    }

    // 1. Try Groq (Primary)
    if (groqKey) {
      try {
        this.updateStatus("Checking Groq Speed Brain...");
        const res = await this.callBackgroundAI({
          url: "https://api.groq.com/openai/v1/chat/completions",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
          body: { model: groqModel, messages: [{ role: "user", content: prompt }], temperature: 0 }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (err) {
        if (this.isContextError(err)) throw err;
        errorLog.push(`Groq: ${err.message}`);
      }
    }

    // 2. Try Claude
    if (claudeKey) {
      try {
        this.updateStatus("Trying Claude...");
        const res = await this.callBackgroundAI({
          url: "https://api.anthropic.com/v1/messages",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": claudeKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: { model: claudeModel, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }
        });
        if (res && res.content?.[0]?.text) return this.cleanCode(res.content[0].text);
      } catch (err) {
        if (this.isContextError(err)) throw err;
        errorLog.push(`Claude: ${err.message}`);
      }
    }

    // 3. Try Gemini
    if (geminiKey) {
      try {
        this.updateStatus("Trying Google Gemini...");
        const res = await this.callBackgroundAI({
          url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${geminiKey}` },
          body: { model: geminiModel, messages: [{ role: "user", content: prompt }] }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (err) {
        if (this.isContextError(err)) throw err;
        errorLog.push(`Gemini: ${err.message}`);
      }
    }

    // 4. Try DeepSeek
    if (deepseekKey) {
      try {
        this.updateStatus("Trying DeepSeek...");
        const res = await this.callBackgroundAI({
          url: "https://api.deepseek.com/chat/completions",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deepseekKey}` },
          body: { model: deepseekModel, messages: [{ role: "user", content: prompt }] }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (err) {
        if (this.isContextError(err)) throw err;
        errorLog.push(`DeepSeek: ${err.message}`);
      }
    }

    // 5. Try OpenAI (Backup)
    if (openaiKey) {
      try {
        this.updateStatus("Trying OpenAI...");
        const res = await this.callBackgroundAI({
          url: "https://api.openai.com/v1/chat/completions",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
          body: { model: openaiModel, messages: [{ role: "user", content: prompt }] }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (err) {
        if (this.isContextError(err)) throw err;
        errorLog.push(`OpenAI: ${err.message}`);
      }
    }

    // 6. Try OpenRouter Fallbacks
    if (openrouterKey) {
      const orModels = openrouterModel ? [openrouterModel, ...this.OPENROUTER_MODELS] : this.OPENROUTER_MODELS;
      for (const model of orModels) {
        try {
          this.updateStatus(`Trying OpenRouter ${model}...`);
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
    }

    throw new Error(`Connection Error: ${errorLog.slice(0, 2).join(" | ")}`);
  },

  async fixSolution(problemData, currentCode, errorText, language = 'javascript') {
    const { title, description, examples, constraints } = problemData;
    const prompt = `
You are an expert coder. 
The user's code for "${title}" has a bug or failed a hidden test case.

Description:
${description || ""}

Examples (Input and Output):
${examples || ""}

Constraints:
${constraints || ""}

Error Message / Failed Output:
${errorText || "The code produced the WRONG ANSWER for the hidden test cases. It is logically incorrect or missed an edge case."}

Current Code:
${currentCode}

CRITICAL INSTRUCTIONS:
1. The current code is BROKEN. Do NOT output the exact same code again.
2. Analyze the Error Message, Examples, and Constraints to find the logical flaw, edge case, or syntax error. Constraints often reveal hidden edge cases (like 0, negatives, large numbers).
3. Fix the bug and provide the fully corrected, optimal ${language} solution.
4. Output ONLY the raw code, nothing else. No markdown formatting (\`\`\`), no explanations, no text before or after the code.`;

    const keys = await this.getKeys();
    const groqKey = keys.groqKey;
    const groqModel = keys.groqModel;
    const openaiKey = keys.openaiKey;
    const openaiModel = keys.openaiModel;
    const claudeKey = keys.claudeKey;
    const claudeModel = keys.claudeModel;
    const geminiKey = keys.geminiKey;
    const geminiModel = keys.geminiModel;
    const deepseekKey = keys.deepseekKey;
    const deepseekModel = keys.deepseekModel;
    const customUrl = keys.customUrl;
    const customKey = keys.customKey;
    const customModel = keys.customModel;

    if (!groqKey && !openaiKey && !claudeKey && !geminiKey && !deepseekKey && !customUrl) {
      this.updateStatus("❌ Click ⚙️ to add your API Keys");
      throw new Error("API Keys missing! Click ⚙️ Settings on the AI panel to add them.");
    }

    // Try Custom Provider first for fix
    if (customUrl) {
      try {
        this.updateStatus("Fixing code with Custom Provider...");
        const headers = { "Content-Type": "application/json" };
        if (customKey) headers["Authorization"] = `Bearer ${customKey}`;
        const res = await this.callBackgroundAI({
          url: customUrl,
          headers: headers,
          body: { model: customModel || "default", messages: [{ role: "user", content: prompt }], temperature: 0.1 }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (e) {
        console.warn("Custom fix failed", e);
      }
    }

    // Try Groq first for fix
    if (groqKey) {
      try {
        this.updateStatus("Fixing code with Groq...");
        const res = await this.callBackgroundAI({
          url: "https://api.groq.com/openai/v1/chat/completions",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
          body: { model: groqModel, messages: [{ role: "user", content: prompt }], temperature: 0.1 }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (e) {
        console.warn("Groq fix failed", e);
      }
    }

    // Try Claude
    if (claudeKey) {
      try {
        this.updateStatus("Fixing code with Claude...");
        const res = await this.callBackgroundAI({
          url: "https://api.anthropic.com/v1/messages",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": claudeKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
          },
          body: { model: claudeModel, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }
        });
        if (res && res.content?.[0]?.text) return this.cleanCode(res.content[0].text);
      } catch (e) {
        console.warn("Claude fix failed", e);
      }
    }

    // Try Gemini
    if (geminiKey) {
      try {
        this.updateStatus("Fixing code with Gemini...");
        const res = await this.callBackgroundAI({
          url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${geminiKey}` },
          body: { model: geminiModel, messages: [{ role: "user", content: prompt }], temperature: 0.1 }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (e) {
        console.warn("Gemini fix failed", e);
      }
    }

    // Try DeepSeek
    if (deepseekKey) {
      try {
        this.updateStatus("Fixing code with DeepSeek...");
        const res = await this.callBackgroundAI({
          url: "https://api.deepseek.com/chat/completions",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${deepseekKey}` },
          body: { model: deepseekModel, messages: [{ role: "user", content: prompt }], temperature: 0.1 }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (e) {
        console.warn("DeepSeek fix failed", e);
      }
    }
    
    // Fallback to OpenAI if Groq fails
    if (openaiKey) {
      try {
        this.updateStatus("Fixing code with OpenAI...");
        const res = await this.callBackgroundAI({
          url: "https://api.openai.com/v1/chat/completions",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
          body: { model: openaiModel, messages: [{ role: "user", content: prompt }], temperature: 0.1 }
        });
        if (res && res.choices?.[0]?.message?.content) return this.cleanCode(res.choices[0].message.content);
      } catch (e) {
        throw new Error(`Failed to fix code: ${e.message}`);
      }
    }
    
    throw new Error(`Failed to fix code with available providers.`);
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
