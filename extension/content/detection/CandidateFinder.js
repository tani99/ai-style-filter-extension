import { SUPPORTED_SITES } from '../config/SiteConfigurations.js';
import { QuickExclusion } from './QuickExclusion.js';

/**
 * CandidateFinder handles finding potential product images using site-specific
 * and general CSS selectors
 */
export class CandidateFinder {
    constructor(currentSite) {
        this.currentSite = currentSite;
        this.quickExclusion = new QuickExclusion();

        // General selectors as fallback
        this.generalSelectors = [
            'img[src*="product"]',
            'img[alt*="product"]',
            'img[data-src*="product"]',
            'img[class*="product"]',
            'img[id*="product"]',
            '.product img',
            '.item img',
            '.card img'
        ];
    }

    /**
     * Test site-specific selectors to see what's working on current page
     * @returns {Object} Statistics about found elements
     */
    testSelectors() {
        if (!this.currentSite?.selectors) {
            console.log('⚠️ No site configuration available for selector testing');
            return { foundElements: 0, selectors: {} };
        }

        console.log(`🔍 Testing selectors for ${this.currentSite.name}:`);

        const stats = {
            productImages: 0,
            productCards: 0,
            productLinks: 0
        };

        // Test product images
        let foundElements = 0;
        for (const selector of this.currentSite.selectors.productImages) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`  ✅ Product images: ${selector} (${elements.length} found)`);
                    stats.productImages += elements.length;
                    foundElements += elements.length;
                }
            } catch (e) {
                console.log(`  ⚠️ Invalid selector: ${selector}`);
            }
        }

        // Test product cards
        for (const selector of this.currentSite.selectors.productCards) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`  ✅ Product cards: ${selector} (${elements.length} found)`);
                    stats.productCards += elements.length;
                    foundElements += elements.length;
                }
            } catch (e) {
                console.log(`  ⚠️ Invalid selector: ${selector}`);
            }
        }

        // Test product links
        for (const selector of this.currentSite.selectors.productLinks) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`  ✅ Product links: ${selector} (${elements.length} found)`);
                    stats.productLinks += elements.length;
                    foundElements += elements.length;
                }
            } catch (e) {
                console.log(`  ⚠️ Invalid selector: ${selector}`);
            }
        }

        if (foundElements === 0) {
            console.log(`  ⚠️ No elements found with current selectors for ${this.currentSite.name}`);
            console.log(`  💡 Page may still be loading or selectors may need updating`);
        } else {
            console.log(`  📊 Total elements found: ${foundElements}`);
        }

        return { foundElements, selectors: stats };
    }

    /**
     * Find candidate images - using universal detection only
     * @returns {HTMLImageElement[]} Array of candidate image elements
     */
    findCandidateImages() {
        console.log(`🔍 Looking for images...`);

        // Use universal fallback only - gets all images with quick exclusion
        const candidates = this._universalFallback();

        console.log(`  🎯 Total candidates found: ${candidates.length}`);

        return candidates;
    }

    /**
     * Universal fallback - get all images with basic filtering
     * @returns {HTMLImageElement[]} Array of filtered image elements
     * @private
     */
    _universalFallback() {
        console.log('    📸 Using universal image fallback...');
        const allImages = document.querySelectorAll('img');
        console.log(`    📸 Found ${allImages.length} total images on page`);

        const candidates = [];
        allImages.forEach(img => {
            // Use QuickExclusion to filter out obvious UI elements
            const exclusionResult = this.quickExclusion.quickExclusionCheck(img);
            if (exclusionResult.passed) {
                candidates.push(img);
            }
        });

        console.log(`    ✅ ${candidates.length} images passed quick exclusion`);
        return candidates;
    }

    /**
     * Find images using only site-specific selectors (no fallbacks)
     * @returns {HTMLImageElement[]} Array of candidate image elements
     */
    findSiteSpecificImages() {
        const candidates = new Set();

        if (!this.currentSite?.selectors?.productImages) {
            console.log('⚠️ No site-specific selectors available');
            return [];
        }

        for (const selector of this.currentSite.selectors.productImages) {
            try {
                const images = document.querySelectorAll(selector);
                images.forEach(img => candidates.add(img));
            } catch (e) {
                console.log(`Invalid selector: ${selector}`);
            }
        }

        return Array.from(candidates);
    }

    /**
     * Find images within product cards only
     * @returns {HTMLImageElement[]} Array of candidate image elements
     */
    findProductCardImages() {
        const candidates = new Set();

        if (!this.currentSite?.selectors?.productCards) {
            console.log('⚠️ No product card selectors available');
            return [];
        }

        for (const selector of this.currentSite.selectors.productCards) {
            try {
                const cards = document.querySelectorAll(selector);
                cards.forEach(card => {
                    const images = card.querySelectorAll('img');
                    images.forEach(img => candidates.add(img));
                });
            } catch (e) {
                console.log(`Invalid card selector: ${selector}`);
            }
        }

        return Array.from(candidates);
    }

    /**
     * Find images using general selectors only
     * @returns {HTMLImageElement[]} Array of candidate image elements
     */
    findGeneralImages() {
        const candidates = new Set();

        for (const selector of this.generalSelectors) {
            try {
                const images = document.querySelectorAll(selector);
                images.forEach(img => candidates.add(img));
            } catch (e) {
                // Skip invalid selectors
            }
        }

        return Array.from(candidates);
    }

    /**
     * Update the current site configuration
     * @param {Object} siteConfig - New site configuration
     */
    updateSiteConfig(siteConfig) {
        this.currentSite = siteConfig;
    }

    /**
     * Get current site configuration
     * @returns {Object} Current site configuration
     */
    getCurrentSite() {
        return this.currentSite;
    }

    /**
     * Get general selectors
     * @returns {string[]} Array of general selector strings
     */
    getGeneralSelectors() {
        return [...this.generalSelectors];
    }

    /**
     * Add a general selector
     * @param {string} selector - CSS selector to add
     */
    addGeneralSelector(selector) {
        if (!this.generalSelectors.includes(selector)) {
            this.generalSelectors.push(selector);
        }
    }

    /**
     * Remove a general selector
     * @param {string} selector - CSS selector to remove
     */
    removeGeneralSelector(selector) {
        const index = this.generalSelectors.indexOf(selector);
        if (index > -1) {
            this.generalSelectors.splice(index, 1);
        }
    }
}