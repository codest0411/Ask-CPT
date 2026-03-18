/**
 * editorWriter.js
 * Injected into the page to interact with Monaco Editor.
 */

(function () {
  function getActiveMonacoModel() {
    if (typeof monaco === 'undefined' || !monaco.editor) return null;

    // 1. Prioritize editors that the user is actively engaged with
    if (monaco.editor.getEditors) {
      const editors = monaco.editor.getEditors();
      if (editors && editors.length > 0) {
        // Ideally find the one that has text focus, else find the first one that is NOT readOnly
        const activeEditor = editors.find(e => e.hasTextFocus()) || editors.find(e => !e.getRawOptions().readOnly) || editors[0];
        if (activeEditor && activeEditor.getModel()) return activeEditor.getModel();
      }
    }

    // 2. Fallback to raw models list
    if (monaco.editor.getModels) {
      const models = monaco.editor.getModels();
      // Filter out non-code models like 'json' configs or output terminals if possible
      const validModels = models.filter(m => m.getLanguageId() !== 'json');
      if (validModels.length > 0) return validModels[validModels.length - 1]; // Often the latest created model is the actual editor
    }

    return null;
  }

  /**
   * Main function to write code to the editor.
   * @param {string} code - Solution code.
   * @param {boolean} typingAnimation - Whether to use typing animation.
   */
  function writeToEditor(code, typingAnimation = false) {
    // 1. Try smart active Monaco Editor
    const activeModel = getActiveMonacoModel();
    if (activeModel) {
      if (typingAnimation) {
        typeInMonaco(activeModel, code);
      } else {
        activeModel.setValue(code);
      }
      return true;
    }

    // 2. Try Ace Editor (HackerRank, etc.)
    const aceEl = document.querySelector('.ace_editor');
    if (aceEl && aceEl.env && aceEl.env.editor) {
      aceEl.env.editor.setValue(code);
      return true;
    }

    // 3. Try CodeMirror Editor (Codeforces, etc.)
    const cmEl = document.querySelector('.CodeMirror');
    if (cmEl && cmEl.CodeMirror) {
      cmEl.CodeMirror.setValue(code);
      return true;
    }

    // 4. Try Generic Editor (Textarea)
    const activeTextarea = document.querySelector('textarea:focus-within') ||
      document.querySelector('.monaco-editor textarea') ||
      document.querySelector('textarea');

    if (activeTextarea) {
      if (typingAnimation) {
        typeInTextarea(activeTextarea, code);
      } else {
        activeTextarea.value = code;
        activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
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
