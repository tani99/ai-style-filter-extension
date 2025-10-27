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
