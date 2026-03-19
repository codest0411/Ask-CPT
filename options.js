document.addEventListener('DOMContentLoaded', () => {
  // Load saved keys from storage on mount
  chrome.storage.sync.get([
    'groqKey', 'groqModel',
    'openaiKey', 'openaiModel',
    'claudeKey', 'claudeModel',
    'geminiKey', 'geminiModel',
    'deepseekKey', 'deepseekModel',
    'openrouterKey', 'openrouterModel',
    'customUrl', 'customKey', 'customModel'
  ], (result) => {
    if (result.groqKey) document.getElementById('groqKey').value = result.groqKey;
    if (result.groqModel) document.getElementById('groqModel').value = result.groqModel;
    if (result.openaiKey) document.getElementById('openaiKey').value = result.openaiKey;
    if (result.openaiModel) document.getElementById('openaiModel').value = result.openaiModel;
    if (result.claudeKey) document.getElementById('claudeKey').value = result.claudeKey;
    if (result.claudeModel) document.getElementById('claudeModel').value = result.claudeModel;
    if (result.geminiKey) document.getElementById('geminiKey').value = result.geminiKey;
    if (result.geminiModel) document.getElementById('geminiModel').value = result.geminiModel;
    if (result.deepseekKey) document.getElementById('deepseekKey').value = result.deepseekKey;
    if (result.deepseekModel) document.getElementById('deepseekModel').value = result.deepseekModel;
    if (result.openrouterKey) document.getElementById('openrouterKey').value = result.openrouterKey;
    if (result.openrouterModel) document.getElementById('openrouterModel').value = result.openrouterModel;
    if (result.customUrl) document.getElementById('customUrl').value = result.customUrl;
    if (result.customKey) document.getElementById('customKey').value = result.customKey;
    if (result.customModel) document.getElementById('customModel').value = result.customModel;
  });

  // Save keys natively into Chrome Sync Storage encrypted
  document.getElementById('saveBtn').addEventListener('click', () => {
    const groqKey = document.getElementById('groqKey').value.trim();
    const groqModel = document.getElementById('groqModel').value.trim();
    const openaiKey = document.getElementById('openaiKey').value.trim();
    const openaiModel = document.getElementById('openaiModel').value.trim();
    const claudeKey = document.getElementById('claudeKey').value.trim();
    const claudeModel = document.getElementById('claudeModel').value.trim();
    const geminiKey = document.getElementById('geminiKey').value.trim();
    const geminiModel = document.getElementById('geminiModel').value.trim();
    const deepseekKey = document.getElementById('deepseekKey').value.trim();
    const deepseekModel = document.getElementById('deepseekModel').value.trim();
    const openrouterKey = document.getElementById('openrouterKey').value.trim();
    const openrouterModel = document.getElementById('openrouterModel').value.trim();
    const customUrl = document.getElementById('customUrl').value.trim();
    const customKey = document.getElementById('customKey').value.trim();
    const customModel = document.getElementById('customModel').value.trim();

    chrome.storage.sync.set({
      groqKey, groqModel,
      openaiKey, openaiModel,
      claudeKey, claudeModel,
      geminiKey, geminiModel,
      deepseekKey, deepseekModel,
      openrouterKey, openrouterModel,
      customUrl, customKey, customModel
    }, () => {
      const status = document.getElementById('status');
      status.textContent = 'Settings securely saved! ✅ You can close this tab and return to code.';
      
      // Auto-clear message
      setTimeout(() => {
        status.textContent = '';
      }, 5000);
    });
  });
});
