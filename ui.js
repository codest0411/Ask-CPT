/**
 * ui.js
 * Builds the floating UI panel for the extension.
 * Now with DRAGGABLE support!
 */

const ui = {
  panel: null,
  statusEl: null,
  loader: null,
  generateBtn: null,
  isDragging: false,
  currentX: 0,
  currentY: 0,
  initialX: 0,
  initialY: 0,
  xOffset: 0,
  yOffset: 0,

  async build() {
    if (this.panel) {
      if (!document.body.contains(this.panel)) {
        document.body.appendChild(this.panel);
      }
      this.panel.style.zIndex = '2147483647'; // Keep it absolutely on top
      return;
    }

    this.panel = document.createElement('div');
    this.panel.id = 'ai-coding-assistant-panel';
    this.panel.style.zIndex = '2147483647'; // Maximum z-index

    // Header (The handle for dragging)
    const header = document.createElement('div');
    header.className = 'header';
    header.style.cursor = 'move'; // Show it's draggable
    header.innerHTML = `<h3 style="display:inline-block; margin:0;">Ask CPT</h3>
      <div style="float:right; margin-top:2px;">
        <span style="cursor:pointer;font-size:14px;opacity:0.8;margin-right:12px" id="ai-assistant-settings" title="Settings">⚙️</span>
        <span style="cursor:pointer;font-size:14px;opacity:0.8;font-weight:bold;" id="ai-assistant-minimize" title="Minimize">_</span>
      </div>`;
    this.panel.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.className = 'content';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    this.generateBtn = document.createElement('button');
    this.generateBtn.id = 'ai-assistant-generate';
    this.generateBtn.innerHTML = `<span class="loader" id="ai-assistant-loader"></span> Generate Solution`;

    this.fixBtn = document.createElement('button');
    this.fixBtn.id = 'ai-assistant-fix';
    this.fixBtn.style.background = '#ff4b4b'; // Red color for Fix
    this.fixBtn.style.marginTop = '8px';
    this.fixBtn.style.display = 'inline-block'; // Always visible for easy fixing
    this.fixBtn.innerHTML = `<span class="loader" id="ai-assistant-fix-loader"></span> Fix Errors`;

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'status';
    this.statusEl.id = 'ai-assistant-status';

    this.autoSolveBtn = document.createElement('button');
    this.autoSolveBtn.id = 'ai-auto-solve-toggle';
    this.autoSolveBtn.style.background = '#22c55e'; // Green
    this.autoSolveBtn.style.marginTop = '12px';
    this.autoSolveBtn.innerText = "START AUTO SOLVE";
    this.autoSolveBtn.title = "Solve current and auto-jump to next";

    buttonContainer.appendChild(this.generateBtn);
    buttonContainer.appendChild(this.fixBtn);
    buttonContainer.appendChild(this.autoSolveBtn); // Added simple toggle
    buttonContainer.appendChild(this.statusEl);
    content.appendChild(buttonContainer);

    // AI Info (Ultra-Fast Mode)
    const info = document.createElement('div');
    info.className = 'settings';
    info.innerHTML = `
      <div style="background: #2d2d2d; border-radius: 4px; padding: 10px; margin-top: 10px; font-size: 11px; opacity: 0.8; line-height: 1.4;">
        ⚡ <b>ULTRA-FAST MODE ENABLED</b><br>
        Brain: Groq (Llama 3.3 70B)<br>
        Status: 🚀 Drag to Move
      </div>
    `;

    content.appendChild(info);
    this.panel.appendChild(content);

    document.body.appendChild(this.panel);

    this.loader = this.panel.querySelector('#ai-assistant-loader');
    this.fixLoader = this.panel.querySelector('#ai-assistant-fix-loader'); // Added fixLoader initialization

    // --- Drag Logic ---
    header.addEventListener('mousedown', (e) => this.dragStart(e));
    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('mouseup', (e) => this.dragEnd(e));

    // Attach events
    this.panel.querySelector('#ai-assistant-settings').addEventListener('click', () => {
      try { chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' }); } catch(e) {}
    });

    this.panel.querySelector('#ai-assistant-minimize').addEventListener('click', () => {
      const content = this.panel.querySelector('.content');
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
      try { chrome.storage.sync.set({ isMinimized: content.style.display === 'none' }); } catch(e) {}
    });

    this.autoSolveBtn.addEventListener('click', async () => {
      try {
        const data = await chrome.storage.local.get(['autoSolveActive']);
        if (data.autoSolveActive) {
          this.stopAutoSolve();
        } else {
          this.startAutoSolve();
        }
      } catch(e) {
        console.warn('Extension context lost. Please refresh the page.');
      }
    });

    // Initial state count update
    this.updateQueueCount();

    // Handle initial minimized state and position

    // Handle initial minimized state and position
    const { isMinimized, positionX, positionY } = await chrome.storage.sync.get(['isMinimized', 'positionX', 'positionY']);
    if (isMinimized) {
      content.style.display = 'none';
    }
    
    // Restore saved position
    if (positionX !== undefined && positionY !== undefined) {
      this.currentX = positionX;
      this.currentY = positionY;
      this.xOffset = positionX;
      this.yOffset = positionY;
      this.panel.style.transform = `translate3d(${positionX}px, ${positionY}px, 0)`;
    }

    // Listen for storage changes to sync UI
    try {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.autoSolveActive) {
          this.updateQueueCount();
        }
      });
    } catch(e) {}
  },

  dragStart(e) {
    if (e.target.closest('.header') && e.target.id !== 'ai-assistant-settings' && e.target.id !== 'ai-assistant-minimize') {
      this.isDragging = true;
      e.preventDefault(); // Prevent background text selection while dragging
      this.initialX = e.clientX - this.xOffset;
      this.initialY = e.clientY - this.yOffset;
    }
  },

  drag(e) {
    if (this.isDragging) {
      e.preventDefault();
      this.currentX = e.clientX - this.initialX;
      this.currentY = e.clientY - this.initialY;
      this.xOffset = this.currentX;
      this.yOffset = this.currentY;
      this.panel.style.transform = `translate3d(${this.currentX}px, ${this.currentY}px, 0)`;
    }
  },

  dragEnd(e) {
    if (this.isDragging) {
      this.initialX = this.currentX;
      this.initialY = this.currentY;
      this.isDragging = false;
      try { chrome.storage.sync.set({ positionX: this.currentX, positionY: this.currentY }); } catch(e) {}
    }
  },

  setLoading(isLoading) {
    if (isLoading) {
      this.generateBtn.disabled = true;
      this.loader.style.display = 'inline-block';
      this.statusEl.innerText = "Processing...";
    } else {
      this.generateBtn.disabled = false;
      this.loader.style.display = 'none';
    }
  },

  setFixLoading(isLoading) {
    if (!this.fixBtn) return;
    if (isLoading) {
      this.fixBtn.disabled = true;
      if (this.fixLoader) this.fixLoader.style.display = 'inline-block';
      this.statusEl.innerText = "Fixing code...";
    } else {
      this.fixBtn.disabled = false;
      if (this.fixLoader) this.fixLoader.style.display = 'none';
    }
  },

  setStatus(text, timeout = 3000) {
    if (!this.statusEl) return;
    this.statusEl.innerText = text;
    if (timeout) {
      setTimeout(() => {
        if (this.statusEl && this.statusEl.innerText === text) {
          this.statusEl.innerText = "";
        }
      }, timeout);
    }
  },

  async updateQueueCount() {
    try {
      const { autoSolveActive = false } = await chrome.storage.local.get(['autoSolveActive']);
      if (this.autoSolveBtn) {
        if (autoSolveActive) {
          this.autoSolveBtn.innerText = "STOP AUTO MODE";
          this.autoSolveBtn.style.background = "#ff4b4b";
        } else {
          this.autoSolveBtn.innerText = "START AUTO SOLVE";
          this.autoSolveBtn.style.background = "#22c55e";
        }
      }
    } catch(e) {}
  },

  async startAutoSolve() {
    try {
      await chrome.storage.local.set({ autoSolveActive: true });
      this.updateQueueCount();
      this.setStatus("🚀 Starting Auto Mode...");
      
      if (window.automation && typeof window.automation.runAutoSolveStep === 'function') {
        window.automation.runAutoSolveStep();
      }
    } catch(e) {
      this.setStatus("❌ Extension error. Refresh page.");
    }
  },

  async stopAutoSolve() {
    try {
      await chrome.storage.local.set({ autoSolveActive: false });
      this.updateQueueCount();
      this.setStatus("🛑 Auto Mode Stopped");
    } catch(e) {}
  }
};

window.ui = ui;
