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
        const { isStarred } = await chrome.storage.local.get(['isStarred']);
        
        const runGeneration = async () => {
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
        };

        if (!isStarred) {
          ui.showStarNudge(runGeneration);
        } else {
          runGeneration();
        }
      });
    }

    if (fixBtn && !fixBtn.getAttribute('data-events-bound')) {
      fixBtn.setAttribute('data-events-bound', 'true');
      fixBtn.addEventListener('click', async () => {
        const { isStarred } = await chrome.storage.local.get(['isStarred']);
        
        const runFix = async () => {
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
        };

        if (!isStarred) {
          ui.showStarNudge(runFix);
        } else {
          runFix();
        }
      });
    }
  }

  // --- Auto-Solve Automation ---
  const automation = {
    isRunning: false, // LOCK: prevents multiple instances

    async runAutoSolveStep() {
      // Prevent multiple simultaneous runs
      if (this.isRunning) {
        console.log('[Auto-Solve] Already running, skipping duplicate trigger.');
        return;
      }

      const { autoSolveActive, autoSolveCount } = await chrome.storage.local.get(['autoSolveActive', 'autoSolveCount']);
      if (!autoSolveActive) return;

      this.isRunning = true; // Acquire lock

      try {
        let count = (autoSolveCount || 0);

        ui.setStatus("🤖 Reading problem...");
        await delay(Math.random() * 5000 + 5000); 

        // 1. Initial Solve (with API rate-limit retry)
        let generated = false;
        for (let genRetry = 0; genRetry < 3 && !generated; genRetry++) {
          try {
            ui.setStatus("🧠 AI Generating Solution...");
            const generateBtn = document.getElementById('ai-assistant-generate');
            if (generateBtn) generateBtn.click();

            // Wait up to 45s for result - does NOT throw on timeout
            const ok = await waitForCondition(() => {
              const txt = ui.statusEl?.innerText || '';
              return txt.includes("successfully") || txt.includes("inserted") || txt.includes("Error") || txt.includes("error") || txt.includes("quota") || txt.includes("Rate");
            }, 45000);

            const statusText = ui.statusEl?.innerText || '';
            // Check if it was an error
            if (!ok || statusText.includes("Error") || statusText.includes("Rate limit") || statusText.includes("quota")) {
              ui.setStatus(`🛑 AI issue. Waiting 90s before retry (${genRetry + 1}/3)...`);
              await delay(90000);
              continue;
            }
            generated = true;
          } catch (e) {
            ui.setStatus(`🛑 Generation failed. Retrying (${genRetry + 1}/3)...`);
            await delay(30000);
          }
        }
        if (!generated) {
          ui.setStatus("❌ AI failed after 3 retries. Stopping.");
          ui.stopAutoSolve();
          return;
        }

        let fixAttempts = 2; 
        let stage1Pass = false;

        // --- STAGE 1: RUN UNTIL PERFECT ---
        while (fixAttempts >= 0 && !stage1Pass) {
          ui.setStatus(`🔍 Stage 1: Running Local Tests (${fixAttempts} fixes left)...`);
          await delay(3000);

          const runBtn = document.querySelector('[data-e2e-locator="console-run-button"]');
          if (runBtn) runBtn.click();

          // Wait for result panel to fully load
          ui.setStatus("⏳ Waiting for test result to load...");
          const result = await waitForTerminalResult(90000);
          
          if (result === 'RATE_LIMIT') {
             ui.setStatus("🛑 Rate limited! Waiting 60s...");
             await delay(60000); 
             continue;
          }

          // Extra settle time - let the panel fully render
          await delay(5000);

          const testPassed = domParser.isTestPassed();
          console.log('[Auto-Solve] Test passed?', testPassed);

          if (testPassed) {
            ui.setStatus("✅ Stage 1 Clear: All Tests Passed!");
            stage1Pass = true;
          } else {
            if (fixAttempts > 0) {
              ui.setStatus(`⚠️ Test Failed. Reading error details...`);
              await delay(4000); // Wait for error panel to fully load
              const fixBtn = document.getElementById('ai-assistant-fix');
              if (fixBtn) {
                fixBtn.click();
                await waitForCondition(() => {
                  const txt = ui.statusEl?.innerText || '';
                  return txt.includes("Fix applied") || txt.includes("successfully");
                }, 45000);
                fixAttempts--;
              }
            } else {
              break; 
            }
          }
        }

        // --- STAGE 2: FINAL SUBMIT ---
        let solved = false;
        if (stage1Pass) {
          ui.setStatus("🚀 Stage 2: Submitting Solution...");
          await delay(Math.random() * 5000 + 5000);

          const submitBtn = document.querySelector('[data-e2e-locator="console-submit-button"]');
          if (submitBtn) submitBtn.click();

          // Wait for submission result to fully load
          ui.setStatus("⏳ Waiting for submission verdict...");
          const subResult = await waitForTerminalResult(120000);
          
          if (subResult === 'RATE_LIMIT') {
             ui.setStatus("🛑 Rate limited! Waiting 70s...");
             await delay(70000);
          }

          // Extra settle time before reading final verdict
          await delay(4000);

          if (domParser.isSubmissionAccepted()) {
            ui.setStatus("🏆 Accepted! Saving progress...");
            await chrome.storage.local.set({ autoSolveCount: count + 1 });
            solved = true;
          } else {
            ui.setStatus("❌ Submission Failed. Stopping.");
            ui.stopAutoSolve();
            return;
          }
        }

        // --- STAGE 3: NEXT PROBLEM ---
        if (solved) {
          await delay(5000);
          ui.setStatus("🤖 Jumping to Next Question...");
          
          // Strategy 1: LeetCode's official next button (the '>' arrow near problem title)
          let nextBtn = document.querySelector('[data-e2e-locator="next-question-button"]');
          
          // Strategy 2: Find the '>' arrow button in the header area
          if (!nextBtn) {
            const arrows = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
            nextBtn = arrows.find(el => {
              const text = el.innerText?.trim();
              const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
              // Match '>', 'Next >', or 'Next' specifically to catch Quest/Quiz headers
              return (text === '>' || text === 'Next >' || text === 'Next' || text === '›' || text === '→' || ariaLabel.includes('next'));
            });
          }

          // Strategy 3: Find the forward chevron SVG button (LeetCode uses this)
          if (!nextBtn) {
            const svgBtns = document.querySelectorAll('button');
            for (const btn of svgBtns) {
              if (btn.querySelector('svg') && btn.offsetHeight > 0 && btn.offsetHeight < 40) {
                // Check if it's next to a problem title and is the SECOND arrow (forward)
                const prevSibling = btn.previousElementSibling;
                if (prevSibling && prevSibling.tagName === 'BUTTON') {
                  nextBtn = btn; // Second arrow = forward
                  break;
                }
              }
            }
          }
          
          if (nextBtn) {
            console.log('[Auto-Solve] Clicking next button:', nextBtn);
            nextBtn.click();
          } else {
            ui.setStatus("🏁 No next button found. Stopping.");
            ui.stopAutoSolve();
          }
        }

      } catch (err) {
        console.error("AutoSolve Err:", err);
        ui.setStatus(`❌ Error: ${err.message}`);
        ui.stopAutoSolve();
      } finally {
        this.isRunning = false; // Always release lock
      }
    }
  };

  // Export for UI access
  window.automation = automation;

  async function waitForTerminalResult(timeout = 60000) {
    let elapsed = 0;
    while (elapsed < timeout) {
      if (domParser.isRateLimited()) return 'RATE_LIMIT';
      if (domParser.isSubmissionFinished()) return 'FINISHED';
      await delay(2000);
      elapsed += 2000;
    }
    return 'TIMEOUT';
  }

  async function waitForCondition(conditionFn, timeout = 30000) {
    let elapsed = 0;
    while (elapsed < timeout) {
      try {
        if (conditionFn()) return true;
      } catch (e) {
        // Ignore errors in condition check (e.g., DOM not ready)
      }
      await delay(1000);
      elapsed += 1000;
    }
    return false; // Return false instead of throwing
  }

  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  // Initial load
  await init();
  
  // Do NOT auto-trigger. Only runs when user clicks START AUTO SOLVE.

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

  // SPA Navigation Watcher: Re-trigger auto-solve when URL changes
  let lastUrl = window.location.href;
  setInterval(async () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log("[Auto-Solve] SPA navigation detected:", currentUrl);
      
      // Wait for the new page to fully render
      await delay(6000);
      
      // Re-trigger auto-solve if still active AND not already running
      const { autoSolveActive } = await chrome.storage.local.get(['autoSolveActive']);
      if (autoSolveActive && !automation.isRunning) {
        console.log("[Auto-Solve] Re-triggering on new page...");
        automation.runAutoSolveStep();
      }
    }
  }, 3000);

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
