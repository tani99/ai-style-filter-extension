import { SiteDetector } from './SiteDetector.js';

/**
 * PageTypeDetector handles classification of page types on supported e-commerce sites.
 * Determines if current page is a product page, category page, search page, etc.
 */
export class PageTypeDetector {
    constructor(url, hostname) {
        this.currentUrl = url;
        this.siteDetector = new SiteDetector(hostname);
        this.currentSite = this.siteDetector.detectCurrentSite();
    }

    /**
     * Detects the type of the current page based on URL patterns
     * @returns {string} Page type: 'product', 'category', 'search', 'other', or 'unknown'
     */
    detectPageType() {
        if (!this.currentSite) return 'unknown';

        const url = this.currentUrl.toLowerCase();

        // Check for product pages
        for (const pattern of this.currentSite.productPagePatterns) {
            if (url.includes(pattern)) {
                return 'product';
            }
        }

        // Check for category/listing pages
        for (const pattern of this.currentSite.categoryPagePatterns) {
            if (url.includes(pattern)) {
                return 'category';
            }
        }

        // Check for search pages
        if (url.includes('search') || url.includes('query') || url.includes('q=')) {
            return 'search';
        }

        // Default to homepage or other
        return 'other';
    }

    /**
     * Check if current page is a product page
     * @returns {boolean} True if current page is a product page
     */
    isProductPage() {
        return this.detectPageType() === 'product';
    }

    /**
     * Check if current page is a category/listing page
     * @returns {boolean} True if current page is a category page
     */
    isCategoryPage() {
        return this.detectPageType() === 'category';
    }

    /**
     * Get the current site configuration
     * @returns {Object|null} Current site configuration or null if unsupported
     */
    getCurrentSite() {
        return this.currentSite;
    }
}