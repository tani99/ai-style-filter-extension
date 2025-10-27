/**
 * StyleOverlayController manages the UI for style overlay controls
 * Provides toggle switches and controls for showing/hiding style recommendations
 */
export class StyleOverlayController {
    constructor(contentScriptManager = null) {
        this.controlsPanel = null;
        this.isVisible = false;
        this.isCollapsed = false;

        // Reference to ContentScriptManager for triggering overlay updates
        this.contentScriptManager = contentScriptManager;

        // Drag state
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.currentPosition = { x: window.innerWidth - 320, y: 80 }; // Default position (top-right)
    }

    /**
     * Set the ContentScriptManager reference
     * @param {ContentScriptManager} manager - ContentScriptManager instance
     */
    setContentScriptManager(manager) {
        this.contentScriptManager = manager;
        console.log('✅ StyleOverlayController connected to ContentScriptManager');
    }

    /**
     * Create and inject the style overlay control panel into the page
     */
    createControlsPanel() {
        if (this.controlsPanel) {
            console.log('⚠️ Style overlay controls already exist');
            return;
        }

        console.log('🎛️ Creating style overlay control panel...');

        // Create main panel container
        const panel = this.controlPanel();
        
        // Create header section
        const header = this.header();
        
        // Create content section
        const content = this.content();

        // Assemble the complete panel
        panel.appendChild(header);
        panel.appendChild(content);

        // Add drag functionality to header
        this.setupDragHandlers(header, panel);

        // Add to document
        document.body.appendChild(panel);
        this.controlsPanel = panel;
        this.isVisible = true;

        console.log('✅ Style overlay control panel created');
    }

    /**
     * Create the main control panel container
     * @returns {HTMLElement} Main panel element
     */
    controlPanel() {
        const panel = document.createElement('div');
        panel.className = 'ai-style-filter-controls';
        panel.dataset.aiStyleControls = 'true';

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
            transition: opacity 0.3s ease-in-out;
            opacity: 1;
            cursor: move;
        `;

        return panel;
    }

    /**
     * Create the header section with title and buttons
     * @returns {HTMLElement} Header element
     */
    header() {
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
        header.dataset.aiStyleHeader = 'true';

        // Add title
        const title = this.title();
        header.appendChild(title);

        // Add button container
        const buttonContainer = this.buttonContainer();
        header.appendChild(buttonContainer);

        return header;
    }

    /**
     * Create the panel title
     * @returns {HTMLElement} Title element
     */
    title() {
        const title = document.createElement('h3');
        title.textContent = '🎨 Style Filter';
        title.style.cssText = `
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        `;
        return title;
    }

    /**
     * Create the button container with collapse and close buttons
     * @returns {HTMLElement} Button container element
     */
    buttonContainer() {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 8px;
        `;

        // Add collapse button
        const collapseButton = this.collapseButton();
        buttonContainer.appendChild(collapseButton);

        // Add close button
        const closeButton = this.closeButton();
        buttonContainer.appendChild(closeButton);

        return buttonContainer;
    }

    /**
     * Create the collapse button
     * @returns {HTMLElement} Collapse button element
     */
    collapseButton() {
        const collapseButton = document.createElement('button');
        collapseButton.textContent = '−';
        collapseButton.dataset.aiStyleCollapse = 'true';
        collapseButton.style.cssText = `
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
        collapseButton.onmouseover = () => collapseButton.style.background = 'rgba(255, 255, 255, 0.2)';
        collapseButton.onmouseout = () => collapseButton.style.background = 'transparent';
        collapseButton.onclick = (e) => {
            e.stopPropagation();
            this.toggleCollapse();
        };
        return collapseButton;
    }

    /**
     * Create the close button
     * @returns {HTMLElement} Close button element
     */
    closeButton() {
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
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
        closeButton.onmouseover = () => closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
        closeButton.onmouseout = () => closeButton.style.background = 'transparent';
        closeButton.onclick = (e) => {
            e.stopPropagation();
            this.hideControls();
        };
        return closeButton;
    }

    /**
     * Create the content section with all controls
     * @returns {HTMLElement} Content element
     */
    content() {
        const content = document.createElement('div');
        content.dataset.aiStyleContent = 'true';
        content.style.cssText = `
            padding: 20px;
            max-height: 400px;
            overflow-y: auto;
            transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
        `;

        // Add category filters section
        const categorySection = this.categoryFilters();
        content.appendChild(categorySection);

        return content;
    }


    /**
     * Create score threshold slider - REMOVED
     * Now using automatic UI editing based on scoring rules
     * @returns {HTMLElement} Threshold slider section
     */
    /* REMOVED - createThresholdSlider() {
        const section = document.createElement('div');
        section.style.cssText = `
            margin-bottom: 24px;
        `;

        const labelContainer = document.createElement('div');
        labelContainer.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        `;

        const label = document.createElement('span');
        label.textContent = 'Match Sensitivity';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 500;
        `;

        const scoreDisplay = document.createElement('span');
        scoreDisplay.textContent = `${this.filterState.scoreThreshold}/10`;
        scoreDisplay.id = 'ai-style-score-display';
        scoreDisplay.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.2);
            padding: 4px 12px;
            border-radius: 12px;
        `;

        labelContainer.appendChild(label);
        labelContainer.appendChild(scoreDisplay);

        // Slider
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '10';
        slider.value = this.filterState.scoreThreshold;
        slider.step = '1';
        slider.style.cssText = `
            width: 100%;
            height: 6px;
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.3);
            outline: none;
            cursor: pointer;
            -webkit-appearance: none;
        `;

        // Custom slider styling
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: white;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            input[type="range"]::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: white;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                border: none;
            }
        `;
        document.head.appendChild(styleElement);

        // Handle slider change
        slider.oninput = () => {
            this.filterState.scoreThreshold = parseInt(slider.value);
            scoreDisplay.textContent = `${this.filterState.scoreThreshold}/10`;
        };

        slider.onchange = () => {
            this.triggerFilterChange();
        };

        section.appendChild(labelContainer);
        section.appendChild(slider);

        return section;
    } */

    /**
     * Create style category filters
     * @returns {HTMLElement} Category filters section
     */
    categoryFilters() {
        const section = document.createElement('div');
        section.style.cssText = `
            margin-bottom: 16px;
        `;

        const label = document.createElement('div');
        label.textContent = 'Style Categories';
        label.style.cssText = `
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 12px;
        `;

        const info = document.createElement('div');
        info.textContent = 'Coming soon: Filter by specific style categories';
        info.style.cssText = `
            font-size: 12px;
            opacity: 0.7;
            font-style: italic;
        `;

        section.appendChild(label);
        section.appendChild(info);

        return section;
    }

    /**
     * Setup drag handlers for the panel
     * @param {HTMLElement} dragHandle - Element to use as drag handle (header)
     * @param {HTMLElement} panel - Panel element to move
     * @private
     */
    setupDragHandlers(dragHandle, panel) {
        const onMouseDown = (e) => {
            // Don't start drag if clicking on buttons
            if (e.target.tagName === 'BUTTON') {
                return;
            }

            this.isDragging = true;
            this.dragOffset.x = e.clientX - this.currentPosition.x;
            this.dragOffset.y = e.clientY - this.currentPosition.y;

            dragHandle.style.cursor = 'grabbing';
            panel.style.transition = 'none';
            e.preventDefault();
        };

        const onMouseMove = (e) => {
            if (!this.isDragging) return;

            this.currentPosition.x = e.clientX - this.dragOffset.x;
            this.currentPosition.y = e.clientY - this.dragOffset.y;

            // Keep panel within viewport bounds
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
            panel.style.transition = 'opacity 0.3s ease-in-out';
        };

        dragHandle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // Store handlers for cleanup
        this.dragHandlers = { onMouseDown, onMouseMove, onMouseUp };
    }

    /**
     * Toggle collapse state of the panel
     */
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;

        const content = this.controlsPanel.querySelector('[data-ai-style-content]');
        const collapseButton = this.controlsPanel.querySelector('[data-ai-style-collapse]');

        if (this.isCollapsed) {
            content.style.maxHeight = '0';
            content.style.opacity = '0';
            content.style.padding = '0 20px';
            collapseButton.textContent = '+';
            console.log('🔼 Panel collapsed');
        } else {
            content.style.maxHeight = '400px';
            content.style.opacity = '1';
            content.style.padding = '20px';
            collapseButton.textContent = '−';
            console.log('🔽 Panel expanded');
        }
    }


    /**
     * Show the controls panel
     */
    showControls() {
        if (!this.controlsPanel) {
            this.createControlsPanel();
        } else {
            this.controlsPanel.style.opacity = '1';
            this.controlsPanel.style.pointerEvents = 'auto';
            this.isVisible = true;
        }
    }

    /**
     * Hide the controls panel
     */
    hideControls() {
        if (this.controlsPanel) {
            this.controlsPanel.style.opacity = '0';
            this.controlsPanel.style.pointerEvents = 'none';
            this.isVisible = false;
        }
    }

    /**
     * Toggle controls visibility
     */
    toggleControls() {
        if (this.isVisible) {
            this.hideControls();
        } else {
            this.showControls();
        }
    }

    /**
     * Remove the controls panel from the page
     */
    removeControls() {
        if (this.controlsPanel && this.controlsPanel.parentNode) {
            // Cleanup drag handlers
            if (this.dragHandlers) {
                const header = this.controlsPanel.querySelector('[data-ai-style-header]');
                if (header) {
                    header.removeEventListener('mousedown', this.dragHandlers.onMouseDown);
                }
                document.removeEventListener('mousemove', this.dragHandlers.onMouseMove);
                document.removeEventListener('mouseup', this.dragHandlers.onMouseUp);
            }

            this.controlsPanel.remove();
            this.controlsPanel = null;
            this.isVisible = false;
        }
    }


}

// Expose on window for debugging
if (typeof window !== 'undefined') {
    window.StyleOverlayController = StyleOverlayController;
}
