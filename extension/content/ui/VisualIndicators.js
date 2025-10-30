import { GeometryUtils } from '../utils/GeometryUtils.js';
// TryOnOverlays removed; eye icon now managed by ScoreBadgeManager

/**
 * VisualIndicators manages overlay elements that highlight detected products
 * Now delegates to specialized classes for score and try-on functionality
 */
export class VisualIndicators {
    constructor(debugMode = false) {
        this.debugMode = debugMode;
        this.overlayMap = new Map(); // Track overlays by image element
        this.updateHandlers = new Map(); // Track event handlers for cleanup
        this.globalUpdaterSetup = false; // Flag to ensure global updater is setup only once

        // Reference to ScoreBadgeManager (injected by controller)
        this.scoreBadgeManager = null;
    }

    /**
     * Inject ScoreBadgeManager for eye icon management
     * @param {Object} manager - instance of ScoreBadgeManager
     */
    setScoreBadgeManager(manager) {
        this.scoreBadgeManager = manager;
    }

    /**
     * Add visual indicators for multiple images
     * @param {Array} detectedImages - Array of detected image objects
     * @param {Array} rejectedImages - Array of rejected image objects
     * @param {number} startIndex - Starting index for numbering
     */
    addVisualIndicators(detectedImages, rejectedImages = [], startIndex = 0) {
        console.log('🎨 Adding visual indicators...');

        // Add indicators for detected images
        detectedImages.forEach((item, localIndex) => {
            const index = startIndex + localIndex;
            this.addDetectedItemOverlays(item, index);
        });

        // Add indicators for rejected images (debug mode only)
        if (this.debugMode) {
            rejectedImages.forEach((item, localIndex) => {
                this.addRejectedImageIndicator(item, localIndex);
            });
        }
    }

    /**
     * Add detected item overlays to an image
     * Creates visual overlays with eye icon for virtual try-on (green border disabled)
     * @param {Object} item - Image item
     * @param {number} index - Image index for identification
     */
    addDetectedItemOverlays(item, index) {
        const img = item.element;

        // Remove existing indicators for this image
        this.removeImageIndicator(img);

        // Green border overlay is now disabled
        // const overlay = this.createGreenBorderOverlay();

        // Create and show eye icon via ScoreBadgeManager
        const eyeIcon = this.scoreBadgeManager ? this.scoreBadgeManager.showEyeIcon(img) : null;
        const altText = item.imageInfo?.alt || '';
        if (eyeIcon) {
            eyeIcon.dataset.imageAltText = altText;
        }

        // Set data attributes
        // clothingItemDetected: 'true' = confirmed clothing item, 'false' = not clothing, undefined = not analyzed
        img.dataset.clothingItemDetected = 'true';
        img.dataset.aiStyleDetected = 'true'; // For StyleOverlayController to find images
        img.dataset.detectionIndex = index;

        // Add tooltip
        img.title = `Detected clothing item ${index + 1}`;

        // Inserted by ScoreBadgeManager.showEyeIcon()

        // Store references (no overlay). Position updates are handled by ScoreBadgeManager
        this.trackOverlay(img, null, index, eyeIcon);

        // Position handled by ScoreBadgeManager

        // Individual indicator logs removed - will show summary table instead
    }

    /**
     * Add indicator for rejected images (debug mode only)
     * @param {Object} item - Rejected image item
     * @param {number} index - Image index
     */
    addRejectedImageIndicator(item, index) {
        const img = item.element;

        // Remove existing indicators for this image
        this.removeImageIndicator(img);

        // Create rejection overlay
        const overlay = this.createRejectedOverlay();

        // Set data attributes and tooltip
        img.dataset.clothingItemDetected = 'false';  // Not a clothing item
        img.dataset.detectionIndex = index;
        img.title = `Rejected image ${index + 1}`;

        // Insert overlay into document
        document.body.appendChild(overlay);

        // Store references and setup position updates
        this.trackOverlay(img, overlay, index);
        this.setupPositionUpdates(img, overlay);

        // Position overlay after ensuring image is loaded
        this.ensureImageLoadedAndPosition(img, overlay, null);

        // Individual indicator logs removed - will show summary table instead
    }

    /**
     * Create green border overlay for detected items
     * @returns {HTMLElement} Overlay element
     */
    createGreenBorderOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'ai-style-detected-overlay';
        overlay.style.cssText = `
            position: absolute;
            pointer-events: none;
            border: 3px solid #10b981;
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
            border-radius: 4px;
            z-index: 9998;
            top: 0;
            left: 0;
            right: -3px;
            bottom: -3px;
        `;
        overlay.dataset.aiStyleOverlay = 'detected';
        return overlay;
    }

    /**
     * Create rejection overlay for non-clothing items
     * @returns {HTMLElement} Overlay element
     */
    createRejectedOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'ai-style-rejected-overlay';
        overlay.style.cssText = `
            position: absolute;
            pointer-events: none;
            border: 2px solid #ef4444;
            border-radius: 4px;
            z-index: 9998;
            opacity: 0.5;
            top: 0;
            left: 0;
            right: -2px;
            bottom: -2px;
        `;
        overlay.dataset.aiStyleOverlay = 'rejected';
        return overlay;
    }

    /**
     * Position overlay relative to image
     * @param {HTMLElement} overlay - Overlay element (can be null)
     * @param {HTMLImageElement} img - Image element
     */
    positionOverlay(overlay, img) {
        if (overlay) {
            GeometryUtils.positionOverlay(overlay, img);
        }
    }

    /**
     * Ensure image is loaded and position overlays correctly
     * Position immediately for all images, handle lazy-loading via event listeners
     * @param {HTMLImageElement} img - Image element
     * @param {HTMLElement} overlay - Overlay element (can be null)
     * @param {HTMLElement} eyeIcon - Eye icon element (can be null)
     */
    ensureImageLoadedAndPosition(img, overlay, eyeIcon) {
        const positionBoth = () => {
            // Only position if image has valid dimensions
            const rect = img.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                if (overlay) {
                    this.positionOverlay(overlay, img);
                }
                if (eyeIcon && this.scoreBadgeManager) {
                    this.scoreBadgeManager.positionEyeIcon(eyeIcon, img);
                }
            } else {
                console.warn('⚠️ Image has zero dimensions, skipping positioning', img);
            }
        };

        // Position immediately, regardless of load state
        // Most images on the page have layout dimensions even if not loaded
        positionBoth();

        // If image is not fully loaded, reposition when it loads
        if (!img.complete || img.naturalHeight === 0) {
            const onLoad = () => {
                console.log('📐 Image loaded, repositioning overlay');
                positionBoth();
                img.removeEventListener('load', onLoad);
            };
            img.addEventListener('load', onLoad);
        }
    }

    /**
     * Track overlay elements for cleanup and updates
     * @param {HTMLImageElement} img - Image element
     * @param {HTMLElement} overlay - Main overlay element (can be null)
     * @param {HTMLElement|null} eyeIcon - Eye icon element for virtual try-on
     */
    trackOverlay(img, overlay, index, eyeIcon = null) {
        const overlayData = {
            overlay,
            eyeIcon,
            index,
            img
        };

        this.overlayMap.set(img, overlayData);

        // Set data attributes for easy identification
        if (overlay) {
            overlay.dataset.aiStyleTargetIndex = index;
        }
        if (eyeIcon) {
            eyeIcon.dataset.aiStyleTargetIndex = index;
        }
    }

    /**
     * Setup position update handlers for overlay and eye icon
     * Uses a global handler to update all overlays efficiently
     * @param {HTMLImageElement} img - Image element
     * @param {HTMLElement} overlay - Overlay element
     * @param {HTMLElement} eyeIcon - Eye icon element (optional)
     */
    setupPositionUpdates(img, overlay, eyeIcon = null) {
        // Store reference for global update handler
        const updateData = {
            img,
            overlay,
            eyeIcon
        };

        // Store for cleanup
        this.updateHandlers.set(img, updateData);

        // Setup global scroll/resize handler (only once)
        this.setupGlobalPositionUpdater();
    }

    /**
     * Setup a single global position updater for all overlays (performance optimization)
     */
    setupGlobalPositionUpdater() {
        if (this.globalUpdaterSetup) return;
        this.globalUpdaterSetup = true;

        const updateAllPositions = () => {
            this.updateHandlers.forEach((data) => {
                if (data.img) {
                    const rect = data.img.getBoundingClientRect();
                    // Only update if image has valid dimensions
                    if (rect.width > 0 && rect.height > 0) {
                        if (data.overlay) {
                            this.positionOverlay(data.overlay, data.img);
                        }
                        if (data.eyeIcon && this.scoreBadgeManager) {
                            this.scoreBadgeManager.positionEyeIcon(data.eyeIcon, data.img);
                        }
                    }
                }
            });
        };

        // Add global event listeners
        window.addEventListener('scroll', updateAllPositions, { passive: true });
        window.addEventListener('resize', updateAllPositions);

        console.log('✅ Global position updater setup complete');
    }


    /**
     * Remove visual indicators for a specific image
     * @param {HTMLImageElement} img - Image element
     */
    removeImageIndicator(img) {
        const overlayData = this.overlayMap.get(img);
        if (overlayData) {
        // Remove overlay if exists
        if (overlayData.overlay && overlayData.overlay.parentNode) {
            overlayData.overlay.remove();
        }

        // Remove eye icon via ScoreBadgeManager to keep state in sync
        if (this.scoreBadgeManager && overlayData.img) {
            this.scoreBadgeManager.hideEyeIcon(overlayData.img);
        } else if (overlayData.eyeIcon && overlayData.eyeIcon.parentNode) {
            // Fallback DOM removal if manager not injected
            overlayData.eyeIcon.remove();
        }

            // Remove from tracking (global handler will skip this image on next update)
            this.updateHandlers.delete(img);
            this.overlayMap.delete(img);

            // Reset image styling
            img.style.opacity = '';
            img.style.filter = '';
        }
    }

    /**
     * Clear all product detection indicators
     */
    clearProductDetection() {
        console.log('🧹 Clearing all product detection indicators...');

        // Remove all overlays
        this.overlayMap.forEach((overlayData, img) => {
            if (overlayData.overlay && overlayData.overlay.parentNode) {
                overlayData.overlay.remove();
            }
            if (this.scoreBadgeManager) {
                this.scoreBadgeManager.hideEyeIcon(img);
            } else if (overlayData.eyeIcon && overlayData.eyeIcon.parentNode) {
                overlayData.eyeIcon.remove();
            }

            // Reset image styling
            img.style.opacity = '';
            img.style.filter = '';
            img.style.display = '';
            img.style.border = '';
            img.style.boxShadow = '';
        });

        // Clear tracking maps (global handler will have nothing to update)
        this.overlayMap.clear();
        this.updateHandlers.clear();

        console.log('✅ All visual indicators cleared');
    }

    /**
     * Update positions of all overlays (useful after page changes)
     */
    updateAllPositions() {
        this.overlayMap.forEach((overlayData, img) => {
            if (overlayData.overlay) {
                this.positionOverlay(overlayData.overlay, img);
            }
            if (overlayData.eyeIcon && this.scoreBadgeManager) {
                this.scoreBadgeManager.positionEyeIcon(overlayData.eyeIcon, img);
            }
        });
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Whether debug mode is enabled
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Get statistics about current indicators
     * @returns {Object} Statistics object
     */
    getIndicatorStats() {
        return {
            totalImages: this.overlayMap.size,
            detectedImages: Array.from(this.overlayMap.values()).filter(data =>
                data.overlay && data.overlay.dataset.aiStyleOverlay === 'detected'
            ).length,
            rejectedImages: Array.from(this.overlayMap.values()).filter(data =>
                data.overlay && data.overlay.dataset.aiStyleOverlay === 'rejected'
            ).length
        };
    }


    /**
     * Clear all indicators and reset state
     */
    clearAllIndicators() {
        this.clearProductDetection();
        console.log('✅ All indicators cleared and state reset');
    }
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.VisualIndicators = VisualIndicators;
}