/**
 * content.js
 * Main entry point for the extension.
 */

(async function() {
  console.log("AI Coding Assistant Loaded.");

  // 1. Inject the editor injector into the page context to access Monaco
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('editorWriter.js');
  s.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(s);

  // 2. Initialize UI
  async function init() {
    if (typeof ui !== 'undefined') {
      await ui.build();
      setupEvents();
    }
  }

  async function getEditorInfo() {
    return new Promise((resolve) => {
      let resolved = false;
      const listener = (event) => {
        if (event.data && event.data.type === 'AI_ASSISTANT_EDITOR_INFO_RESPONSE') {
          resolved = true;
          window.removeEventListener('message', listener);
          resolve({ lang: event.data.lang, code: event.data.code });
        }
      };
      window.addEventListener('message', listener);
      window.postMessage({ type: 'AI_ASSISTANT_GET_EDITOR_INFO' }, '*');
      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener('message', listener);
          resolve({ lang: null, code: "" });
        }
      }, 500);
    });
  }

  function setupEvents() {
    const generateBtn = document.getElementById('ai-assistant-generate');
    const fixBtn = document.getElementById('ai-assistant-fix');
    
    if (generateBtn && !generateBtn.getAttribute('data-events-bound')) {
      generateBtn.setAttribute('data-events-bound', 'true');
      generateBtn.addEventListener('click', async () => {
        try {
          ui.setLoading(true);
          const problemData = domParser.extractProblemData();
          if (!problemData.title || !problemData.description) {
            throw new Error("Could not detect problem details. Refresh or open a problem page.");
          }

          const editorContext = await getEditorInfo();
          let language = editorContext.lang || detectLanguage();
          if (language === 'python3') language = 'python';

          ui.setStatus(`Generating ${language} solution...`, null);
          const code = await aiClient.generateSolution(problemData, language);

          ui.setStatus("Writing solution...", null);
          window.postMessage({ type: 'AI_ASSISTANT_WRITE_CODE', code: code }, '*');

          const onStatus = (event) => {
            if (event.data && event.data.type === 'AI_ASSISTANT_WRITE_STATUS') {
              if (event.data.success) {
                ui.setStatus("Solution inserted successfully!", 3000);
              } else {
                ui.setStatus("Failed to find editor.", 5000);
              }
              ui.setLoading(false);
              window.removeEventListener('message', onStatus);
            }
          };
          window.addEventListener('message', onStatus);

        } catch (error) {
          ui.setStatus(`Error: ${error.message}`, 10000);
          ui.setLoading(false);
        }
      });
    }

    if (fixBtn && !fixBtn.getAttribute('data-events-bound')) {
      fixBtn.setAttribute('data-events-bound', 'true');
      fixBtn.addEventListener('click', async () => {
        try {
          ui.setFixLoading(true);
          const problemData = domParser.extractProblemData();
          let errorText = domParser.extractErrorText();
          
          if (!errorText || errorText.length < 10) {
             // Ultimate backup: grab the end of the page where the console usually is
             errorText = "Raw Page Console Dump:\n" + document.body.innerText.slice(-3000);
          }

          const editorContext = await getEditorInfo();
          let language = editorContext.lang || detectLanguage();
          if (language === 'python3') language = 'python';
          
          const currentCode = editorContext.code;

          if (!currentCode) throw new Error("Could not read code. Ensure editor is active.");

          const fixedCode = await aiClient.fixSolution(problemData, currentCode, errorText, language);
          ui.setStatus("Applying fix...", null);
          window.postMessage({ type: 'AI_ASSISTANT_WRITE_CODE', code: fixedCode }, '*');
          
          const onStatus = (event) => {
            if (event.data && event.data.type === 'AI_ASSISTANT_WRITE_STATUS') {
              if (event.data.success) {
                ui.setStatus("Fix applied successfully!", 3000);
              } else {
                ui.setStatus("Failed to write to editor.", 5000);
              }
              ui.setFixLoading(false);
              window.removeEventListener('message', onStatus);
            }
          };
          window.addEventListener('message', onStatus);
          
        } catch (e) {
          ui.setStatus(`Fix fail: ${e.message}`, 5000);
          ui.setFixLoading(false);
        }
      });
    }
  }

  // Error watching removed, Fix Errors button is always visible for manual triggering.

  // Initial load
  await init();

  // Watch for page changes and keep UI forcefully attached
  setInterval(() => {
    // Show UI on absolutely every page of LeetCode
    const isTargetPage = true; 
    
    if (isTargetPage) {
      if (typeof ui !== 'undefined' && ui.panel) {
        if (!document.body.contains(ui.panel)) {
           document.body.appendChild(ui.panel); // Re-attach!
        }
        ui.panel.style.zIndex = '2147483647'; // Force on top
      } else {
        init(); // Boot it up if it didn't
      }
    }
  }, 2000);

  /**
   * Helper to detect current programming language.
   */
  function detectLanguage() {
    // LeetCode: data-cy="lang-select", [id^="headlessui-listbox-button"]
    // HackerRank: .language-selector
    const selectors = [
      '[data-cy="lang-select"]',
      'button[id^="headlessui-listbox-button"]', 
      '.language-selector',
      '.select-button span',
      '.monaco-editor-language'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText.trim()) {
        const text = el.innerText.toLowerCase();
        if (text.includes('python')) return 'python';
        if (text.includes('java')) return 'java';
        if (text.includes('javascript') || text.includes('js')) return 'javascript';
        if (text.includes('cpp') || text.includes('c++')) return 'cpp';
        if (text.includes('c#') || text.includes('csharp')) return 'csharp';
        if (text.includes('go')) return 'go';
        if (text.includes('rust')) return 'rust';
        if (text.includes('typescript') || text.includes('ts')) return 'typescript';
      }
    }
    return 'javascript'; // Default
  }

})();
