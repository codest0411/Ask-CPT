document.addEventListener('DOMContentLoaded', () => {
  // Load saved keys from storage on mount
  chrome.storage.sync.get(['groqKey', 'openaiKey', 'openrouterKey'], (result) => {
    if (result.groqKey) document.getElementById('groqKey').value = result.groqKey;
    if (result.openaiKey) document.getElementById('openaiKey').value = result.openaiKey;
    if (result.openrouterKey) document.getElementById('openrouterKey').value = result.openrouterKey;
  });

  // Save keys natively into Chrome Sync Storage encrypted
  document.getElementById('saveBtn').addEventListener('click', () => {
    const groqKey = document.getElementById('groqKey').value.trim();
    const openaiKey = document.getElementById('openaiKey').value.trim();
    const openrouterKey = document.getElementById('openrouterKey').value.trim();

    chrome.storage.sync.set({ groqKey, openaiKey, openrouterKey }, () => {
      const status = document.getElementById('status');
      status.textContent = 'Settings securely saved! ✅ You can close this tab and return to code.';
      
      // Auto-clear message
      setTimeout(() => {
        status.textContent = '';
      }, 5000);
    });
  });
});
