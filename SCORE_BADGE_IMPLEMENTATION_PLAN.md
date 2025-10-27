# Score Badge System Implementation Plan - Fresh Start

## Overview
This document outlines a complete reimplementation of the score badge system and style mode toggle functionality. We're starting from scratch to eliminate existing confusion and build a clean, understandable system.

---

## Core Requirements

### 1. Score Storage & Progressive Rendering
- ✅ Store score + reasoning in DOM (`img.dataset`) immediately when analysis completes
- ✅ Badges appear **progressively** as each image is analyzed (if toggle ON)
- ✅ Badges appear at **top-right corner** of each image

### 2. Style Mode Toggle Behavior
- **Toggle ON (My Style Mode)**: Show score badges + apply visual effects
- **Toggle OFF (All Items Mode)**: Hide score badges + remove visual effects

### 3. Visual Effects Based on Score
- **Score 9-10**: Yellow border (`#fbbf24`) with glow effect
- **Score 7-8**: Normal appearance (no changes)
- **Score ≤6**: Dimmed appearance (`opacity: 0.4`)

### 4. Badge Design
- Position: Top-right corner of image
- Content: `{score}/10`
- Tooltip: Reasoning text on hover
- Color-coded background based on score range

---

## Phase 0: Complete Cleanup - Remove All Existing Functionality

### Part A: Remove Score Overlay System

#### 1. `/extension/content/ui/ScoreOverlays.js`
**Action**: Delete entire file or gut all methods

**Methods to Remove**:
- `addScoreOverlay()` - All score badge creation logic
- `createScoreBadge()` - Badge element creation
- `positionScoreBadge()` - Badge positioning
- `addLoadingIndicator()` - Loading state badges
- `replaceScoresWithLoadingIndicators()` - Loading indicator management
- `ensureSpinnerAnimation()` - Animation CSS injection
- `ensurePerfectMatchAnimation()` - Perfect match animations

#### 2. `/extension/content/ui/VisualIndicators.js`
**Lines to Remove**:
- **Line 2**: `import { ScoreOverlays } from './ScoreOverlays.js';`
- **Line 17**: `this.scoreOverlays = new ScoreOverlays(this.overlayMap, this.updateHandlers);`
- **Lines 221**: `scoreBadge: null` reference in `trackOverlay()`
- **Lines 303-321**: All methods that delegate to `scoreOverlays`:
  - `addScoreOverlay()`
  - `replaceScoresWithLoadingIndicators()`
  - `addLoadingIndicator()`
- **Lines 336-339**: Score badge removal in `removeImageIndicator()`
- **Lines 366-368**: Score badge removal in `clearProductDetection()`

#### 3. `/extension/content/core/ContentScriptManager.js`
**Lines to Remove**:
- **Lines 536-555**: Progressive UI update during `analyzeCombined()` that adds score overlays
- **Lines 381-400**: Progressive UI update during `analyzeNewProducts()` that adds score overlays
- **Lines 621-678**: Entire `addScoreOverlays()` method
- **Lines 842-850**: Score overlay logic in `showStyleSuggestions()`

### Part B: Remove Style Mode Toggle System

#### 1. `/extension/content/ui/StyleOverlayController.js`
**Action**: Remove confusing toggle logic and state management

**Lines to Remove**:
- **Lines 21-22**: `filterState` initialization
- **Lines 258-354**: Entire `modeToggle()` method (confusing toggle logic with multiple state syncs)
- **Lines 635-643**: `setFilterState()` method (data attribute manipulation)
- **Lines 648-670**: `updateControlsUI()` method (UI syncing)
- **Lines 676-692**: `setupStorageListener()` method (storage sync logic)
- **Lines 699-722**: `syncWithPopupState()` method (popup sync logic)

**Why Removing**: Current implementation has multiple state sources (filterState, storage, data attributes) causing confusion about which is the source of truth.

#### 2. `/extension/content/utils/FilterStateManager.js`
**Action**: This entire class is over-engineered for our simple toggle needs

**Consider**: Either delete entirely or simplify to single boolean toggle state

**Why Removing**: We only need a simple ON/OFF toggle, but this class manages mode, threshold, categories, listeners - unnecessary complexity.

#### 3. `/extension/content/core/ContentScriptManager.js`
**Lines to Remove**:
- **Lines 23-24**: FilterStateManager import and usage
- **Lines 56-62**: FilterStateManager initialization and StyleOverlayController connection
- **Lines 109-112**: FilterStateManager initialization
- **Lines 428-445**: `applyFilterEffects()` method (complex filter logic)
- **Lines 450-467**: `clearFilterEffects()` method
- **Lines 803-806**: `getFilterState()` method

#### 4. `/extension/content/ui/VisualIndicators.js`
**Lines to Remove**:
- **Lines 428-445**: `applyFilterEffects()` method (data attribute manipulation)
- **Lines 450-467**: `clearFilterEffects()` method

---

## Phase 1: Design New Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 ContentScriptManager                         │
│         (Main orchestrator of all functionality)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├─► AI Analysis Engine
                     │   └─► Analyzes image → Returns score + reasoning
                     │       │
                     │       ├─► STEP 1: Store in DOM immediately
                     │       │   ├─► img.dataset.aiStyleScore = score
                     │       │   └─► img.dataset.aiStyleReasoning = reasoning
                     │       │
                     │       └─► STEP 2: Check toggle state
                     │           ├─► If ON: Render badge + effects immediately
                     │           └─► If OFF: Skip rendering (data stored only)
                     │
                     ├─► ScoreBadgeManager (NEW)
                     │   ├─► renderBadge(img, score, reasoning)
                     │   ├─► showAllBadges() - Called when toggle ON
                     │   ├─► hideAllBadges() - Called when toggle OFF
                     │   ├─► applyVisualEffects(img, score)
                     │   └─► clearVisualEffects(img)
                     │
                     └─► StyleToggleController (NEW - Simplified)
                         ├─► State: boolean isMyStyleMode (true/false)
                         ├─► Storage: chrome.storage.local.styleToggleOn
                         ├─► UI: Single toggle switch
                         └─► Actions:
                             ├─► toggleOn() → Show badges + effects
                             └─► toggleOff() → Hide badges + effects
```

### State Management Principles

**Single Source of Truth**:
1. **Toggle State**: `chrome.storage.local.styleToggleOn` (boolean)
2. **Score Data**: `img.dataset.aiStyleScore` + `img.dataset.aiStyleReasoning`
3. **UI State**: Derived from storage, never stored separately

**No More**:
- ❌ Multiple state objects (filterState, rankingMode, extensionEnabled)
- ❌ Data attributes for reactive CSS (`data-ai-filter-mode`, `data-ai-score-threshold`)
- ❌ Complex state syncing between popup/content/storage
- ❌ Listener systems for state changes

**Flow**:
```
User Clicks Toggle
    ↓
Update storage: styleToggleOn = true/false
    ↓
Call: ContentScriptManager.setStyleModeToggle(boolean)
    ↓
If true: ScoreBadgeManager.showAllBadges()
If false: ScoreBadgeManager.hideAllBadges()
```

---

## Phase 2: Implementation

### Step 1: Create ScoreBadgeManager Class

**New File**: `/extension/content/ui/ScoreBadgeManager.js`

```javascript
/**
 * ScoreBadgeManager - Manages score badges and visual effects
 * Handles progressive rendering, show/hide based on toggle state
 */
export class ScoreBadgeManager {
    constructor() {
        // Track all active badges: Map<img element, badge element>
        this.activeBadges = new Map();

        // Current visibility state (synced with toggle)
        this.isVisible = false;

        // Setup global event listeners for repositioning
        this.setupGlobalHandlers();
    }

    /**
     * Store score and reasoning in DOM immediately when analysis completes
     * This happens regardless of toggle state
     * @param {HTMLImageElement} img - Image element
     * @param {number} score - Compatibility score (1-10)
     * @param {string} reasoning - Analysis reasoning text
     */
    storeScore(img, score, reasoning) {
        img.dataset.aiStyleScore = score.toString();
        img.dataset.aiStyleReasoning = reasoning || '';

        console.log(`💾 Score ${score} stored for image:`, img.alt || img.src.substring(0, 50));
    }

    /**
     * Render badge for a single image (progressive rendering)
     * Called immediately after each analysis completes (if toggle is ON)
     * @param {HTMLImageElement} img - Image element
     * @param {number} score - Compatibility score (1-10)
     * @param {string} reasoning - Analysis reasoning text
     */
    renderBadge(img, score, reasoning) {
        // Skip if toggle is OFF
        if (!this.isVisible) {
            console.log(`⏭️ Toggle OFF - skipping badge render for score ${score}`);
            return;
        }

        // Don't render duplicate badges
        if (this.activeBadges.has(img)) {
            console.log(`⚠️ Badge already exists for image, updating instead`);
            this.updateBadge(img, score, reasoning);
            return;
        }

        // Create badge element
        const badge = this.createBadgeElement(score, reasoning);

        // Position at top-right of image
        this.positionBadge(badge, img);

        // Add to DOM
        document.body.appendChild(badge);

        // Track badge
        this.activeBadges.set(img, badge);

        // Apply visual effects to image based on score
        this.applyVisualEffects(img, score);

        console.log(`✅ Badge rendered for score ${score}/10`);
    }

    /**
     * Show all badges for images that have scores stored
     * Called when toggle is switched ON
     */
    showAllBadges() {
        console.log('🎨 Showing all score badges...');

        this.isVisible = true;

        // Find all images with scores stored in DOM
        const imagesWithScores = document.querySelectorAll('img[data-ai-style-score]');

        console.log(`   Found ${imagesWithScores.length} images with scores`);

        imagesWithScores.forEach(img => {
            const score = parseInt(img.dataset.aiStyleScore);
            const reasoning = img.dataset.aiStyleReasoning || '';

            if (!this.activeBadges.has(img)) {
                this.renderBadge(img, score, reasoning);
            }
        });

        console.log(`✅ All badges shown (${this.activeBadges.size} total)`);
    }

    /**
     * Hide all badges and clear visual effects
     * Called when toggle is switched OFF
     */
    hideAllBadges() {
        console.log('🧹 Hiding all score badges...');

        this.isVisible = false;

        // Remove all badges from DOM
        this.activeBadges.forEach((badge, img) => {
            badge.remove();
            this.clearVisualEffects(img);
        });

        // Clear tracking map
        this.activeBadges.clear();

        console.log('✅ All badges hidden and effects cleared');
    }

    /**
     * Apply visual effects to image based on score
     * @param {HTMLImageElement} img - Image element
     * @param {number} score - Compatibility score (1-10)
     */
    applyVisualEffects(img, score) {
        if (score >= 9) {
            // Perfect match (9-10): Yellow border with glow
            img.style.border = '3px solid #fbbf24';
            img.style.boxShadow = '0 0 15px rgba(251, 191, 36, 0.6)';
            img.style.opacity = '1';
            img.style.filter = 'none';

            console.log(`   ✨ Applied yellow border (score ${score})`);
        } else if (score >= 7) {
            // Good match (7-8): Normal appearance
            img.style.opacity = '1';
            img.style.filter = 'none';
            img.style.border = '';
            img.style.boxShadow = '';

            console.log(`   ✅ Normal appearance (score ${score})`);
        } else {
            // Low match (≤6): Dimmed
            img.style.opacity = '0.4';
            img.style.filter = 'grayscale(30%)';
            img.style.border = '';
            img.style.boxShadow = '';

            console.log(`   🌑 Applied dimming (score ${score})`);
        }
    }

    /**
     * Clear all visual effects from image
     * @param {HTMLImageElement} img - Image element
     */
    clearVisualEffects(img) {
        img.style.opacity = '';
        img.style.filter = '';
        img.style.border = '';
        img.style.boxShadow = '';
    }

    /**
     * Create badge element with styling
     * @param {number} score - Compatibility score (1-10)
     * @param {string} reasoning - Analysis reasoning text
     * @returns {HTMLElement} Badge element
     */
    createBadgeElement(score, reasoning) {
        const badge = document.createElement('div');
        badge.className = 'ai-style-score-badge';
        badge.textContent = `${score}/10`;

        // Add reasoning as tooltip
        if (reasoning && reasoning.trim()) {
            badge.title = reasoning.length > 200
                ? reasoning.substring(0, 200) + '...'
                : reasoning;
        }

        // Determine background color based on score
        let backgroundColor;
        if (score >= 9) {
            // Golden for perfect matches
            backgroundColor = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
        } else if (score >= 7) {
            // Green for good matches
            backgroundColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        } else if (score >= 5) {
            // Yellow for medium matches
            backgroundColor = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
        } else {
            // Red for low matches
            backgroundColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        }

        // Apply styling
        badge.style.cssText = `
            position: fixed;
            background: ${backgroundColor};
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 700;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            pointer-events: none;
            user-select: none;
            white-space: nowrap;
            border: 2px solid rgba(255, 255, 255, 0.3);
            min-width: 40px;
            text-align: center;
        `;

        return badge;
    }

    /**
     * Position badge at top-right corner of image
     * @param {HTMLElement} badge - Badge element
     * @param {HTMLImageElement} img - Image element
     */
    positionBadge(badge, img) {
        const rect = img.getBoundingClientRect();

        // Top-right corner positioning
        badge.style.top = `${rect.top + window.scrollY + 8}px`;
        badge.style.left = `${rect.left + window.scrollX + rect.width - 8}px`;
        badge.style.transform = 'translateX(-100%)'; // Shift left by badge width
    }

    /**
     * Update existing badge with new score/reasoning
     * @param {HTMLImageElement} img - Image element
     * @param {number} score - New score
     * @param {string} reasoning - New reasoning
     */
    updateBadge(img, score, reasoning) {
        const badge = this.activeBadges.get(img);
        if (!badge) return;

        badge.textContent = `${score}/10`;
        badge.title = reasoning || '';

        this.applyVisualEffects(img, score);
    }

    /**
     * Update all badge positions (called on scroll/resize)
     */
    updateAllPositions() {
        this.activeBadges.forEach((badge, img) => {
            // Only reposition if image is still in DOM
            if (img.isConnected) {
                this.positionBadge(badge, img);
            } else {
                // Clean up badge for removed image
                badge.remove();
                this.activeBadges.delete(img);
            }
        });
    }

    /**
     * Setup global event handlers for scroll/resize
     */
    setupGlobalHandlers() {
        window.addEventListener('scroll', () => this.updateAllPositions(), { passive: true });
        window.addEventListener('resize', () => this.updateAllPositions());

        console.log('✅ Global position update handlers setup');
    }

    /**
     * Clean up all badges and handlers
     */
    cleanup() {
        this.hideAllBadges();
        // Event listeners will be automatically garbage collected
    }
}

// Expose on window for debugging
if (typeof window !== 'undefined') {
    window.ScoreBadgeManager = ScoreBadgeManager;
}
```

### Step 2: Create StyleToggleController Class

**New File**: `/extension/content/ui/StyleToggleController.js`

```javascript
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
```

### Step 3: Integrate with ContentScriptManager

**File**: `/extension/content/core/ContentScriptManager.js`

**In constructor** (replace old components):
```javascript
// NEW: Simplified components
this.scoreBadgeManager = new ScoreBadgeManager();
this.styleToggleController = new StyleToggleController(this);

// Remove old components:
// - this.filterStateManager
// - this.styleOverlayController
```

**In `initialize()` method**:
```javascript
async initialize() {
    // ... existing initialization ...

    // Load toggle state
    await this.loadToggleState();

    // Show toggle controls
    this.styleToggleController.showControls();

    // ... rest of initialization ...
}

async loadToggleState() {
    const result = await chrome.storage.local.get(['styleToggleOn']);
    this.isStyleModeOn = result.styleToggleOn || false;
    console.log('✅ Style mode loaded:', this.isStyleModeOn ? 'ON' : 'OFF');
}
```

**In `analyzeCombined()` method** (progressive badge rendering):
```javascript
// After each image analysis completes (around line 510-555)
const styleResult = await this.personalStyleMatcher.analyzeProduct(img, this.styleProfile);

if (styleResult && styleResult.score) {
    // STEP 1: Store score in DOM (always)
    this.scoreBadgeManager.storeScore(img, styleResult.score, styleResult.reasoning);

    // STEP 2: Render badge immediately if toggle is ON (progressive)
    if (this.isStyleModeOn) {
        this.scoreBadgeManager.renderBadge(img, styleResult.score, styleResult.reasoning);
    }
}
```

**New method `setStyleModeToggle()`**:
```javascript
/**
 * Set style mode toggle state (called by StyleToggleController)
 * @param {boolean} isOn - true = show badges, false = hide badges
 */
async setStyleModeToggle(isOn) {
    console.log(`🔄 Setting style mode: ${isOn ? 'ON' : 'OFF'}`);

    this.isStyleModeOn = isOn;

    if (isOn) {
        // Toggle ON: Show all badges for images with scores
        this.scoreBadgeManager.showAllBadges();
    } else {
        // Toggle OFF: Hide all badges and clear effects
        this.scoreBadgeManager.hideAllBadges();
    }

    console.log(`✅ Style mode ${isOn ? 'enabled' : 'disabled'}`);
}
```

---

## Phase 3: Testing Checklist

### Initial Setup
- [ ] Load extension on Zara/H&M/Nike
- [ ] Open browser console for debugging logs
- [ ] Upload style photos and generate profile

### Test Progressive Rendering
- [ ] Navigate to product listing page
- [ ] Watch console as analysis runs
- [ ] Verify: Badges appear one-by-one as each analysis completes
- [ ] Verify: Scores stored in `img.dataset.aiStyleScore`

### Test Toggle ON
- [ ] Click toggle to enable "My Style Mode"
- [ ] Verify: All score badges appear at top-right corners
- [ ] Verify: Badge shows `{score}/10` format
- [ ] Verify: Hover shows reasoning tooltip

### Test Visual Effects (Toggle ON)
- [ ] Find image with score 9-10
  - [ ] Has yellow border (`#fbbf24`)
  - [ ] Has glow effect (box-shadow)
  - [ ] Normal opacity (1.0)
- [ ] Find image with score 7-8
  - [ ] Normal appearance (no border)
  - [ ] Normal opacity (1.0)
- [ ] Find image with score ≤6
  - [ ] Dimmed (opacity 0.4)
  - [ ] Slight grayscale filter

### Test Toggle OFF
- [ ] Click toggle to disable "My Style Mode"
- [ ] Verify: All badges disappear
- [ ] Verify: All visual effects removed (borders, opacity reset)
- [ ] Verify: Images appear normal

### Test Toggle ON Again
- [ ] Click toggle to re-enable "My Style Mode"
- [ ] Verify: Badges reappear instantly (no re-analysis)
- [ ] Verify: Visual effects reapplied correctly

### Test Scroll/Resize
- [ ] With toggle ON, scroll page up and down
- [ ] Verify: Badges stay positioned at top-right of images
- [ ] Resize browser window
- [ ] Verify: Badges reposition correctly

### Test Edge Cases
- [ ] Rapid toggle switching (ON/OFF/ON)
- [ ] Navigate to new page with toggle ON
- [ ] Reload page and verify toggle state persists
- [ ] Test with no style profile (badges shouldn't appear)

---

## Phase 4: Cleanup Tasks

### Files to Delete
- [ ] `/extension/content/ui/ScoreOverlays.js` (if gutted completely)
- [ ] `/extension/content/utils/FilterStateManager.js` (no longer needed)
- [ ] `/extension/content/config/FilterDefaults.js` (if it exists)

### Files to Update (Remove Dead Code)
- [ ] `/extension/content/ui/VisualIndicators.js` - Remove score overlay references
- [ ] `/extension/content/core/ContentScriptManager.js` - Remove old score logic
- [ ] `/extension/content/ui/StyleOverlayController.js` - Remove (replaced by StyleToggleController)
- [ ] `/extension/manifest.json` - Verify all script paths are correct

---

## Summary

### What We're Building

**Simple, Clean System**:
1. AI analyzes image → Store score in DOM
2. If toggle ON → Render badge immediately (progressive)
3. If toggle OFF → Skip rendering (data stays in DOM)
4. User toggles ON → Show all badges from stored data
5. User toggles OFF → Hide all badges

### Key Principles

✅ **Progressive Rendering**: Badges appear as analysis completes
✅ **Simple State**: One boolean toggle (ON/OFF)
✅ **DOM as Storage**: Scores stored in `dataset` attributes
✅ **No Over-Engineering**: No complex state management
✅ **Clear Separation**: Badge rendering separate from toggle logic

### Benefits

- **Understandable**: Clear flow from analysis → storage → rendering
- **Maintainable**: Simple components with single responsibilities
- **Performant**: Only render when needed
- **Debuggable**: Clear console logs at each step
- **Testable**: Simple state makes testing straightforward

---

## Next Steps

1. **Phase 0**: Remove all existing functionality ✅
2. **Phase 1**: Implement `ScoreBadgeManager` class ✅
3. **Phase 2**: Implement `StyleToggleController` class ✅
4. **Phase 3**: Integrate with `ContentScriptManager` ✅
5. **Phase 4**: Test thoroughly on live sites ⏳
6. **Phase 5**: Clean up dead code and files ⏳

---

**Document Version**: 1.0
**Last Updated**: 2025-10-27
**Status**: Ready for Implementation
