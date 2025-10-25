/**
 * GlobalProgressIndicator manages a centralized progress bar for product analysis
 * Replaces per-image loading spinners with a single clean progress indicator
 * Implements Phase 2, Section 2.1 of UI_IMPROVEMENT_PLAN.md
 */
export class GlobalProgressIndicator {
    constructor() {
        this.indicatorId = 'ai-style-global-progress-indicator';
        this.keyframesId = 'ai-style-progress-keyframes';
        this.currentIndicator = null;
        this.currentProgress = 0;
        this.totalItems = 0;
        this.isVisible = false;
    }

    /**
     * Show global progress indicator
     * @param {number} total - Total number of items to analyze
     * @param {string} label - Optional custom label (defaults to "Analyzing products")
     */
    show(total, label = 'Analyzing products') {
        // Remove any existing indicator first
        this.hide();

        this.totalItems = total;
        this.currentProgress = 0;
        this.label = label;

        // Create progress indicator container
        const indicator = document.createElement('div');
        indicator.id = this.indicatorId;
        indicator.setAttribute('data-ai-style-progress', 'true');

        this.applyIndicatorStyles(indicator);
        this.ensureAnimationStyles();

        // Add emoji icon
        const icon = this.createIcon('🎨');

        // Add progress text
        const progressText = this.createProgressText();

        // Add progress bar
        const progressBar = this.createProgressBar();

        indicator.appendChild(icon);
        indicator.appendChild(progressText);
        indicator.appendChild(progressBar);

        document.body.appendChild(indicator);
        this.currentIndicator = indicator;
        this.isVisible = true;

        console.log(`📊 Global progress indicator shown: 0/${total}`);
    }

    /**
     * Update progress count
     * @param {number} current - Current progress count
     */
    updateProgress(current) {
        if (!this.isVisible || !this.currentIndicator) {
            console.warn('⚠️ Cannot update progress - indicator not visible');
            return;
        }

        this.currentProgress = current;
        const percentage = (current / this.totalItems) * 100;

        // Update progress text
        const progressText = this.currentIndicator.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = `${this.label}... ${current}/${this.totalItems}`;
        }

        // Update progress bar
        const progressFill = this.currentIndicator.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }

        console.log(`📊 Progress updated: ${current}/${this.totalItems} (${Math.round(percentage)}%)`);

        // Auto-complete when all items are done
        if (current >= this.totalItems) {
            this.showCompletion();
        }
    }

    /**
     * Show completion state with success animation
     */
    showCompletion() {
        if (!this.isVisible || !this.currentIndicator) {
            return;
        }

        // Update to completion state
        const icon = this.currentIndicator.querySelector('.progress-icon');
        const progressText = this.currentIndicator.querySelector('.progress-text');

        if (icon) {
            icon.textContent = '✓';
            icon.style.background = 'rgba(16, 185, 129, 0.2)'; // Green background
            icon.style.color = '#10b981';
        }

        if (progressText) {
            progressText.textContent = `✓ Analysis complete! ${this.totalItems} items ranked`;
        }

        // Change background to success color
        this.currentIndicator.style.background = 'linear-gradient(135deg, #10b981 0%, #34d399 100%)';

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            this.hide();
        }, 3000);

        console.log('✅ Global progress indicator: Analysis complete');
    }

    /**
     * Hide global progress indicator with fade-out animation
     */
    hide() {
        const indicator = document.getElementById(this.indicatorId);

        if (indicator) {
            indicator.style.animation = 'slideInFade 0.3s ease-out reverse';

            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
                this.currentIndicator = null;
                this.isVisible = false;
                this.currentProgress = 0;
                this.totalItems = 0;
            }, 300);

            console.log('📊 Global progress indicator hidden');
        }
    }

    /**
     * Apply styles to the progress indicator
     * @param {HTMLElement} indicator - The indicator element
     * @private
     */
    applyIndicatorStyles(indicator) {
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 16px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            font-size: 13px;
            font-weight: 500;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 999999;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 280px;
            max-width: 320px;
            animation: slideInFade 0.3s ease-out;
        `;
    }

    /**
     * Ensure animation keyframes are added to the document
     * @private
     */
    ensureAnimationStyles() {
        if (!document.querySelector(`#${this.keyframesId}`)) {
            const style = document.createElement('style');
            style.id = this.keyframesId;
            style.textContent = `
                @keyframes slideInFade {
                    from {
                        opacity: 0;
                        transform: translateX(100px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes progressPulse {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.7;
                    }
                }
                .progress-fill {
                    transition: width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create icon element
     * @param {string} emoji - Emoji to display
     * @returns {HTMLElement} Icon element
     * @private
     */
    createIcon(emoji) {
        const icon = document.createElement('div');
        icon.className = 'progress-icon';
        icon.style.cssText = `
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            flex-shrink: 0;
            position: absolute;
            top: 12px;
            left: 12px;
        `;
        icon.textContent = emoji;
        return icon;
    }

    /**
     * Create progress text element
     * @returns {HTMLElement} Progress text element
     * @private
     */
    createProgressText() {
        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.style.cssText = `
            margin-left: 36px;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        progressText.textContent = `${this.label}... ${this.currentProgress}/${this.totalItems}`;
        return progressText;
    }

    /**
     * Create progress bar element
     * @returns {HTMLElement} Progress bar container
     * @private
     */
    createProgressBar() {
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'progress-bar-container';
        progressBarContainer.style.cssText = `
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.2);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 4px;
        `;

        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.cssText = `
            height: 100%;
            width: 0%;
            background: rgba(255,255,255,0.9);
            border-radius: 2px;
            box-shadow: 0 0 10px rgba(255,255,255,0.5);
        `;

        progressBarContainer.appendChild(progressFill);
        return progressBarContainer;
    }

    /**
     * Check if progress indicator is currently visible
     * @returns {boolean} True if indicator is visible
     */
    isIndicatorVisible() {
        return this.isVisible;
    }

    /**
     * Get current progress
     * @returns {Object} Progress information
     */
    getProgress() {
        return {
            current: this.currentProgress,
            total: this.totalItems,
            percentage: this.totalItems > 0 ? (this.currentProgress / this.totalItems) * 100 : 0,
            isVisible: this.isVisible
        };
    }

    /**
     * Cleanup - remove all progress indicators
     */
    cleanup() {
        const indicators = document.querySelectorAll('[data-ai-style-progress="true"]');
        indicators.forEach(indicator => indicator.remove());

        const keyframes = document.getElementById(this.keyframesId);
        if (keyframes) {
            keyframes.remove();
        }

        this.currentIndicator = null;
        this.isVisible = false;
        this.currentProgress = 0;
        this.totalItems = 0;

        console.log('🧹 Global progress indicator cleaned up');
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.GlobalProgressIndicator = GlobalProgressIndicator;
}
