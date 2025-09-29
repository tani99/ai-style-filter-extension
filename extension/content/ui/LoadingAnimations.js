/**
 * LoadingAnimations manages loading overlays and progress indicators
 * for AI analysis operations
 */
export class LoadingAnimations {
    constructor() {
        this.overlayId = 'ai-style-loading-overlay';
        this.keyframesId = 'ai-style-loading-keyframes';
        this.currentOverlay = null;
        this.isAnimating = false;
    }

    /**
     * Show loading animation with custom message
     * @param {string} message - Loading message to display
     */
    showLoadingAnimation(message = 'AI Stylist is analyzing products...') {
        // Remove any existing loading indicator first
        this.hideLoadingAnimation();

        // Create loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = this.overlayId;
        loadingOverlay.setAttribute('data-ai-style-overlay', 'true');

        this.applyOverlayStyles(loadingOverlay);
        this.ensureAnimationStyles();

        // Add spinner and message
        const spinner = this.createSpinner();
        const messageElement = this.createMessageElement(message);

        loadingOverlay.appendChild(spinner);
        loadingOverlay.appendChild(messageElement);

        document.body.appendChild(loadingOverlay);
        this.currentOverlay = loadingOverlay;
        this.isAnimating = true;

        console.log('📡 Loading animation shown:', message);
    }

    /**
     * Hide loading animation with fade-out effect
     */
    hideLoadingAnimation() {
        const loadingOverlay = document.getElementById(this.overlayId);
        if (loadingOverlay && !this.isAnimating) {
            return; // Already hiding or hidden
        }

        if (loadingOverlay) {
            this.isAnimating = true;
            loadingOverlay.style.animation = 'slideInFade 0.3s ease-out reverse';

            setTimeout(() => {
                if (loadingOverlay.parentNode) {
                    loadingOverlay.remove();
                }
                this.currentOverlay = null;
                this.isAnimating = false;
            }, 300);

            console.log('📡 Loading animation hidden');
        }
    }

    /**
     * Update loading message without recreating the overlay
     * @param {string} message - New loading message
     */
    updateLoadingMessage(message) {
        const loadingOverlay = document.getElementById(this.overlayId);
        if (loadingOverlay) {
            const messageElement = loadingOverlay.querySelector('span');
            if (messageElement) {
                messageElement.textContent = message;
                console.log('📡 Loading message updated:', message);
            }
        }
    }

    /**
     * Show progress loading with percentage
     * @param {string} message - Base loading message
     * @param {number} progress - Progress percentage (0-100)
     */
    showProgressLoading(message, progress = 0) {
        const progressMessage = `${message} (${Math.round(progress)}%)`;

        if (this.isLoadingVisible()) {
            this.updateLoadingMessage(progressMessage);
        } else {
            this.showLoadingAnimation(progressMessage);
        }
    }

    /**
     * Show batch processing animation
     * @param {number} currentBatch - Current batch number
     * @param {number} totalBatches - Total number of batches
     * @param {string} baseMessage - Base message for the operation
     */
    showBatchProgress(currentBatch, totalBatches, baseMessage = 'Processing products') {
        const message = `${baseMessage} (batch ${currentBatch}/${totalBatches})`;

        if (this.isLoadingVisible()) {
            this.updateLoadingMessage(message);
        } else {
            this.showLoadingAnimation(message);
        }
    }

    /**
     * Apply styles to the loading overlay
     * @param {HTMLElement} overlay - The overlay element
     * @private
     */
    applyOverlayStyles(overlay) {
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 999999;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 280px;
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
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .ai-style-spinner {
                    width: 18px;
                    height: 18px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: white;
                    animation: spin 1s linear infinite;
                    flex-shrink: 0;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Create spinner element
     * @returns {HTMLElement} Spinner element
     * @private
     */
    createSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'ai-style-spinner';
        return spinner;
    }

    /**
     * Create message element
     * @param {string} message - Message text
     * @returns {HTMLElement} Message element
     * @private
     */
    createMessageElement(message) {
        const messageElement = document.createElement('span');
        messageElement.textContent = message;
        return messageElement;
    }

    /**
     * Check if loading animation is currently visible
     * @returns {boolean} True if loading animation is visible
     */
    isLoadingVisible() {
        return !!document.getElementById(this.overlayId);
    }

    /**
     * Get current loading message
     * @returns {string|null} Current loading message or null if not visible
     */
    getCurrentMessage() {
        const loadingOverlay = document.getElementById(this.overlayId);
        if (loadingOverlay) {
            const messageElement = loadingOverlay.querySelector('span');
            return messageElement ? messageElement.textContent : null;
        }
        return null;
    }

    /**
     * Show temporary success message
     * @param {string} message - Success message
     * @param {number} duration - Duration to show message in milliseconds
     */
    showSuccessMessage(message, duration = 2000) {
        this.hideLoadingAnimation();

        const successOverlay = document.createElement('div');
        successOverlay.id = 'ai-style-success-overlay';
        successOverlay.setAttribute('data-ai-style-overlay', 'true');

        successOverlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 999999;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 280px;
            animation: slideInFade 0.3s ease-out;
        `;

        // Add checkmark icon
        const checkmark = document.createElement('div');
        checkmark.style.cssText = `
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            flex-shrink: 0;
        `;
        checkmark.textContent = '✓';

        const messageElement = document.createElement('span');
        messageElement.textContent = message;

        successOverlay.appendChild(checkmark);
        successOverlay.appendChild(messageElement);
        document.body.appendChild(successOverlay);

        // Auto-remove after duration
        setTimeout(() => {
            if (successOverlay.parentNode) {
                successOverlay.style.animation = 'slideInFade 0.3s ease-out reverse';
                setTimeout(() => {
                    if (successOverlay.parentNode) {
                        successOverlay.remove();
                    }
                }, 300);
            }
        }, duration);

        console.log('✅ Success message shown:', message);
    }

    /**
     * Show temporary error message
     * @param {string} message - Error message
     * @param {number} duration - Duration to show message in milliseconds
     */
    showErrorMessage(message, duration = 3000) {
        this.hideLoadingAnimation();

        const errorOverlay = document.createElement('div');
        errorOverlay.id = 'ai-style-error-overlay';
        errorOverlay.setAttribute('data-ai-style-overlay', 'true');

        errorOverlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 999999;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 280px;
            animation: slideInFade 0.3s ease-out;
        `;

        // Add warning icon
        const warningIcon = document.createElement('div');
        warningIcon.style.cssText = `
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            flex-shrink: 0;
        `;
        warningIcon.textContent = '!';

        const messageElement = document.createElement('span');
        messageElement.textContent = message;

        errorOverlay.appendChild(warningIcon);
        errorOverlay.appendChild(messageElement);
        document.body.appendChild(errorOverlay);

        // Auto-remove after duration
        setTimeout(() => {
            if (errorOverlay.parentNode) {
                errorOverlay.style.animation = 'slideInFade 0.3s ease-out reverse';
                setTimeout(() => {
                    if (errorOverlay.parentNode) {
                        errorOverlay.remove();
                    }
                }, 300);
            }
        }, duration);

        console.log('❌ Error message shown:', message);
    }

    /**
     * Remove all overlay elements created by this class
     */
    cleanup() {
        // Remove all overlays
        const overlays = document.querySelectorAll('[data-ai-style-overlay="true"]');
        overlays.forEach(overlay => overlay.remove());

        // Remove keyframes style
        const keyframes = document.getElementById(this.keyframesId);
        if (keyframes) {
            keyframes.remove();
        }

        this.currentOverlay = null;
        this.isAnimating = false;

        console.log('🧹 Loading animations cleaned up');
    }

    /**
     * Set custom overlay position
     * @param {string} position - CSS position (e.g., 'top-left', 'bottom-right')
     */
    setOverlayPosition(position) {
        const positions = {
            'top-right': { top: '20px', right: '20px', left: 'auto', bottom: 'auto' },
            'top-left': { top: '20px', left: '20px', right: 'auto', bottom: 'auto' },
            'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' },
            'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
            'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', right: 'auto', bottom: 'auto' }
        };

        this.overlayPosition = positions[position] || positions['top-right'];
    }

    /**
     * Apply custom position to overlay if set
     * @param {HTMLElement} overlay - The overlay element
     * @private
     */
    applyCustomPosition(overlay) {
        if (this.overlayPosition) {
            Object.assign(overlay.style, this.overlayPosition);
        }
    }
}