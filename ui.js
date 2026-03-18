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
    header.innerHTML = `<h3>AI Coding Assistant</h3><span style="cursor:pointer;font-size:12px;opacity:0.6" id="ai-assistant-minimize">_</span>`;
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

    buttonContainer.appendChild(this.generateBtn);
    buttonContainer.appendChild(this.fixBtn);
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
    this.panel.querySelector('#ai-assistant-minimize').addEventListener('click', () => {
      const content = this.panel.querySelector('.content');
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
      chrome.storage.sync.set({ isMinimized: content.style.display === 'none' });
    });

    // Handle initial minimized state
    const { isMinimized } = await chrome.storage.sync.get('isMinimized');
    if (isMinimized) {
      content.style.display = 'none';
    }
  },

  dragStart(e) {
    this.initialX = e.clientX - this.xOffset;
    this.initialY = e.clientY - this.yOffset;
    if (e.target.closest('.header')) {
      this.isDragging = true;
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
    this.initialX = this.currentX;
    this.initialY = this.currentY;
    this.isDragging = false;
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
  }
};

window.ui = ui;
