import { GeometryUtils } from '../utils/GeometryUtils.js';

/**
 * ScoreOverlays manages score-related visual indicators and overlays
 * Handles compatibility scores, badges, and visual styling based on scores
 */
export class ScoreOverlays {
    constructor(overlayMap, updateHandlers) {
        this.overlayMap = overlayMap;
        this.updateHandlers = updateHandlers;
    }

    /**
     * Add score overlay to a detected product image
     * Shows compatibility score (1-10) with visual styling
     * @param {HTMLImageElement} img - Image element
     * @param {number} score - Compatibility score (1-10)
     * @param {string} reasoning - Analysis reasoning
     * @param {number} index - Image index
     * @param {string} mode - Ranking mode (unused, kept for compatibility)
     */
    addScoreOverlay(img, score, reasoning, index, mode = null) {
        console.log(`🏷️ addScoreOverlay called for image ${index + 1}:`, {
            score,
            reasoning,
            mode,
            imgAlt: img.alt,
            imgSrc: img.src.substring(0, 60) + '...'
        });

        // VALIDATION: Ensure score is valid (1-10 scale only)
        if (score < 1 || score > 10) {
            console.error(`❌ Invalid score ${score} (expected 1-10). Ignoring.`);
            console.error('   This indicates stale cached data or analysis error.');
            return; // Don't add score overlay with invalid score
        }

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

        // Add tracking attribute to badge
        scoreBadge.dataset.targetIndex = index;
        scoreBadge.dataset.aiStyleScoreBadge = scoreBadge.dataset.aiStyleScoreBadge || 'true';

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

        // Apply visual styling based on score (1-10 scale)
        if (score >= 9) {
            // Perfect match (9-10): special yellow border styling
            console.log(`   ✨ Score ${score}/10 - Perfect match with special yellow border`);
            overlayData.overlay.dataset.aiScore = score;
            overlayData.overlay.dataset.aiHighlighted = 'true';
            img.style.opacity = '1';
            img.style.filter = 'none';
            img.style.border = '3px solid #fbbf24';
            img.style.boxShadow = '0 0 15px rgba(251, 191, 36, 0.6)';
        } else if (score >= 7) {
            // Good match (7-8): normal appearance with score badge
            console.log(`   ✅ Score ${score}/10 - Good match, normal visibility`);
            overlayData.overlay.dataset.aiScore = score;
            overlayData.overlay.dataset.aiHighlighted = 'false';
            img.style.opacity = '1';
            img.style.filter = 'none';
        } else if (score >= 5) {
            // Medium match (5-6): normal appearance with score badge
            console.log(`   ⚠️ Score ${score}/10 - Medium match, normal visibility`);
            overlayData.overlay.dataset.aiScore = score;
            overlayData.overlay.dataset.aiHighlighted = 'false';
            img.style.opacity = '1';
            img.style.filter = 'none';
        } else {
            // Low score (1-4): completely hidden
            console.log(`   ⚫ Score ${score}/10 - Low score, hidden`);
            overlayData.overlay.dataset.aiScore = score;
            overlayData.overlay.dataset.aiHighlighted = 'false';
            img.style.display = 'none';
        }

        // Update image attributes for score system
        img.dataset.aiStyleScore = score;
        img.title = `Score ${score}/10 - ${reasoning}`;

        // Set default filter state attributes for CSS reactivity
        img.dataset.aiFilterMode = 'myStyle'; // Default to myStyle mode
        img.dataset.aiScoreThreshold = '7'; // Default threshold
        console.log('   Default filter state attributes set: myStyle mode, threshold 7');

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
     * Shows score (1-10) for products
     * @param {number} score - Compatibility score (1-10)
     * @param {string} reasoning - Analysis reasoning
     * @returns {HTMLElement} Score badge element
     */
    createScoreBadge(score, reasoning) {
        console.log('🏷️ createScoreBadge called:', {
            score,
            scoreType: typeof score,
            reasoning: reasoning?.substring(0, 50)
        });

        const badge = document.createElement('div');
        badge.className = 'ai-style-score-badge';

        // Determine color and styling based on score (1-10 scale)
        let badgeClass = '';
        let badgeText = '';
        let badgeColor = '';
        let badgeBackground = '';

        badgeText = `${score}/10`;
        badge.dataset.aiStyleScoreBadge = 'score';

        if (score >= 9) {
            // Perfect match (9-10): Special golden styling
            badgeClass = 'perfect-match';
            badgeColor = '#ffffff';
            badgeBackground = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
            badge.dataset.aiStyleScoreBadge = 'perfect';
        } else if (score >= 7) {
            // Good match (7-8): Green
            badgeClass = 'good-match';
            badgeColor = '#ffffff';
            badgeBackground = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        } else if (score >= 5) {
            // Medium match (5-6): Yellow
            badgeClass = 'medium-match';
            badgeColor = '#ffffff';
            badgeBackground = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
        } else {
            // Low match (1-4): Red
            badgeClass = 'low-match';
            badgeColor = '#ffffff';
            badgeBackground = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        }

        // Apply styling
        badge.className += ` ${badgeClass}`;
        badge.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: ${badgeBackground};
            color: ${badgeColor};
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
            min-width: 20px;
            text-align: center;
            line-height: 1.2;
            border: 2px solid rgba(255, 255, 255, 0.3);
        `;

        // Add special effects for perfect matches
        if (badge.dataset.aiStyleScoreBadge === 'perfect') {
            badge.style.animation = 'perfectMatchPulse 2s ease-in-out infinite';
            badge.style.boxShadow = '0 4px 16px rgba(251, 191, 36, 0.6), 0 0 20px rgba(251, 191, 36, 0.4)';
        }

        // Set badge text
        badge.textContent = badgeText;

        // Add tooltip with reasoning
        if (reasoning && reasoning.trim()) {
            badge.title = reasoning.length > 100 ? reasoning.substring(0, 100) + '...' : reasoning;
        }

        console.log('🏷️ Score badge created:', {
            text: badgeText,
            class: badgeClass,
            isTierSystem,
            score
        });

        return badge;
    }

    /**
     * Position score badge relative to image
     * @param {HTMLElement} badge - Score badge element
     * @param {HTMLImageElement} img - Image element
     */
    positionScoreBadge(badge, img) {
        const rect = img.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        // Position in top-right corner of image
        badge.style.left = `${rect.left + rect.width - 8}px`;
        badge.style.top = `${rect.top + 8}px`;

        // Special positioning for perfect match badges
        if (badge.dataset.aiStyleScoreBadge === 'perfect') {
            // Slightly offset for better visibility
            badge.style.left = `${rect.left + rect.width - 12}px`;
            badge.style.top = `${rect.top + 4}px`;
        }
    }

    /**
     * Replace all score badges with loading indicators
     */
    replaceScoresWithLoadingIndicators() {
        console.log('🔄 Replacing score badges with loading indicators...');

        this.overlayMap.forEach((overlayData, img) => {
            if (overlayData.scoreBadge && overlayData.scoreBadge.parentNode) {
                console.log(`   Replacing score badge for image ${overlayData.index + 1}`);
                overlayData.scoreBadge.remove();
                overlayData.scoreBadge = null;
            }
        });

        console.log('✅ Score badges replaced with loading indicators');
    }

    /**
     * Add loading indicator to an image
     * @param {HTMLImageElement} img - Image element
     * @param {number} index - Image index
     */
    addLoadingIndicator(img, index) {
        const overlayData = this.overlayMap.get(img);
        if (!overlayData) {
            console.warn('⚠️ No overlay data found for image');
            return;
        }

        // Remove existing score badge if any
        if (overlayData.scoreBadge && overlayData.scoreBadge.parentNode) {
            overlayData.scoreBadge.remove();
            overlayData.scoreBadge = null;
        }

        // Create loading badge
        const loadingBadge = this.createLoadingBadge();
        loadingBadge.dataset.targetIndex = index;
        loadingBadge.dataset.aiStyleScoreBadge = 'loading';

        // Position and add to DOM
        this.positionScoreBadge(loadingBadge, img);
        document.body.appendChild(loadingBadge);

        // Update tracking
        overlayData.scoreBadge = loadingBadge;

        // Add scroll/resize handlers
        const updateScoreBadgePosition = () => this.positionScoreBadge(loadingBadge, img);
        const handlers = this.updateHandlers.get(img);
        if (handlers) {
            handlers.updateScoreBadgePosition = updateScoreBadgePosition;
            window.addEventListener('scroll', updateScoreBadgePosition, { passive: true });
            window.addEventListener('resize', updateScoreBadgePosition);
        }

        console.log(`✅ Added loading indicator for image ${index + 1}`);
    }

    /**
     * Create loading badge element
     * @returns {HTMLElement} Loading badge element
     */
    createLoadingBadge() {
        const badge = document.createElement('div');
        badge.className = 'ai-style-score-badge loading-badge';
        badge.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
            color: #ffffff;
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
            min-width: 20px;
            text-align: center;
            line-height: 1.2;
            border: 2px solid rgba(255, 255, 255, 0.3);
            display: flex;
            align-items: center;
            gap: 4px;
        `;

        // Create spinner
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 12px;
            height: 12px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        `;

        // Create text
        const text = document.createElement('span');
        text.textContent = '...';

        badge.appendChild(spinner);
        badge.appendChild(text);

        return badge;
    }

    /**
     * Ensure spinner animation CSS is available
     */
    ensureSpinnerAnimation() {
        if (document.getElementById('spinner-animation-styles')) return;

        const style = document.createElement('style');
        style.id = 'spinner-animation-styles';
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes perfectMatchPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Ensure perfect match animation CSS is available
     */
    ensurePerfectMatchAnimation() {
        if (document.getElementById('perfect-match-animation-styles')) return;

        const style = document.createElement('style');
        style.id = 'perfect-match-animation-styles';
        style.textContent = `
            @keyframes perfectMatchPulse {
                0%, 100% { 
                    transform: scale(1);
                    box-shadow: 0 4px 16px rgba(251, 191, 36, 0.6), 0 0 20px rgba(251, 191, 36, 0.4);
                }
                50% { 
                    transform: scale(1.05);
                    box-shadow: 0 6px 20px rgba(251, 191, 36, 0.8), 0 0 25px rgba(251, 191, 36, 0.6);
                }
            }
        `;
        document.head.appendChild(style);
    }
}
