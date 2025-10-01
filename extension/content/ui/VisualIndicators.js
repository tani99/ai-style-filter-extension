import { GeometryUtils } from '../utils/GeometryUtils.js';

/**
 * VisualIndicators manages overlay elements that highlight detected products
 */
export class VisualIndicators {
    constructor(debugMode = false, filterStateManager = null) {
        this.debugMode = debugMode;
        this.filterStateManager = filterStateManager;
        this.overlayMap = new Map(); // Track overlays by image element
        this.updateHandlers = new Map(); // Track event handlers for cleanup
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
     * Simple green border, no scores
     * @param {Object} item - Image item
     * @param {number} index - Image index for identification
     */
    addDetectedImageIndicator(item, index) {
        const img = item.element;

        // Remove existing indicators for this image
        this.removeImageIndicator(img);

        // Create main border overlay (basic green)
        const overlay = this.createDetectedOverlay();
        this.positionOverlay(overlay, img);

        // Set data attributes
        img.dataset.aiStyleDetected = 'true';
        img.dataset.aiStyleIndex = index;

        // Add tooltip
        img.title = `Detected clothing item ${index + 1}`;

        // Insert overlay into document
        document.body.appendChild(overlay);

        // Store references and setup position updates
        this.trackOverlay(img, overlay, null, index);
        this.setupPositionUpdates(img, overlay);

        console.log(`✅ Added indicator for detected image ${index + 1}`);
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
        this.positionOverlay(overlay, img);

        // Set data attributes and tooltip
        img.dataset.aiStyleDetected = 'false';
        img.dataset.aiStyleRejected = 'true';
        img.title = `Rejected: ${item.reason}`;

        // Insert overlay into document
        document.body.appendChild(overlay);

        // Store references and setup position updates
        this.trackOverlay(img, overlay, null, index);
        this.setupPositionUpdates(img, overlay);

        console.log(`🚫 Added indicator for rejected image ${index + 1}`);
    }

    /**
     * Create overlay element for detected images
     * Basic green border only
     * @returns {HTMLElement} Overlay element
     */
    createDetectedOverlay() {
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
     * Create overlay element for rejected images
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
     * Position overlay relative to image element
     * @param {HTMLElement} overlay - Overlay element
     * @param {HTMLImageElement} img - Target image element
     */
    positionOverlay(overlay, img) {
        GeometryUtils.positionOverlay(overlay, img);
    }

    /**
     * Track overlay elements for cleanup and updates
     * @param {HTMLImageElement} img - Image element
     * @param {HTMLElement} overlay - Main overlay element
     * @param {HTMLElement|null} scoreBadge - Score badge element (unused, kept for compatibility)
     * @param {number} index - Image index
     */
    trackOverlay(img, overlay, scoreBadge, index) {
        const overlayData = {
            overlay,
            scoreBadge: null, // No score badges anymore
            index,
            img
        };

        this.overlayMap.set(img, overlayData);

        // Set data attributes for cleanup
        overlay.dataset.aiStyleOverlay = 'detected';
        overlay.dataset.aiStyleTargetIndex = index;
    }

    /**
     * Setup position update event handlers
     * @param {HTMLImageElement} img - Image element
     * @param {HTMLElement} overlay - Main overlay element
     */
    setupPositionUpdates(img, overlay) {
        const updatePosition = () => this.positionOverlay(overlay, img);

        // Store handlers for cleanup
        const handlers = { updatePosition };
        this.updateHandlers.set(img, handlers);

        // Add event listeners for position updates
        window.addEventListener('scroll', updatePosition, { passive: true });
        window.addEventListener('resize', updatePosition);
    }

    /**
     * Add score overlay to a detected product image
     * Shows compatibility score (1-10) with color-coded badge
     * @param {HTMLImageElement} img - Image element
     * @param {number} score - Compatibility score (1-10)
     * @param {string} reasoning - Analysis reasoning
     * @param {number} index - Image index
     */
    addScoreOverlay(img, score, reasoning, index) {
        console.log(`🏷️ addScoreOverlay called for image ${index + 1}:`, {
            score,
            reasoning,
            imgAlt: img.alt,
            imgSrc: img.src.substring(0, 60) + '...'
        });

        // Get existing overlay data
        const overlayData = this.overlayMap.get(img);
        console.log('   Overlay data:', overlayData ? 'FOUND' : 'NOT FOUND');

        if (!overlayData) {
            console.warn('⚠️ No overlay found for image, cannot add score');
            console.log('   Overlay map size:', this.overlayMap.size);
            console.log('   Image in map?', this.overlayMap.has(img));
            return;
        }

        // Remove existing score badge if any
        if (overlayData.scoreBadge && overlayData.scoreBadge.parentNode) {
            console.log('   Removing existing score badge');
            overlayData.scoreBadge.remove();
            overlayData.scoreBadge = null;
        }

        // Also remove any orphaned badges with the same target index (cleanup)
        document.querySelectorAll(`[data-ai-style-score-badge][data-target-index="${index}"]`).forEach(badge => {
            console.log('   Removing orphaned badge for index', index);
            badge.remove();
        });

        // Create score badge
        console.log('   Creating score badge...');
        const scoreBadge = this.createScoreBadge(score, reasoning);
        console.log('   Score badge created:', scoreBadge);

        console.log('   Positioning score badge...');
        this.positionScoreBadge(scoreBadge, img);
        console.log('   Badge position:', {
            top: scoreBadge.style.top,
            left: scoreBadge.style.left
        });

        // Insert score badge into document
        console.log('   Appending badge to document.body');
        document.body.appendChild(scoreBadge);
        console.log('   Badge appended, parent:', scoreBadge.parentNode);

        // Update tracking
        overlayData.scoreBadge = scoreBadge;
        overlayData.score = score;
        overlayData.reasoning = reasoning;

        // Set highlight attribute for high scores (8-10)
        if (score >= 8) {
            overlayData.overlay.dataset.aiHighlighted = 'true';
        } else {
            overlayData.overlay.dataset.aiHighlighted = 'false';
        }

        // Update image attributes
        img.dataset.aiStyleScore = score;
        img.title = `Score: ${score}/10 - ${reasoning}`;

        // Set filter state attributes for CSS reactivity
        if (this.filterStateManager) {
            const filterState = this.filterStateManager.getFilterState();
            img.dataset.aiFilterMode = filterState.mode;
            img.dataset.aiScoreThreshold = filterState.scoreThreshold;
            console.log('   Filter state attributes set:', {
                mode: filterState.mode,
                threshold: filterState.scoreThreshold
            });
        } else {
            console.warn('   ⚠️ No filterStateManager available - filter state not set');
        }

        console.log('   Image data attributes updated');

        // Add scroll/resize handlers for score badge
        const updateScoreBadgePosition = () => this.positionScoreBadge(scoreBadge, img);
        const handlers = this.updateHandlers.get(img);
        if (handlers) {
            handlers.updateScoreBadgePosition = updateScoreBadgePosition;
            window.addEventListener('scroll', updateScoreBadgePosition, { passive: true });
            window.addEventListener('resize', updateScoreBadgePosition);
            console.log('   Event handlers added');
        } else {
            console.warn('   ⚠️ No handlers found for image');
        }

        console.log(`✅ Added score overlay ${score}/10 for image ${index + 1}`);
    }

    /**
     * Create score badge element
     * @param {number} score - Compatibility score (1-10)
     * @param {string} reasoning - Analysis reasoning
     * @returns {HTMLElement} Score badge element
     */
    createScoreBadge(score, reasoning) {
        const badge = document.createElement('div');
        badge.className = 'ai-style-score-badge';

        // Determine color and content based on score
        let backgroundColor, textColor, badgeContent;
        if (score >= 9) {
            // Perfect match: cute yellow badge at top center with sparkle
            badge.style.cssText = `
                position: absolute;
                background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                color: #78350f;
                font-weight: 800;
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4), 0 0 15px rgba(251, 191, 36, 0.3);
                z-index: 9999;
                pointer-events: auto;
                cursor: help;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                display: flex;
                align-items: center;
                gap: 3px;
                border: 2px solid #fef3c7;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                animation: perfectMatchPulse 2s ease-in-out infinite;
            `;

            // Add sparkle emoji and text
            badge.innerHTML = `
                <span style="font-size: 12px;">✨</span>
                <span style="font-weight: 800;">Perfect Match</span>
                <span style="font-size: 12px;">✨</span>
            `;
            badge.title = `${score}/10 - ${reasoning}`;
            badge.dataset.aiStyleScoreBadge = 'perfect';

            // Add animation keyframes if not already added
            this.ensurePerfectMatchAnimation();

            return badge;
        } else if (score >= 8) {
            // Excellent match: green
            backgroundColor = '#10b981';
            textColor = '#ffffff';
            badgeContent = `${score}`;
        } else if (score >= 6) {
            // Good match: blue
            backgroundColor = '#3b82f6';
            textColor = '#ffffff';
            badgeContent = `${score}`;
        } else if (score >= 4) {
            // Neutral: yellow
            backgroundColor = '#f59e0b';
            textColor = '#000000';
            badgeContent = `${score}`;
        } else {
            // Poor match: red
            backgroundColor = '#ef4444';
            textColor = '#ffffff';
            badgeContent = `${score}`;
        }

        badge.style.cssText = `
            position: absolute;
            background-color: ${backgroundColor};
            color: ${textColor};
            font-weight: bold;
            font-size: 18px;
            padding: 8px 12px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 9999;
            pointer-events: auto;
            cursor: help;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-width: 40px;
            text-align: center;
        `;

        badge.textContent = badgeContent;
        badge.title = reasoning;
        badge.dataset.aiStyleScoreBadge = 'true';

        return badge;
    }

    /**
     * Ensure perfect match animation CSS is added to document
     * @private
     */
    ensurePerfectMatchAnimation() {
        if (!document.querySelector('#ai-style-perfect-match-animation')) {
            const style = document.createElement('style');
            style.id = 'ai-style-perfect-match-animation';
            style.textContent = `
                @keyframes perfectMatchPulse {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4), 0 0 15px rgba(251, 191, 36, 0.3);
                    }
                    50% {
                        transform: scale(1.08);
                        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.6), 0 0 25px rgba(251, 191, 36, 0.5);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Position score badge at top-right or top-center of image
     * Perfect Match badges (9-10) go to top-center, straddling the border (half in, half out)
     * @param {HTMLElement} badge - Score badge element
     * @param {HTMLImageElement} img - Target image element
     */
    positionScoreBadge(badge, img) {
        const rect = img.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Check if this is a Perfect Match badge
        if (badge.dataset.aiStyleScoreBadge === 'perfect') {
            // Position at top-center of image, straddling the top border
            // Half of badge above image, half below (sitting on the border line)
            const badgeWidth = badge.offsetWidth || 120; // Approximate width if not yet rendered
            const badgeHeight = badge.offsetHeight || 24; // Approximate height

            // Center horizontally
            badge.style.left = `${rect.left + scrollLeft + (rect.width / 2) - (badgeWidth / 2)}px`;

            // Position vertically so badge straddles the top border (half in, half out)
            badge.style.top = `${rect.top + scrollTop - (badgeHeight / 2)}px`;
        } else {
            // Regular badges at top-right
            badge.style.top = `${rect.top + scrollTop + 8}px`;
            badge.style.left = `${rect.right + scrollLeft - 60}px`; // 60px from right edge
        }
    }

    /**
     * Add loading indicator to a detected product image while analysis is in progress
     * @param {HTMLImageElement} img - Image element
     * @param {number} index - Image index
     */
    addLoadingIndicator(img, index) {
        console.log(`⏳ Adding loading indicator for image ${index + 1}`);

        // Get existing overlay data
        const overlayData = this.overlayMap.get(img);
        if (!overlayData) {
            console.warn('⚠️ No overlay found for image, cannot add loading indicator');
            return;
        }

        // Remove existing loading indicator or score badge if any
        if (overlayData.scoreBadge && overlayData.scoreBadge.parentNode) {
            overlayData.scoreBadge.remove();
        }

        // Create loading badge
        const loadingBadge = this.createLoadingBadge();
        this.positionScoreBadge(loadingBadge, img);

        // Insert loading badge into document
        document.body.appendChild(loadingBadge);

        // Update tracking
        overlayData.scoreBadge = loadingBadge;
        overlayData.isLoading = true;

        // Add scroll/resize handlers for loading badge
        const updateLoadingBadgePosition = () => this.positionScoreBadge(loadingBadge, img);
        const handlers = this.updateHandlers.get(img);
        if (handlers) {
            handlers.updateScoreBadgePosition = updateLoadingBadgePosition;
            window.addEventListener('scroll', updateLoadingBadgePosition, { passive: true });
            window.addEventListener('resize', updateLoadingBadgePosition);
        }

        console.log(`✅ Added loading indicator for image ${index + 1}`);
    }

    /**
     * Create loading badge element with spinner
     * @returns {HTMLElement} Loading badge element
     */
    createLoadingBadge() {
        const badge = document.createElement('div');
        badge.className = 'ai-style-score-badge';
        badge.dataset.aiStyleScoreBadge = 'loading';

        badge.style.cssText = `
            position: absolute;
            z-index: 999999;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 8px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            font-size: 11px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            pointer-events: none;
            user-select: none;
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255,255,255,0.3);
            width: 52px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Add spinner
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 12px;
            height: 12px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s linear infinite;
        `;

        badge.appendChild(spinner);

        // Ensure spinner animation exists
        this.ensureSpinnerAnimation();

        return badge;
    }

    /**
     * Ensure spinner animation CSS is added to document
     * @private
     */
    ensureSpinnerAnimation() {
        if (!document.querySelector('#ai-style-spinner-animation')) {
            const style = document.createElement('style');
            style.id = 'ai-style-spinner-animation';
            style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Remove visual indicator from an image
     * @param {HTMLImageElement} img - Image element
     */
    removeImageIndicator(img) {
        const overlayData = this.overlayMap.get(img);
        if (overlayData) {
            // Remove overlay elements
            if (overlayData.overlay && overlayData.overlay.parentNode) {
                overlayData.overlay.remove();
            }

            // Remove score badge if exists
            if (overlayData.scoreBadge && overlayData.scoreBadge.parentNode) {
                overlayData.scoreBadge.remove();
            }

            // Remove event handlers
            const handlers = this.updateHandlers.get(img);
            if (handlers) {
                if (handlers.updatePosition) {
                    window.removeEventListener('scroll', handlers.updatePosition);
                    window.removeEventListener('resize', handlers.updatePosition);
                }
                if (handlers.updateScoreBadgePosition) {
                    window.removeEventListener('scroll', handlers.updateScoreBadgePosition);
                    window.removeEventListener('resize', handlers.updateScoreBadgePosition);
                }
                this.updateHandlers.delete(img);
            }

            // Clean up tracking
            this.overlayMap.delete(img);

            // Clean up image data attributes
            delete img.dataset.aiStyleDetected;
            delete img.dataset.aiStyleIndex;
            delete img.dataset.aiStyleScore;
        }
    }

    /**
     * Clear all product detection visual indicators
     */
    clearProductDetection() {
        console.log('🧹 Clearing all visual indicators...');

        // Remove all overlay elements
        const overlays = document.querySelectorAll('[data-ai-style-overlay]');
        overlays.forEach(overlay => overlay.remove());

        // Remove all score badges
        const scoreBadges = document.querySelectorAll('[data-ai-style-score-badge]');
        scoreBadges.forEach(badge => badge.remove());

        // Clear all event handlers
        this.updateHandlers.forEach((handlers, img) => {
            if (handlers.updatePosition) {
                window.removeEventListener('scroll', handlers.updatePosition);
                window.removeEventListener('resize', handlers.updatePosition);
            }
            if (handlers.updateScoreBadgePosition) {
                window.removeEventListener('scroll', handlers.updateScoreBadgePosition);
                window.removeEventListener('resize', handlers.updateScoreBadgePosition);
            }
        });

        // Clear image data attributes
        const markedImages = document.querySelectorAll('[data-ai-style-detected]');
        markedImages.forEach(img => {
            delete img.dataset.aiStyleDetected;
            delete img.dataset.aiStyleIndex;
            delete img.dataset.aiStyleRejected;
            delete img.dataset.aiStyleScore;
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
        });
    }

    /**
     * Set debug mode
     * @param {boolean} enabled - Enable or disable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Get indicator statistics
     * @returns {Object} Statistics object
     */
    getIndicatorStats() {
        const overlays = document.querySelectorAll('[data-ai-style-overlay]');
        const detectedImages = document.querySelectorAll('[data-ai-style-detected="true"]');
        const rejectedImages = document.querySelectorAll('[data-ai-style-rejected="true"]');

        return {
            totalOverlays: overlays.length,
            detectedImages: detectedImages.length,
            rejectedImages: rejectedImages.length,
            trackedOverlays: this.overlayMap.size,
            activeHandlers: this.updateHandlers.size
        };
    }

    /**
     * Apply visual filtering effects based on filter state
     * Uses CSS data attributes for reactive styling
     * @param {Object} filterState - Filter state object
     */
    applyFilterEffects(filterState) {
        console.log('🎨 Applying filter effects via CSS data attributes:', filterState);

        const { mode, scoreThreshold } = filterState;

        // Update all tracked images with new filter state
        // CSS will automatically handle the visual styling
        this.overlayMap.forEach((overlayData, img) => {
            // Update data attributes - CSS rules will react automatically
            img.dataset.aiFilterMode = mode;
            img.dataset.aiScoreThreshold = scoreThreshold;

            // Update highlight attribute for high scores (CSS will handle the styling)
            if (overlayData.score >= 8 && mode === 'myStyle') {
                overlayData.overlay.dataset.aiHighlighted = 'true';
            } else {
                overlayData.overlay.dataset.aiHighlighted = 'false';
            }
        });

        console.log('✅ Filter data attributes updated - CSS is now handling visual effects');
    }

    /**
     * LEGACY METHOD - Kept for backward compatibility
     * CSS now handles styling via data attributes
     * @deprecated Use data attributes instead
     */
    dimProduct(img) {
        console.warn('⚠️ dimProduct() is deprecated - CSS handles styling automatically');
    }

    /**
     * LEGACY METHOD - Kept for backward compatibility
     * CSS now handles styling via data attributes
     * @deprecated Use data attributes instead
     */
    highlightProduct(img) {
        console.warn('⚠️ highlightProduct() is deprecated - CSS handles styling automatically');
    }

    /**
     * LEGACY METHOD - Kept for backward compatibility
     * CSS now handles styling via data attributes
     * @deprecated Use data attributes instead
     */
    setImageOpacity(img, opacity) {
        console.warn('⚠️ setImageOpacity() is deprecated - CSS handles styling automatically');
    }

    /**
     * LEGACY METHOD - Kept for backward compatibility
     * CSS now handles styling via data attributes
     * @deprecated Use data attributes instead
     */
    setImageHighlight(img, enabled) {
        console.warn('⚠️ setImageHighlight() is deprecated - CSS handles styling automatically');
    }

    /**
     * Find parent product card element
     * @param {HTMLImageElement} img - Image element
     * @returns {HTMLElement|null} Product card element
     * @private
     */
    findProductCard(img) {
        // Try to find common product card selectors
        const selectors = [
            '.product-card',
            '.product-item',
            '.product',
            '[class*="product"]',
            '[data-product]',
            'article',
            '.card'
        ];

        let element = img.parentElement;
        let depth = 0;
        const maxDepth = 5;

        while (element && depth < maxDepth) {
            for (const selector of selectors) {
                if (element.matches && element.matches(selector)) {
                    return element;
                }
            }
            element = element.parentElement;
            depth++;
        }

        return null;
    }

    /**
     * Clear all filter effects and restore normal appearance
     * Sets filter mode to 'all' via data attributes
     */
    clearFilterEffects() {
        console.log('🧹 Clearing filter effects...');

        this.overlayMap.forEach((overlayData, img) => {
            // Set mode to 'all' - CSS will handle restoring normal appearance
            img.dataset.aiFilterMode = 'all';

            // Clear highlight
            overlayData.overlay.dataset.aiHighlighted = 'false';
        });

        console.log('✅ Filter effects cleared via data attributes');
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.VisualIndicators = VisualIndicators;
}