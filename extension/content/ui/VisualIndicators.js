import { GeometryUtils } from '../utils/GeometryUtils.js';

/**
 * VisualIndicators manages overlay elements that highlight detected products
 * and provide visual feedback on product analysis results
 */
export class VisualIndicators {
    constructor(debugMode = false) {
        this.debugMode = debugMode;
        this.overlayMap = new Map(); // Track overlays by image element
        this.updateHandlers = new Map(); // Track event handlers for cleanup
        this.geometryUtils = new GeometryUtils();
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
            this.addDetectedImageIndicator(item, index);
        });

        // Add indicators for rejected images (debug mode only)
        if (this.debugMode) {
            rejectedImages.forEach((item, localIndex) => {
                this.addRejectedImageIndicator(item, localIndex);
            });
        }
    }

    /**
     * Add visual indicator for a detected clothing image
     * @param {Object} item - Image item with analysis results
     * @param {number} index - Image index for identification
     */
    addDetectedImageIndicator(item, index) {
        const img = item.element;
        const hasStyleAnalysis = item.styleAnalysis;

        // Remove existing indicators for this image
        this.removeImageIndicator(img);

        // Determine visual styling based on style score
        const styling = this.getDetectedImageStyling(hasStyleAnalysis ? item.styleAnalysis.score : null);

        // Create main border overlay
        const overlay = this.createDetectedOverlay(styling);
        this.positionOverlay(overlay, img);

        // Add style score badge if analysis is available
        let scoreBadge = null;
        if (hasStyleAnalysis) {
            scoreBadge = this.createScoreBadge(item.styleAnalysis, styling.badgeColor);
            this.positionScoreBadge(scoreBadge, img);
            document.body.appendChild(scoreBadge);
        }

        // Set data attributes and tooltip
        this.setupImageMetadata(img, item, index, 'detected');
        this.setupTooltip(img, item, hasStyleAnalysis);

        // Insert overlay into document
        document.body.appendChild(overlay);

        // Store references and setup position updates
        this.trackOverlay(img, overlay, scoreBadge, index);
        this.setupPositionUpdates(img, overlay, scoreBadge);

        console.log(`✅ Added indicator for detected image ${index + 1}`);
    }

    /**
     * Add visual indicator for a rejected image (debug mode)
     * @param {Object} item - Rejected image item
     * @param {number} index - Image index for identification
     */
    addRejectedImageIndicator(item, index) {
        const img = item.element;

        // Remove existing indicators for this image
        this.removeImageIndicator(img);

        // Create rejection overlay
        const overlay = this.createRejectedOverlay();
        this.positionOverlay(overlay, img);

        // Set data attributes and tooltip
        this.setupImageMetadata(img, item, index, 'rejected');
        this.setupRejectedTooltip(img, item);

        // Insert overlay into document
        document.body.appendChild(overlay);

        // Store references and setup position updates
        this.trackOverlay(img, overlay, null, index);
        this.setupPositionUpdates(img, overlay, null);

        console.log(`🚫 Added indicator for rejected image ${index + 1}`);
    }

    /**
     * Add visual indicator for a single image
     * @param {Object} item - Image item with analysis results
     * @param {number} index - Image index for identification
     */
    addSingleImageIndicator(item, index) {
        const img = item.element;
        const hasStyleAnalysis = item.styleAnalysis;

        // Determine styling
        const styling = this.getDetectedImageStyling(hasStyleAnalysis ? item.styleAnalysis.score : null);

        // Create overlay
        const overlay = this.createDetectedOverlay(styling);
        this.positionOverlay(overlay, img);

        // Setup metadata
        overlay.dataset.aiStyleOverlay = 'detected';
        overlay.dataset.aiStyleTargetIndex = index;

        // Add to document and track
        document.body.appendChild(overlay);
        this.trackOverlay(img, overlay, null, index);
        this.setupPositionUpdates(img, overlay, null);

        return overlay;
    }

    /**
     * Get styling configuration based on style score
     * @param {number|null} score - Style analysis score
     * @returns {Object} Styling configuration
     * @private
     */
    getDetectedImageStyling(score) {
        let borderColor = '#10b981'; // Default green
        let borderWidth = '3px';
        let glowColor = 'rgba(16, 185, 129, 0.6)';
        let badgeColor = '#10b981';

        if (score !== null) {
            if (score >= 8) {
                borderColor = '#059669'; // Darker green for high scores
                glowColor = 'rgba(5, 150, 105, 0.8)';
                borderWidth = '4px';
                badgeColor = '#059669';
            } else if (score >= 6) {
                borderColor = '#10b981'; // Standard green
                glowColor = 'rgba(16, 185, 129, 0.6)';
                badgeColor = '#10b981';
            } else if (score >= 4) {
                borderColor = '#f59e0b'; // Orange for medium scores
                glowColor = 'rgba(245, 158, 11, 0.6)';
                badgeColor = '#f59e0b';
            } else {
                borderColor = '#ef4444'; // Red for low scores
                glowColor = 'rgba(239, 68, 68, 0.6)';
                badgeColor = '#ef4444';
            }
        }

        return { borderColor, borderWidth, glowColor, badgeColor };
    }

    /**
     * Create overlay element for detected images
     * @param {Object} styling - Styling configuration
     * @returns {HTMLElement} Overlay element
     * @private
     */
    createDetectedOverlay(styling) {
        const overlay = document.createElement('div');
        overlay.className = 'ai-style-detected-overlay';
        overlay.style.cssText = `
            position: absolute;
            pointer-events: none;
            border: ${styling.borderWidth} solid ${styling.borderColor};
            border-radius: 6px;
            box-shadow: 0 0 15px ${styling.glowColor};
            z-index: 10000;
            top: -3px;
            left: -3px;
            right: -3px;
            bottom: -3px;
        `;
        return overlay;
    }

    /**
     * Create overlay element for rejected images
     * @returns {HTMLElement} Overlay element
     * @private
     */
    createRejectedOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'ai-style-rejected-overlay';
        overlay.style.cssText = `
            position: absolute;
            pointer-events: none;
            border: 2px solid #ef4444;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
            z-index: 9999;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
        `;
        return overlay;
    }

    /**
     * Create style score badge
     * @param {Object} styleAnalysis - Style analysis results
     * @param {string} badgeColor - Badge background color
     * @returns {HTMLElement} Badge element
     * @private
     */
    createScoreBadge(styleAnalysis, badgeColor) {
        const scoreBadge = document.createElement('div');
        scoreBadge.className = 'ai-style-score-badge';
        scoreBadge.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: ${badgeColor};
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 10001;
            pointer-events: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        scoreBadge.textContent = `${styleAnalysis.score}`;
        scoreBadge.dataset.aiStyleOverlay = 'score-badge';
        return scoreBadge;
    }

    /**
     * Position overlay relative to image element
     * @param {HTMLElement} overlay - Overlay element
     * @param {HTMLImageElement} img - Target image element
     */
    positionOverlay(overlay, img) {
        this.geometryUtils.positionOverlay(overlay, img);
    }

    /**
     * Position score badge relative to image element
     * @param {HTMLElement} badge - Badge element
     * @param {HTMLImageElement} img - Target image element
     */
    positionScoreBadge(badge, img) {
        this.geometryUtils.positionScoreBadge(badge, img);
    }

    /**
     * Setup image metadata and data attributes
     * @param {HTMLImageElement} img - Image element
     * @param {Object} item - Image analysis item
     * @param {number} index - Image index
     * @param {string} type - Type of indicator ('detected' or 'rejected')
     * @private
     */
    setupImageMetadata(img, item, index, type) {
        if (type === 'detected') {
            img.dataset.aiStyleDetected = 'true';
            img.dataset.aiStyleIndex = index;
        } else if (type === 'rejected') {
            img.dataset.aiStyleRejected = 'true';
            img.dataset.aiStyleRejectIndex = index;
        }
    }

    /**
     * Setup tooltip for detected images
     * @param {HTMLImageElement} img - Image element
     * @param {Object} item - Image analysis item
     * @param {boolean} hasStyleAnalysis - Whether style analysis is available
     * @private
     */
    setupTooltip(img, item, hasStyleAnalysis) {
        let tooltipText = `AI Style Filter: Detected clothing image
Method: ${item.method}
Reason: ${item.reasoning}`;

        if (item.quality && item.quality.dimensions) {
            tooltipText += `
Size: ${Math.round(item.quality.dimensions.display.width)}x${Math.round(item.quality.dimensions.display.height)}`;
        }

        if (hasStyleAnalysis) {
            tooltipText += `
Style Score: ${item.styleAnalysis.score}/10 (${Math.round(item.styleAnalysis.confidence * 100)}% confidence)
Analysis: ${item.styleAnalysis.reasoning}`;
        }

        img.title = tooltipText;
    }

    /**
     * Setup tooltip for rejected images
     * @param {HTMLImageElement} img - Image element
     * @param {Object} item - Rejected image item
     * @private
     */
    setupRejectedTooltip(img, item) {
        img.title = `AI Style Filter: Rejected (${item.method})
Reason: ${item.reason}`;
    }

    /**
     * Track overlay elements for cleanup and updates
     * @param {HTMLImageElement} img - Image element
     * @param {HTMLElement} overlay - Main overlay element
     * @param {HTMLElement|null} scoreBadge - Score badge element (optional)
     * @param {number} index - Image index
     * @private
     */
    trackOverlay(img, overlay, scoreBadge, index) {
        const overlayData = {
            overlay,
            scoreBadge,
            index,
            img
        };

        this.overlayMap.set(img, overlayData);

        // Set data attributes for cleanup
        overlay.dataset.aiStyleOverlay = 'detected';
        overlay.dataset.aiStyleTargetIndex = index;

        if (scoreBadge) {
            scoreBadge.dataset.aiStyleTargetIndex = index;
        }
    }

    /**
     * Setup position update event handlers
     * @param {HTMLImageElement} img - Image element
     * @param {HTMLElement} overlay - Main overlay element
     * @param {HTMLElement|null} scoreBadge - Score badge element (optional)
     * @private
     */
    setupPositionUpdates(img, overlay, scoreBadge) {
        const updatePosition = () => this.positionOverlay(overlay, img);
        const updateBadgePosition = scoreBadge ? () => this.positionScoreBadge(scoreBadge, img) : null;

        // Store handlers for cleanup
        const handlers = { updatePosition, updateBadgePosition };
        this.updateHandlers.set(img, handlers);

        // Add event listeners
        window.addEventListener('scroll', updatePosition);
        window.addEventListener('resize', updatePosition);

        if (updateBadgePosition) {
            window.addEventListener('scroll', updateBadgePosition);
            window.addEventListener('resize', updateBadgePosition);
        }
    }

    /**
     * Remove visual indicator for specific image
     * @param {HTMLImageElement} img - Image element
     */
    removeImageIndicator(img) {
        const overlayData = this.overlayMap.get(img);
        if (overlayData) {
            // Remove overlay elements
            if (overlayData.overlay && overlayData.overlay.parentNode) {
                overlayData.overlay.remove();
            }
            if (overlayData.scoreBadge && overlayData.scoreBadge.parentNode) {
                overlayData.scoreBadge.remove();
            }

            // Remove event handlers
            const handlers = this.updateHandlers.get(img);
            if (handlers) {
                window.removeEventListener('scroll', handlers.updatePosition);
                window.removeEventListener('resize', handlers.updatePosition);
                if (handlers.updateBadgePosition) {
                    window.removeEventListener('scroll', handlers.updateBadgePosition);
                    window.removeEventListener('resize', handlers.updateBadgePosition);
                }
                this.updateHandlers.delete(img);
            }

            // Clean up tracking
            this.overlayMap.delete(img);

            // Clean up image data attributes
            delete img.dataset.aiStyleDetected;
            delete img.dataset.aiStyleIndex;
            delete img.dataset.aiStyleRejected;
            delete img.dataset.aiStyleRejectIndex;

            if (img.title && img.title.includes('AI Style Filter')) {
                img.title = '';
            }
        }
    }

    /**
     * Clear all product detection indicators
     */
    clearProductDetection() {
        console.log('🧹 Clearing all visual indicators...');

        // Remove all overlay elements
        const overlays = document.querySelectorAll('[data-ai-style-overlay]');
        overlays.forEach(overlay => overlay.remove());

        // Clear all event handlers
        this.updateHandlers.forEach((handlers, img) => {
            window.removeEventListener('scroll', handlers.updatePosition);
            window.removeEventListener('resize', handlers.updatePosition);
            if (handlers.updateBadgePosition) {
                window.removeEventListener('scroll', handlers.updateBadgePosition);
                window.removeEventListener('resize', handlers.updateBadgePosition);
            }
        });

        // Clear image data attributes and titles
        const detectedImages = document.querySelectorAll('[data-ai-style-detected]');
        detectedImages.forEach(img => {
            delete img.dataset.aiStyleDetected;
            delete img.dataset.aiStyleIndex;
            if (img.title && img.title.includes('AI Style Filter')) {
                img.title = '';
            }
        });

        const rejectedImages = document.querySelectorAll('[data-ai-style-rejected]');
        rejectedImages.forEach(img => {
            delete img.dataset.aiStyleRejected;
            delete img.dataset.aiStyleRejectIndex;
            if (img.title && img.title.includes('AI Style Filter')) {
                img.title = '';
            }
        });

        // Clear internal tracking
        this.overlayMap.clear();
        this.updateHandlers.clear();

        console.log('✅ All visual indicators cleared');
    }

    /**
     * Update positions of all tracked overlays
     */
    updateAllPositions() {
        this.overlayMap.forEach((overlayData, img) => {
            this.positionOverlay(overlayData.overlay, img);
            if (overlayData.scoreBadge) {
                this.positionScoreBadge(overlayData.scoreBadge, img);
            }
        });
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`🐛 Visual indicators debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get statistics about current indicators
     * @returns {Object} Statistics object
     */
    getIndicatorStats() {
        const overlays = document.querySelectorAll('[data-ai-style-overlay]');
        const detectedImages = document.querySelectorAll('[data-ai-style-detected="true"]');
        const rejectedImages = document.querySelectorAll('[data-ai-style-rejected="true"]');
        const scoreBadges = document.querySelectorAll('[data-ai-style-overlay="score-badge"]');

        return {
            totalOverlays: overlays.length,
            detectedImages: detectedImages.length,
            rejectedImages: rejectedImages.length,
            scoreBadges: scoreBadges.length,
            trackedOverlays: this.overlayMap.size,
            activeHandlers: this.updateHandlers.size
        };
    }

    /**
     * Cleanup all resources
     */
    cleanup() {
        this.clearProductDetection();
        console.log('🧹 Visual indicators cleanup complete');
    }
}