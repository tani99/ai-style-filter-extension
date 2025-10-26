/**
 * VirtualTryOnUI.js
 *
 * Dynamic positioning system for AI-generated virtual try-on images.
 * Manages display, positioning, and interaction for generated images
 * with intelligent viewport-aware placement.
 *
 * @example
 * import { VirtualTryOnUI } from './ui/VirtualTryOnUI.js';
 *
 * const tryOnUI = new VirtualTryOnUI();
 * await tryOnUI.showGeneratedImage(triggerImage, generatedImageUrl);
 */

export class VirtualTryOnUI {
    constructor() {
        /**
         * @type {Map<HTMLElement, Object>} Map of trigger images to their displayed overlays
         */
        this.activeOverlays = new Map();

        /**
         * @type {PositionCalculator} Position calculator instance
         */
        this.positionCalculator = null;

        /**
         * @type {Object} Event handlers for cleanup
         */
        this.eventHandlers = new Map();

        /**
         * @type {boolean} Whether UI is initialized
         */
        this.initialized = false;

        // Configuration
        this.config = {
            overlayZIndex: 10000,
            backdropZIndex: 9999,
            animationDuration: 300, // ms
            closeOnBackdropClick: true,
            closeOnEscape: true,
            repositionOnScroll: true,
            repositionOnResize: true,
            debounceDelay: 100 // ms for scroll/resize
        };

        // Debounce timers
        this.debounceTimers = new Map();
    }

    /**
     * Initialize the VirtualTryOnUI system
     * @param {PositionCalculator} positionCalculator - PositionCalculator instance
     */
    initialize(positionCalculator) {
        if (this.initialized) {
            console.warn('⚠️ VirtualTryOnUI already initialized');
            return;
        }

        this.positionCalculator = positionCalculator || window.PositionCalculator;

        if (!this.positionCalculator) {
            console.error('❌ PositionCalculator not available');
            return;
        }

        // Set up global event listeners
        if (this.config.closeOnEscape) {
            this.setupEscapeListener();
        }

        this.initialized = true;
        console.log('✅ VirtualTryOnUI initialized');
    }

    /**
     * Display a generated try-on image
     * @param {HTMLElement} triggerImage - The product image that triggered generation
     * @param {string} generatedImageUrl - URL of the generated image
     * @param {Object} options - Display options
     * @returns {Promise<HTMLElement>} The created overlay element
     */
    async showGeneratedImage(triggerImage, generatedImageUrl, options = {}) {
        if (!this.initialized) {
            console.error('❌ VirtualTryOnUI not initialized');
            return null;
        }

        // Close any existing overlay for this trigger
        this.closeOverlay(triggerImage);

        const overlay = await this.createOverlay(triggerImage, generatedImageUrl, options);

        // Track the overlay
        this.activeOverlays.set(triggerImage, {
            overlay,
            generatedImageUrl,
            options
        });

        // Add to DOM and position
        document.body.appendChild(overlay);
        this.positionOverlay(triggerImage, overlay);

        // Set up event listeners for this overlay
        this.setupOverlayListeners(triggerImage, overlay);

        // Animate in
        this.animateIn(overlay);

        return overlay;
    }

    /**
     * Create overlay element with generated image
     * @param {HTMLElement} triggerImage - Trigger image element
     * @param {string} imageUrl - Generated image URL
     * @param {Object} options - Creation options
     * @returns {Promise<HTMLElement>} Overlay element
     * @private
     */
    async createOverlay(triggerImage, imageUrl, options = {}) {
        // Create container
        const container = document.createElement('div');
        container.className = 'virtual-tryon-overlay';
        container.dataset.triggerImageId = this.getImageId(triggerImage);

        // Create backdrop (optional semi-transparent background)
        const backdrop = document.createElement('div');
        backdrop.className = 'virtual-tryon-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${this.config.backdropZIndex};
            opacity: 0;
            transition: opacity ${this.config.animationDuration}ms ease;
        `;

        // Create image container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'virtual-tryon-image-container';
        imageContainer.style.cssText = `
            position: fixed;
            background: white;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            z-index: ${this.config.overlayZIndex};
            opacity: 0;
            transform: scale(0.95);
            transition: opacity ${this.config.animationDuration}ms ease,
                        transform ${this.config.animationDuration}ms ease;
            overflow: hidden;
        `;

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.className = 'virtual-tryon-close';
        closeButton.innerHTML = '×';
        closeButton.setAttribute('aria-label', 'Close try-on preview');
        closeButton.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            width: 32px;
            height: 32px;
            border: none;
            background: rgba(0, 0, 0, 0.6);
            color: white;
            font-size: 24px;
            line-height: 1;
            border-radius: 50%;
            cursor: pointer;
            z-index: ${this.config.overlayZIndex + 1};
            transition: background 150ms ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'rgba(0, 0, 0, 0.8)';
        });
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'rgba(0, 0, 0, 0.6)';
        });

        // Create image element
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Virtual try-on preview';
        img.style.cssText = `
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        `;

        // Wait for image to load
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        // Assemble overlay
        imageContainer.appendChild(img);
        imageContainer.appendChild(closeButton);

        container.appendChild(backdrop);
        container.appendChild(imageContainer);

        // Store references
        container._backdrop = backdrop;
        container._imageContainer = imageContainer;
        container._closeButton = closeButton;
        container._image = img;

        return container;
    }

    /**
     * Position overlay using PositionCalculator
     * @param {HTMLElement} triggerImage - Trigger image element
     * @param {HTMLElement} overlay - Overlay element to position
     * @private
     */
    positionOverlay(triggerImage, overlay) {
        const triggerRect = triggerImage.getBoundingClientRect();
        const imageContainer = overlay._imageContainer;

        // Calculate optimal position
        const position = this.positionCalculator.calculateOptimalPosition(triggerRect);

        // Apply position styles
        const styles = this.positionCalculator.getPositionStyles(position, true); // Use fixed positioning
        Object.assign(imageContainer.style, styles);

        // Store position type for reference
        overlay.dataset.positionType = position.type;

        console.log(`📍 Positioned generated image: ${position.type}`, {
            x: position.x,
            y: position.y,
            triggerRect: {
                left: triggerRect.left,
                top: triggerRect.top,
                right: triggerRect.right,
                bottom: triggerRect.bottom
            }
        });
    }

    /**
     * Set up event listeners for an overlay
     * @param {HTMLElement} triggerImage - Trigger image
     * @param {HTMLElement} overlay - Overlay element
     * @private
     */
    setupOverlayListeners(triggerImage, overlay) {
        const handlers = {};

        // Close button
        handlers.close = () => this.closeOverlay(triggerImage);
        overlay._closeButton.addEventListener('click', handlers.close);

        // Backdrop click (optional)
        if (this.config.closeOnBackdropClick) {
            handlers.backdropClick = (e) => {
                if (e.target === overlay._backdrop) {
                    this.closeOverlay(triggerImage);
                }
            };
            overlay._backdrop.addEventListener('click', handlers.backdropClick);
        }

        // Reposition on scroll (debounced)
        if (this.config.repositionOnScroll) {
            handlers.scroll = this.debounce(() => {
                if (this.activeOverlays.has(triggerImage)) {
                    this.positionOverlay(triggerImage, overlay);
                }
            }, this.config.debounceDelay);
            window.addEventListener('scroll', handlers.scroll, { passive: true });
        }

        // Reposition on resize (debounced)
        if (this.config.repositionOnResize) {
            handlers.resize = this.debounce(() => {
                if (this.activeOverlays.has(triggerImage)) {
                    this.positionOverlay(triggerImage, overlay);
                }
            }, this.config.debounceDelay);
            window.addEventListener('resize', handlers.resize);
        }

        // Store handlers for cleanup
        this.eventHandlers.set(triggerImage, handlers);
    }

    /**
     * Set up global escape key listener
     * @private
     */
    setupEscapeListener() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                // Close the most recently opened overlay
                const overlays = Array.from(this.activeOverlays.keys());
                if (overlays.length > 0) {
                    this.closeOverlay(overlays[overlays.length - 1]);
                }
            }
        });
    }

    /**
     * Animate overlay in
     * @param {HTMLElement} overlay - Overlay element
     * @private
     */
    animateIn(overlay) {
        // Use requestAnimationFrame for smooth animation
        requestAnimationFrame(() => {
            overlay._backdrop.style.opacity = '1';
            overlay._imageContainer.style.opacity = '1';
            overlay._imageContainer.style.transform = 'scale(1)';
        });
    }

    /**
     * Animate overlay out
     * @param {HTMLElement} overlay - Overlay element
     * @returns {Promise<void>}
     * @private
     */
    animateOut(overlay) {
        return new Promise(resolve => {
            overlay._backdrop.style.opacity = '0';
            overlay._imageContainer.style.opacity = '0';
            overlay._imageContainer.style.transform = 'scale(0.95)';

            setTimeout(resolve, this.config.animationDuration);
        });
    }

    /**
     * Close an overlay
     * @param {HTMLElement} triggerImage - Trigger image whose overlay to close
     * @returns {Promise<void>}
     */
    async closeOverlay(triggerImage) {
        const overlayData = this.activeOverlays.get(triggerImage);
        if (!overlayData) return;

        const { overlay } = overlayData;

        // Animate out
        await this.animateOut(overlay);

        // Remove from DOM
        overlay.remove();

        // Clean up event listeners
        this.cleanupOverlayListeners(triggerImage);

        // Remove from tracking
        this.activeOverlays.delete(triggerImage);

        console.log('🗑️ Closed virtual try-on overlay');
    }

    /**
     * Clean up event listeners for an overlay
     * @param {HTMLElement} triggerImage - Trigger image
     * @private
     */
    cleanupOverlayListeners(triggerImage) {
        const handlers = this.eventHandlers.get(triggerImage);
        if (!handlers) return;

        // Remove scroll listener
        if (handlers.scroll) {
            window.removeEventListener('scroll', handlers.scroll);
        }

        // Remove resize listener
        if (handlers.resize) {
            window.removeEventListener('resize', handlers.resize);
        }

        this.eventHandlers.delete(triggerImage);
    }

    /**
     * Close all active overlays
     */
    async closeAllOverlays() {
        const closePromises = Array.from(this.activeOverlays.keys()).map(
            triggerImage => this.closeOverlay(triggerImage)
        );
        await Promise.all(closePromises);
    }

    /**
     * Get unique ID for an image element
     * @param {HTMLElement} img - Image element
     * @returns {string} Unique ID
     * @private
     */
    getImageId(img) {
        if (!img.dataset.virtualTryonId) {
            img.dataset.virtualTryonId = `vto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        return img.dataset.virtualTryonId;
    }

    /**
     * Debounce helper
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     * @private
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Check if an overlay is currently active for a trigger image
     * @param {HTMLElement} triggerImage - Trigger image
     * @returns {boolean}
     */
    hasActiveOverlay(triggerImage) {
        return this.activeOverlays.has(triggerImage);
    }

    /**
     * Get active overlay data for a trigger image
     * @param {HTMLElement} triggerImage - Trigger image
     * @returns {Object|null} Overlay data or null
     */
    getOverlayData(triggerImage) {
        return this.activeOverlays.get(triggerImage) || null;
    }

    /**
     * Update configuration
     * @param {Object} newConfig - Configuration updates
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        console.log('⚙️ VirtualTryOnUI config updated', this.config);
    }

    /**
     * Clean up and destroy the UI system
     */
    destroy() {
        // Close all overlays
        this.closeAllOverlays();

        // Clear all references
        this.activeOverlays.clear();
        this.eventHandlers.clear();
        this.debounceTimers.clear();

        this.initialized = false;
        console.log('🗑️ VirtualTryOnUI destroyed');
    }
}

// Create singleton instance
export const virtualTryOnUI = new VirtualTryOnUI();
