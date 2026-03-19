/**
 * editorWriter.js
 * Injected into the page to interact with Monaco Editor.
 */

(function () {
  function getActiveMonacoModel() {
    if (typeof monaco === 'undefined' || !monaco.editor) {
      // If monaco global is missing, try to find it via a common internal LeetCode variable
      if (window._monaco) window.monaco = window._monaco;
      if (typeof monaco === 'undefined' || !monaco.editor) return null;
    }

    try {
      // 1. Prioritize editors that the user is actively engaged with
      if (monaco.editor.getEditors) {
        const editors = monaco.editor.getEditors();
        if (editors && editors.length > 0) {
          // Find the one that has text focus, else find the first one that is NOT readOnly
          const activeEditor = editors.find(e => e.hasTextFocus()) || editors.find(e => !e.getRawOptions().readOnly) || editors[0];
          if (activeEditor && activeEditor.getModel()) return activeEditor.getModel();
        }
      }

      // 2. Fallback to raw models list
      if (monaco.editor.getModels) {
        const models = monaco.editor.getModels();
        // Filter out non-code models like 'json' configs or output terminals
        // On Quests, the model might not have a languageId right away, so we look for models with content
        const validModels = models.filter(m => {
          const lang = m.getLanguageId();
          return lang !== 'json' && lang !== 'plaintext' && !m.uri.path.includes('output');
        });
        
        if (validModels.length > 0) {
           // Return the one that looks most like code (contains class or function or public)
           const bestModel = validModels.find(m => {
             const val = m.getValue();
             return val.includes('class ') || val.includes('public ') || val.includes('def ') || val.includes('function');
           });
           return bestModel || validModels[validModels.length - 1];
        }
        
        if (models.length > 0) return models[models.length - 1];
      }
    } catch (e) {
      console.error("Monaco search error:", e);
    }

    return null;
  }

  /**
   * Main function to write code to the editor.
   * @param {string} code - Solution code.
   * @param {boolean} typingAnimation - Whether to use typing animation.
   */
  function findInShadows(selector, root = document) {
    const el = root.querySelector(selector);
    if (el) return el;
    
    // Scan all elements for shadow roots
    const allElements = root.querySelectorAll('*');
    for (const item of allElements) {
      if (item.shadowRoot) {
        const found = findInShadows(selector, item.shadowRoot);
        if (found) return found;
      }
    }
    return null;
  }

  function writeToEditor(code, typingAnimation = false) {
    // Stage 1: Try deep Monaco API Access (Smartest)
    const activeModel = getActiveMonacoModel();
    if (activeModel) {
      if (typingAnimation) {
        typeInMonaco(activeModel, code);
      } else {
        const model = activeModel;
        model.pushStackElement(); 
        model.pushEditOperations(
          [],
          [{
            range: model.getFullModelRange(),
            text: code,
            forceMoveMarkers: true
          }],
          () => null
        );
        model.pushStackElement(); 
        
        // Finalize by clicking the editor to ensure sync
        const container = document.querySelector('.monaco-editor');
        if (container) container.click();
      }
      return true;
    }

    // Stage 2: Deep Shadow DOM Fallback (For Quest/Quiz)
    // We look for any container that looks like monaco or ace in shadow roots
    const selectors = [
      '.monaco-editor textarea.textarea-input',
      '.monaco-editor textarea',
      '.ace_text-input',
      '.CodeMirror textarea',
      'textarea[class*="editor"]',
      'textarea'
    ];

    let editorTextarea = null;
    for (const sel of selectors) {
      editorTextarea = findInShadows(sel);
      if (editorTextarea && editorTextarea.offsetHeight > 0) break;
    }

    if (editorTextarea) {
      console.log("[Auto-Solve] Editor found in Deep Scan:", editorTextarea);
      if (typingAnimation) {
        typeInTextarea(editorTextarea, code);
      } else {
        editorTextarea.focus();
        editorTextarea.value = code;
        
        const events = ['input', 'change', 'keydown', 'keypress', 'keyup', 'blur'];
        events.forEach(evtType => {
           editorTextarea.dispatchEvent(new Event(evtType, { bubbles: true }));
        });
        
        // If it's monaco, trigger the native focus
        const parent = editorTextarea.closest('.monaco-editor');
        if (parent) parent.click();
      }
      return true;
    }

    return false;
  }

  function typeInMonaco(model, code) {
    // Clear the editor first
    model.setValue("");

    let i = 0;
    const interval = setInterval(() => {
      if (i >= code.length) {
        clearInterval(interval);
        return;
      }
      const chunk = code.slice(i, i + 5);
      const lineCount = model.getLineCount();
      const lastLineColumn = model.getLineMaxColumn(lineCount);

      model.applyEdits([{
        range: {
          startLineNumber: lineCount,
          startColumn: lastLineColumn,
          endLineNumber: lineCount,
          endColumn: lastLineColumn
        },
        text: chunk,
        forceMoveMarkers: true
      }]);
      i += chunk.length;
    }, 50);
  }

  function typeInTextarea(textarea, code) {
    textarea.value = "";
    let i = 0;
    const interval = setInterval(() => {
      if (i >= code.length) {
        clearInterval(interval);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      textarea.value += code[i];
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      i++;
    }, 10);
  }

  // Listen for messages from content.js
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'AI_ASSISTANT_WRITE_CODE') {
      const { code, typingAnimation } = event.data;
      const success = writeToEditor(code, typingAnimation);
      window.postMessage({ type: 'AI_ASSISTANT_WRITE_STATUS', success, text: code }, '*');
    }

    if (event.data.type === 'AI_ASSISTANT_READ_CODE') {
      let currentCode = "";
      const activeModel = getActiveMonacoModel();
      if (activeModel) {
        currentCode = activeModel.getValue();
      } else {
        const ta = document.querySelector('textarea');
        if (ta) currentCode = ta.value;
      }
      window.postMessage({ type: 'AI_ASSISTANT_READ_CODE_RESPONSE', code: currentCode }, '*');
    }

    if (event.data.type === 'AI_ASSISTANT_GET_EDITOR_INFO') {
      let lang = null;
      let currentCode = "";
      const activeModel = getActiveMonacoModel();
      if (activeModel) {
        lang = activeModel.getLanguageId();
        currentCode = activeModel.getValue();
      }
      window.postMessage({ type: 'AI_ASSISTANT_EDITOR_INFO_RESPONSE', lang, code: currentCode }, '*');
    }
  });

  console.log("AI Coding Assistant Editor Injector Ready.");
})();
