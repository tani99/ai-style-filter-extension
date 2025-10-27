/**
 * StyleToggleController - Simple toggle switch for Style Mode
 * Manages single boolean state and UI toggle control
 */
export class StyleToggleController {
    constructor(contentScriptManager = null) {
        this.contentScriptManager = contentScriptManager;
        this.controlPanel = null;
        this.isVisible = false;
        this.isCollapsed = false;

        // Drag state
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.currentPosition = { x: window.innerWidth - 320, y: 80 };

        // Simple toggle state: true = My Style ON, false = My Style OFF
        this.isMyStyleModeOn = false;

        // Load state from storage
        this.loadToggleState();
    }

    /**
     * Set ContentScriptManager reference
     * @param {ContentScriptManager} manager - Manager instance
     */
    setContentScriptManager(manager) {
        this.contentScriptManager = manager;
        console.log('✅ StyleToggleController connected to ContentScriptManager');
    }

    /**
     * Load toggle state from storage
     */
    async loadToggleState() {
        try {
            const result = await chrome.storage.local.get(['styleToggleOn']);
            this.isMyStyleModeOn = result.styleToggleOn || false;
            console.log('✅ Toggle state loaded:', this.isMyStyleModeOn ? 'ON' : 'OFF');
        } catch (error) {
            console.error('❌ Failed to load toggle state:', error);
        }
    }

    /**
     * Save toggle state to storage
     */
    async saveToggleState() {
        try {
            await chrome.storage.local.set({ styleToggleOn: this.isMyStyleModeOn });
            console.log('💾 Toggle state saved:', this.isMyStyleModeOn ? 'ON' : 'OFF');
        } catch (error) {
            console.error('❌ Failed to save toggle state:', error);
        }
    }

    /**
     * Create and show control panel with toggle
     */
    createControlPanel() {
        if (this.controlPanel) {
            console.log('⚠️ Control panel already exists');
            return;
        }

        console.log('🎛️ Creating style toggle control panel...');

        // Main panel container
        const panel = document.createElement('div');
        panel.className = 'ai-style-toggle-panel';
        panel.style.cssText = `
            position: fixed;
            top: ${this.currentPosition.y}px;
            left: ${this.currentPosition.x}px;
            width: 300px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            overflow: hidden;
        `;

        // Header
        const header = this.createHeader();
        panel.appendChild(header);

        // Content
        const content = this.createContent();
        panel.appendChild(content);

        // Setup drag functionality
        this.setupDragHandlers(header, panel);

        // Add to page
        document.body.appendChild(panel);
        this.controlPanel = panel;
        this.isVisible = true;

        console.log('✅ Control panel created');
    }

    /**
     * Create header with title and buttons
     */
    createHeader() {
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 16px 20px;
            background: rgba(0, 0, 0, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            cursor: move;
        `;

        // Title
        const title = document.createElement('h3');
        title.textContent = '🎨 Style Filter';
        title.style.cssText = `
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        `;

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px;';

        // Collapse button
        const collapseBtn = this.createButton('−');
        collapseBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleCollapse();
        };

        // Close button
        const closeBtn = this.createButton('×');
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            this.hideControls();
        };

        buttonContainer.appendChild(collapseBtn);
        buttonContainer.appendChild(closeBtn);

        header.appendChild(title);
        header.appendChild(buttonContainer);

        return header;
    }

    /**
     * Create content section with toggle
     */
    createContent() {
        const content = document.createElement('div');
        content.className = 'ai-style-toggle-content';
        content.style.cssText = `
            padding: 20px;
            transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
            max-height: 400px;
        `;

        // Toggle section
        const toggleSection = this.createToggleSwitch();
        content.appendChild(toggleSection);

        return content;
    }

    /**
     * Create toggle switch element
     */
    createToggleSwitch() {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 16px;';

        const label = document.createElement('label');
        label.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
        `;

        const labelText = document.createElement('span');
        labelText.textContent = 'My Style Mode';
        labelText.style.cssText = `
            font-size: 14px;
            font-weight: 500;
        `;

        // Toggle container
        const toggleContainer = document.createElement('div');
        toggleContainer.style.cssText = `
            position: relative;
            width: 52px;
            height: 28px;
            background: ${this.isMyStyleModeOn ? '#10b981' : 'rgba(255, 255, 255, 0.3)'};
            border-radius: 14px;
            transition: background 0.3s;
        `;

        // Toggle knob
        const toggleKnob = document.createElement('div');
        toggleKnob.style.cssText = `
            position: absolute;
            top: 3px;
            left: 3px;
            width: 22px;
            height: 22px;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transform: ${this.isMyStyleModeOn ? 'translateX(24px)' : 'translateX(0)'};
        `;

        toggleContainer.appendChild(toggleKnob);

        // Click handler
        label.onclick = async () => {
            // Toggle state
            this.isMyStyleModeOn = !this.isMyStyleModeOn;

            // Update UI
            if (this.isMyStyleModeOn) {
                toggleContainer.style.background = '#10b981';
                toggleKnob.style.transform = 'translateX(24px)';
            } else {
                toggleContainer.style.background = 'rgba(255, 255, 255, 0.3)';
                toggleKnob.style.transform = 'translateX(0)';
            }

            // Save to storage
            await this.saveToggleState();

            // Trigger content script manager action
            if (this.contentScriptManager) {
                await this.contentScriptManager.setStyleModeToggle(this.isMyStyleModeOn);
            }

            console.log(`🎛️ Style mode toggled: ${this.isMyStyleModeOn ? 'ON' : 'OFF'}`);
        };

        label.appendChild(labelText);
        label.appendChild(toggleContainer);
        section.appendChild(label);

        return section;
    }

    /**
     * Create button element
     */
    createButton(text) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            background: transparent;
            border: none;
            color: white;
            font-size: 28px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: background 0.2s;
        `;
        button.onmouseover = () => button.style.background = 'rgba(255, 255, 255, 0.2)';
        button.onmouseout = () => button.style.background = 'transparent';
        return button;
    }

    /**
     * Setup drag handlers
     */
    setupDragHandlers(dragHandle, panel) {
        const onMouseDown = (e) => {
            if (e.target.tagName === 'BUTTON') return;

            this.isDragging = true;
            this.dragOffset.x = e.clientX - this.currentPosition.x;
            this.dragOffset.y = e.clientY - this.currentPosition.y;
            dragHandle.style.cursor = 'grabbing';
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!this.isDragging) return;

            this.currentPosition.x = e.clientX - this.dragOffset.x;
            this.currentPosition.y = e.clientY - this.dragOffset.y;

            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;

            this.currentPosition.x = Math.max(0, Math.min(this.currentPosition.x, maxX));
            this.currentPosition.y = Math.max(0, Math.min(this.currentPosition.y, maxY));

            panel.style.left = `${this.currentPosition.x}px`;
            panel.style.top = `${this.currentPosition.y}px`;
        };

        const onMouseUp = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            dragHandle.style.cursor = 'move';
        };

        dragHandle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    /**
     * Toggle collapse state
     */
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        const content = this.controlPanel.querySelector('.ai-style-toggle-content');
        const collapseBtn = this.controlPanel.querySelector('button');

        if (this.isCollapsed) {
            content.style.maxHeight = '0';
            content.style.opacity = '0';
            content.style.padding = '0 20px';
            collapseBtn.textContent = '+';
        } else {
            content.style.maxHeight = '400px';
            content.style.opacity = '1';
            content.style.padding = '20px';
            collapseBtn.textContent = '−';
        }
    }

    /**
     * Show controls
     */
    showControls() {
        if (!this.controlPanel) {
            this.createControlPanel();
        } else {
            this.controlPanel.style.opacity = '1';
            this.controlPanel.style.pointerEvents = 'auto';
            this.isVisible = true;
        }
    }

    /**
     * Hide controls
     */
    hideControls() {
        if (this.controlPanel) {
            this.controlPanel.style.opacity = '0';
            this.controlPanel.style.pointerEvents = 'none';
            this.isVisible = false;
        }
    }

    /**
     * Toggle visibility
     */
    toggleControls() {
        if (this.isVisible) {
            this.hideControls();
        } else {
            this.showControls();
        }
    }

    /**
     * Get current toggle state
     */
    getToggleState() {
        return this.isMyStyleModeOn;
    }
}

// Expose on window for debugging
if (typeof window !== 'undefined') {
    window.StyleToggleController = StyleToggleController;
}
