/**
 * ScoreBadgeManager - Manages score badges and visual effects
 * Handles progressive rendering, show/hide based on toggle state
 */
import { GeometryUtils } from '../utils/GeometryUtils.js';

export class ScoreBadgeManager {
    constructor() {
        // Track all active badges: Map<img element, badge element>
        this.activeBadges = new Map();

        // Track all active eye icons: Map<img element, eye icon element>
        this.activeEyeIcons = new Map();

        // Track overlays created from eye icon clicks (toggle visibility)
        this.eyeIconOverlays = new Map(); // Map<HTMLElement img, HTMLElement overlay>

        // Optional external try-on generator: (img, eyeIcon) => Promise<{ overlay, cached?: boolean, error?: string }>
        this.tryOnHandler = null;

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
     * Render loading spinner for an image while analysis is in progress
     * Called when analysis starts (if toggle is ON)
     * @param {HTMLImageElement} img - Image element
     */
    renderLoadingSpinner(img) {
        // Skip if toggle is OFF
        if (!this.isVisible) {
            return;
        }

        // If a badge already exists for this image, don't add a spinner
        if (this.activeBadges.has(img)) {
            return;
        }

        // Create spinner badge element
        const spinner = this.createLoadingSpinnerElement();

        // Position at top-right of image
        this.positionBadge(spinner, img);

        // Add to DOM
        document.body.appendChild(spinner);

        // Track spinner (will be replaced by actual badge)
        this.activeBadges.set(img, spinner);

        console.log(`⏳ Loading spinner rendered`);
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

        // If a spinner or badge already exists, replace it
        if (this.activeBadges.has(img)) {
            const existingBadge = this.activeBadges.get(img);
            existingBadge.remove();
            this.activeBadges.delete(img);
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
     * @param {Array} detectedProducts - Optional array of detected products with analysis status
     */
    showAllBadges(detectedProducts = null) {
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

        // Also show spinners for images currently being analyzed
        if (detectedProducts && detectedProducts.length > 0) {
            const inProgressCount = detectedProducts.filter(item => {
                if (item.analysisStatus === 'in_progress' && item.element) {
                    // Only show spinner if this image doesn't already have a badge
                    if (!this.activeBadges.has(item.element)) {
                        this.renderLoadingSpinner(item.element);
                        return true;
                    }
                }
                return false;
            }).length;

            if (inProgressCount > 0) {
                console.log(`   Showed ${inProgressCount} loading spinners for in-progress analyses`);
            }
        }

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
     * Create loading spinner badge element
     * @returns {HTMLElement} Spinner badge element
     */
    createLoadingSpinnerElement() {
        const badge = document.createElement('div');
        badge.className = 'ai-style-score-badge ai-style-loading-spinner';

        // Create spinner icon
        const spinner = document.createElement('div');
        spinner.className = 'ai-style-spinner-icon';
        spinner.style.cssText = `
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: ai-style-spin 1s linear infinite;
        `;

        badge.appendChild(spinner);

        // Apply styling (similar to score badge but with spinner background)
        badge.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 6px 8px;
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
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Ensure spin animation keyframes exist
        this.ensureSpinAnimation();

        return badge;
    }

    /**
     * Ensure spin animation keyframes are added to document
     */
    ensureSpinAnimation() {
        const keyframesId = 'ai-style-spin-keyframes';

        if (!document.querySelector(`#${keyframesId}`)) {
            const style = document.createElement('style');
            style.id = keyframesId;
            style.textContent = `
                @keyframes ai-style-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
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

        // Determine background color based on score
        let backgroundColor;
        if (score >= 9) {
            // Yellow (golden) for top matches 9-10
            backgroundColor = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
        } else if (score >= 7) {
            // Green for good matches 7-8
            backgroundColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        } else {
            // Red for low matches below 7
            backgroundColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        }

        // Apply styling
        badge.style.cssText = `
            position: absolute;
            background: ${backgroundColor};
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 700;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            pointer-events: auto;
            user-select: none;
            white-space: nowrap;
            border: 2px solid rgba(255, 255, 255, 0.3);
            min-width: 40px;
            text-align: center;
            cursor: help;
        `;

        // Store reasoning in data attribute for easy updates
        if (reasoning && reasoning.trim()) {
            badge.dataset.reasoning = reasoning;
            badge.setAttribute('data-tooltip-setup', 'true');
            this.setupTooltip(badge);
            console.log(`📝 Tooltip setup for badge with reasoning (${reasoning.length} chars)`);
        } else {
            console.log('⚠️ No reasoning provided for badge tooltip');
        }

        return badge;
    }

    /**
     * Setup tooltip for badge that shows reasoning on hover
     * @param {HTMLElement} badge - Badge element
     */
    setupTooltip(badge) {
        let tooltip = null;
        let hideTimeout = null;

        // Ensure tooltip styles are injected
        this.ensureTooltipStyles();

        const showTooltip = (e) => {
            // Get current reasoning from data attribute
            let reasoning = badge.dataset.reasoning;
            
            // Fallback: try to get reasoning from the image element if badge doesn't have it
            if (!reasoning || !reasoning.trim()) {
                // Try to find the associated image element
                for (const [img, badgeElement] of this.activeBadges.entries()) {
                    if (badgeElement === badge && img.dataset.aiStyleReasoning) {
                        reasoning = img.dataset.aiStyleReasoning;
                        badge.dataset.reasoning = reasoning; // Store it on badge for next time
                        break;
                    }
                }
            }
            
            if (!reasoning || !reasoning.trim()) {
                console.log('⚠️ No reasoning found for badge tooltip', badge);
                return;
            }

            console.log('💡 Showing tooltip with reasoning:', reasoning.substring(0, 50) + '...');

            // Clear any pending hide timeout
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }

            // If tooltip already exists, update content and position
            if (tooltip && tooltip.isConnected) {
                tooltip.textContent = reasoning;
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
                tooltip.style.display = 'block';
                this.positionTooltip(tooltip, badge);
                return;
            }

            // Create tooltip element
            tooltip = document.createElement('div');
            tooltip.className = 'ai-style-score-tooltip';
            tooltip.textContent = reasoning;
            tooltip.style.display = 'block';
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'visible'; // Make visible for measurement but transparent
            tooltip.style.pointerEvents = 'none';
            
            // Add to DOM first
            document.body.appendChild(tooltip);
            
            // Position tooltip (will calculate dimensions while invisible)
            this.positionTooltip(tooltip, badge);
            
            // Small delay for smooth fade-in
            requestAnimationFrame(() => {
                if (tooltip && tooltip.isConnected) {
                    tooltip.style.opacity = '1';
                    tooltip.style.visibility = 'visible';
                    tooltip.style.display = 'block';
                    // Reposition after it becomes fully visible (in case dimensions changed)
                    requestAnimationFrame(() => {
                        if (tooltip && tooltip.isConnected) {
                            this.positionTooltip(tooltip, badge);
                        }
                    });
                }
            });
        };

        const hideTooltip = () => {
            if (!tooltip) return;
            
            // Fade out
            tooltip.style.opacity = '0';
            
            // Remove from DOM after fade
            hideTimeout = setTimeout(() => {
                if (tooltip) {
                    tooltip.style.visibility = 'hidden';
                    tooltip.style.display = 'none';
                    tooltip.remove();
                    tooltip = null;
                }
                hideTimeout = null;
            }, 200); // Match transition duration
        };

        // Event listeners
        badge.addEventListener('mouseenter', showTooltip);
        badge.addEventListener('mouseleave', hideTooltip);
        badge.addEventListener('mousemove', (e) => {
            if (tooltip) {
                this.positionTooltip(tooltip, badge);
            }
        });

        // Clean up on badge removal
        const observer = new MutationObserver(() => {
            if (!badge.isConnected && tooltip) {
                tooltip.remove();
                tooltip = null;
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                    hideTimeout = null;
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Position tooltip near the badge, ensuring it stays on screen
     * @param {HTMLElement} tooltip - Tooltip element
     * @param {HTMLElement} badge - Badge element
     */
    positionTooltip(tooltip, badge) {
        const badgeRect = badge.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8;

        // Ensure tooltip is in the DOM and visible for measurement
        if (!tooltip.isConnected) {
            return;
        }

        // Make sure tooltip is measurable (visible but transparent if needed)
        const currentOpacity = tooltip.style.opacity || window.getComputedStyle(tooltip).opacity;
        const currentVisibility = tooltip.style.visibility || window.getComputedStyle(tooltip).visibility;
        
        if (currentVisibility === 'hidden') {
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '0';
        }

        // Force layout recalculation
        void tooltip.offsetWidth; // Force reflow
        const tooltipWidth = tooltip.offsetWidth || 300;
        const tooltipHeight = tooltip.offsetHeight || 100;

        // Don't restore visibility here - let the showTooltip function handle it

        // Start by positioning below the badge (centered)
        let top = badgeRect.bottom + window.scrollY + padding;
        let left = badgeRect.left + window.scrollX + (badgeRect.width / 2) - (tooltipWidth / 2);

        // Adjust if tooltip goes off right edge
        if (left + tooltipWidth > window.scrollX + viewportWidth - padding) {
            left = window.scrollX + viewportWidth - tooltipWidth - padding;
        }

        // Adjust if tooltip goes off left edge
        if (left < window.scrollX + padding) {
            left = window.scrollX + padding;
        }

        // If tooltip goes off bottom, position above badge instead
        if (badgeRect.bottom + tooltipHeight + padding > viewportHeight) {
            top = badgeRect.top + window.scrollY - tooltipHeight - padding;
            // Make sure it doesn't go off top
            if (top < window.scrollY + padding) {
                top = window.scrollY + padding;
            }
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    /**
     * Ensure tooltip styles are injected into the document
     */
    ensureTooltipStyles() {
        const styleId = 'ai-style-score-tooltip-styles';

        if (!document.querySelector(`#${styleId}`)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .ai-style-score-tooltip {
                    position: absolute !important;
                    background: rgba(0, 0, 0, 0.95) !important;
                    color: white !important;
                    padding: 8px 12px !important;
                    border-radius: 6px !important;
                    font-size: 13px !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    line-height: 1.4 !important;
                    max-width: 300px !important;
                    min-width: 150px !important;
                    word-wrap: break-word !important;
                    white-space: normal !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
                    z-index: 100001 !important;
                    pointer-events: none !important;
                    user-select: none !important;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
                    border: 1px solid rgba(255, 255, 255, 0.2) !important;
                }

                .ai-style-score-badge {
                    transition: transform 0.15s ease-out;
                }

                .ai-style-score-badge:hover {
                    transform: translateX(-100%) scale(1.05) !important;
                }
            `;
            document.head.appendChild(style);
        }
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
        
        // Update reasoning in data attribute for tooltip
        if (reasoning && reasoning.trim()) {
            badge.dataset.reasoning = reasoning;
            // Setup tooltip if not already set up
            if (!badge.hasAttribute('data-tooltip-setup')) {
                this.setupTooltip(badge);
                badge.setAttribute('data-tooltip-setup', 'true');
            }
        } else {
            badge.removeAttribute('data-reasoning');
        }

        this.applyVisualEffects(img, score);
    }

    /**
     * Update all badge positions (called on scroll/resize)
     */
    updateAllPositions() {
        this.activeBadges.forEach((badge, img) => {
            if (img.isConnected) {
                this.positionBadge(badge, img);
            } else {
                badge.remove();
                this.activeBadges.delete(img);
            }
        });

        this.activeEyeIcons.forEach((eyeIcon, img) => {
            if (img.isConnected) {
                this.positionEyeIcon(eyeIcon, img);
            } else {
                eyeIcon.remove();
                this.activeEyeIcons.delete(img);
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
        this.hideAllEyeIcons();
        // Event listeners will be automatically garbage collected
    }

    /**
     * Create loading overlay for try-on generation
     * @param {HTMLImageElement} img - Original product image element
     * @returns {HTMLElement} Loading overlay element
     */
    createLoadingOverlay(img) {
        const overlay = document.createElement('div');
        overlay.className = 'ai-style-tryon-loading-overlay';

        // Get the size of the original product image (same size, not scaled)
        const rect = img.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        overlay.style.cssText = `
            position: absolute;
            top: ${rect.top + scrollY}px;
            left: ${rect.left + scrollX}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        `;

        // Create spinner
        const spinner = document.createElement('div');
        spinner.className = 'ai-style-tryon-spinner';
        spinner.style.cssText = `
            width: 48px;
            height: 48px;
            border: 4px solid rgba(255, 255, 255, 0.2);
            border-top-color: white;
            border-radius: 50%;
            animation: ai-style-spin 1s linear infinite;
            margin-bottom: 16px;
        `;

        // Create loading text
        const loadingText = document.createElement('div');
        loadingText.textContent = 'Generating...';
        loadingText.style.cssText = `
            font-size: 16px;
            font-weight: 600;
            text-align: center;
        `;

        overlay.appendChild(spinner);
        overlay.appendChild(loadingText);
        return overlay;
    }

    /**
     * Create try-on result overlay for an image
     * @param {HTMLImageElement} img - Original product image element
     * @param {string} tryonImageUrl - URL of the try-on result image
     * @param {boolean} isCached - Whether this is a cached result
     * @returns {HTMLElement} Overlay element
     */
    createTryonResultOverlay(img, tryonImageUrl, isCached = false) {
        const overlay = document.createElement('div');
        overlay.className = 'ai-style-tryon-overlay';

        // Get the size of the original product image (same size, not scaled)
        const rect = img.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        overlay.style.cssText = `
            position: absolute;
            top: ${rect.top + scrollY}px;
            left: ${rect.left + scrollX}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        `;

        // Create try-on image with same dimensions as original
        const tryonImg = document.createElement('img');
        tryonImg.src = tryonImageUrl;
        tryonImg.alt = 'Virtual try-on result';
        tryonImg.setAttribute('data-ai-generated-tryon', 'true'); // Mark as AI-generated
        tryonImg.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 4px;
        `;

        // Add cache indicator if applicable
        if (isCached) {
            const cacheIndicator = document.createElement('div');
            cacheIndicator.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(251, 191, 36, 0.9);
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
            `;
            cacheIndicator.textContent = 'Cached';
            overlay.appendChild(cacheIndicator);
        }

        overlay.appendChild(tryonImg);
        return overlay;
    }
}

// Expose on window for debugging
if (typeof window !== 'undefined') {
    window.ScoreBadgeManager = ScoreBadgeManager;
}

// Eye icon support
ScoreBadgeManager.prototype.createEyeIconElement = function() {
    const eyeIcon = document.createElement('div');
    eyeIcon.className = 'ai-style-eye-icon';
    eyeIcon.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5C7 5 2.73 8.11 1 12.5C2.73 16.89 7 20 12 20C17 20 21.27 16.89 23 12.5C21.27 8.11 17 5 12 5ZM12 17.5C9.24 17.5 7 15.26 7 12.5C7 9.74 9.24 7.5 12 7.5C14.76 7.5 17 9.74 17 12.5C17 15.26 14.76 17.5 12 17.5ZM12 9.5C10.34 9.5 9 10.84 9 12.5C9 14.16 10.34 15.5 12 15.5C13.66 15.5 15 14.16 15 12.5C15 10.84 13.66 9.5 12 9.5Z" fill="white"/>
        </svg>
    `;
    eyeIcon.style.cssText = `
        position: absolute;
        width: 40px;
        height: 40px;
        background: rgba(16, 185, 129, 0.9);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10000;
        pointer-events: auto;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        transition: all 0.2s ease;
        opacity: 0;
    `;
    eyeIcon.dataset.aiStyleEyeIcon = 'true';
    eyeIcon.title = 'Click to generate virtual try-on';

    eyeIcon.addEventListener('mouseenter', () => {
        eyeIcon.style.transform = 'scale(1.1)';
        eyeIcon.style.background = 'rgba(16, 185, 129, 1)';
    });

    eyeIcon.addEventListener('mouseleave', () => {
        eyeIcon.style.transform = 'scale(1)';
        eyeIcon.style.background = 'rgba(16, 185, 129, 0.9)';
    });

    return eyeIcon;
};

ScoreBadgeManager.prototype.positionElementRelativeToImage = function(element, img, corner = 'bottom-right', offset = { x: 45, y: 5 }, transform = null) {
    GeometryUtils.positionElementRelativeToImage(element, img, corner, offset, transform);
};

ScoreBadgeManager.prototype.positionEyeIcon = function(eyeIcon, img) {
    this.positionElementRelativeToImage(eyeIcon, img, 'bottom-right', { x: 45, y: 5 }, null);
    setTimeout(() => {
        eyeIcon.style.opacity = '1';
    }, 100);
};

ScoreBadgeManager.prototype.showEyeIcon = function(img) {
    if (this.activeEyeIcons.has(img)) {
        const existing = this.activeEyeIcons.get(img);
        if (!existing.isConnected) {
            document.body.appendChild(existing);
        }
        this.positionEyeIcon(existing, img);
        return existing;
    }

    const eyeIcon = this.createEyeIconElement();
    this.positionEyeIcon(eyeIcon, img);
    document.body.appendChild(eyeIcon);
    this.activeEyeIcons.set(img, eyeIcon);

    // Attach click/state handlers if available
    this.attachEyeIconHandlers(eyeIcon, img);
    return eyeIcon;
};

ScoreBadgeManager.prototype.hideEyeIcon = function(img) {
    const eyeIcon = this.activeEyeIcons.get(img);
    if (!eyeIcon) return;
    if (eyeIcon.parentNode) {
        eyeIcon.remove();
    }
    this.activeEyeIcons.delete(img);
};

ScoreBadgeManager.prototype.hideAllEyeIcons = function() {
    this.activeEyeIcons.forEach((eyeIcon, img) => {
        if (eyeIcon && eyeIcon.parentNode) {
            eyeIcon.remove();
        }
    });
    this.activeEyeIcons.clear();
};

// Eye icon behavior/state/caching (Step 2)
ScoreBadgeManager.prototype.setTryOnHandler = function(handler) {
    this.tryOnHandler = typeof handler === 'function' ? handler : null;
};

ScoreBadgeManager.prototype.updateEyeIconState = function(eyeIcon, state) {
    switch (state) {
        case 'cached':
            eyeIcon.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
            eyeIcon.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.5), 0 0 15px rgba(251, 191, 36, 0.3)';
            eyeIcon.title = 'Click to view cached virtual try-on';
            break;
        case 'loading':
            eyeIcon.style.background = 'rgba(59, 130, 246, 0.9)';
            eyeIcon.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.5)';
            eyeIcon.title = 'Generating virtual try-on...';
            this.ensureSpinnerAnimation();
            break;
        case 'close':
            eyeIcon.style.background = 'rgba(239, 68, 68, 0.9)';
            eyeIcon.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.5)';
            eyeIcon.title = 'Click to close virtual try-on';
            break;
        case 'error':
            eyeIcon.style.background = 'rgba(239, 68, 68, 0.9)';
            eyeIcon.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.5)';
            eyeIcon.title = 'Try-on generation failed';
            break;
        case 'default':
        default:
            eyeIcon.style.background = 'rgba(16, 185, 129, 0.9)';
            eyeIcon.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            eyeIcon.title = 'Click to generate virtual try-on';
            break;
    }
};

ScoreBadgeManager.prototype.ensureSpinnerAnimation = function() {
    if (document.getElementById('spinner-animation-styles')) return;
    const style = document.createElement('style');
    style.id = 'spinner-animation-styles';
    style.textContent = `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes eyeIconHover { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
    `;
    document.head.appendChild(style);
};

ScoreBadgeManager.prototype.getCachedTryonData = function(eyeIcon) {
    const cached = eyeIcon.dataset.tryonCached;
    const timestamp = eyeIcon.dataset.tryonTimestamp;
    const imageUrl = eyeIcon.dataset.tryonImageUrl;
    const imageData = eyeIcon.dataset.tryonImageData;

    if (cached !== 'true' || !timestamp || !imageUrl) {
        return null;
    }

    const cacheAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (cacheAge >= maxAge) {
        this.clearCachedTryonData(eyeIcon);
        return null;
    }

    return { imageUrl, imageData, timestamp: parseInt(timestamp) };
};

ScoreBadgeManager.prototype.cacheTryonData = function(eyeIcon, imageUrl, imageData) {
    eyeIcon.dataset.tryonCached = 'true';
    eyeIcon.dataset.tryonImageUrl = imageUrl;
    eyeIcon.dataset.tryonImageData = imageData || '';
    eyeIcon.dataset.tryonTimestamp = Date.now().toString();
    this.updateEyeIconState(eyeIcon, 'cached');
};

ScoreBadgeManager.prototype.clearCachedTryonData = function(eyeIcon) {
    delete eyeIcon.dataset.tryonCached;
    delete eyeIcon.dataset.tryonImageUrl;
    delete eyeIcon.dataset.tryonImageData;
    delete eyeIcon.dataset.tryonTimestamp;
    this.updateEyeIconState(eyeIcon, 'default');
};

ScoreBadgeManager.prototype.attachEyeIconHandlers = function(eyeIcon, img) {
    let autoCloseTimeout = null;

    eyeIcon.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Toggle off if an overlay is already showing for this image
        const existingOverlay = this.eyeIconOverlays.get(img);
        if (existingOverlay && existingOverlay.parentNode) {
            if (autoCloseTimeout) {
                clearTimeout(autoCloseTimeout);
                autoCloseTimeout = null;
            }
            existingOverlay.remove();
            this.eyeIconOverlays.delete(img);

            const hasCachedData = eyeIcon.dataset.tryonCached === 'true';
            this.updateEyeIconState(eyeIcon, hasCachedData ? 'cached' : 'default');
            return;
        }

        // If no handler is set, do nothing beyond visual feedback
        if (!this.tryOnHandler) {
            console.warn('No try-on handler set for ScoreBadgeManager');
            return;
        }

        // Show loading overlay
        const loadingOverlay = this.createLoadingOverlay(img);
        document.body.appendChild(loadingOverlay);
        this.eyeIconOverlays.set(img, loadingOverlay);

        // Show loading state on eye icon
        this.updateEyeIconState(eyeIcon, 'loading');

        try {
            const result = await this.tryOnHandler(img, eyeIcon);

            // Remove loading overlay
            if (loadingOverlay && loadingOverlay.parentNode) {
                loadingOverlay.remove();
            }

            if (result && result.overlay instanceof HTMLElement) {
                document.body.appendChild(result.overlay);
                this.eyeIconOverlays.set(img, result.overlay);

                // Switch to close state
                this.updateEyeIconState(eyeIcon, 'close');

                // Auto close after 5 seconds
                autoCloseTimeout = setTimeout(() => {
                    const overlay = this.eyeIconOverlays.get(img);
                    if (overlay && overlay.parentNode) {
                        overlay.remove();
                        this.eyeIconOverlays.delete(img);
                    }
                    const hasCached = eyeIcon.dataset.tryonCached === 'true';
                    this.updateEyeIconState(eyeIcon, hasCached ? 'cached' : 'default');
                }, 5000);
            } else if (result && result.error) {
                this.eyeIconOverlays.delete(img);
                this.updateEyeIconState(eyeIcon, 'error');
            } else {
                this.eyeIconOverlays.delete(img);
                const hasCached = eyeIcon.dataset.tryonCached === 'true';
                this.updateEyeIconState(eyeIcon, hasCached ? 'cached' : 'default');
            }
        } catch (err) {
            console.error('Try-on handler error:', err);
            // Remove loading overlay on error
            if (loadingOverlay && loadingOverlay.parentNode) {
                loadingOverlay.remove();
            }
            this.eyeIconOverlays.delete(img);
            this.updateEyeIconState(eyeIcon, 'error');
        }
    });
};
