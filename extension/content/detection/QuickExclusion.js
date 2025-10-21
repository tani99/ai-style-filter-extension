/**
 * QuickExclusion provides fast rejection rules to filter out obvious UI elements
 * and non-product images before expensive AI analysis
 */
export class QuickExclusion {
    constructor() {
        // UI patterns that commonly appear in non-product images
        this.uiPatterns = [
            'logo', 'icon', 'sprite', 'arrow', 'close', 'menu', 'nav',
            'header', 'footer', 'sidebar', 'banner', 'advertisement'
        ];

        // Minimum dimensions for product images
        this.minImageSize = 30;
    }

    /**
     * Perform quick exclusion checks to filter out obvious non-product images
     * @param {HTMLImageElement} img - The image element to check
     * @returns {Object} Result with passed flag and rejection reason if failed
     */
    quickExclusionCheck(img) {
        // First check: Exclude AI-generated try-on images
        if (img.hasAttribute('data-ai-generated-tryon')) {
            return {
                passed: false,
                reason: 'AI-generated virtual try-on image'
            };
        }

        const src = (img.src || '').toLowerCase();
        const alt = (img.alt || '').toLowerCase();
        const className = (img.className || '').toLowerCase();

        // Check for obvious UI elements, but be smarter about context
        // Only exclude if these patterns appear in non-clothing contexts

        // Check src and className for UI elements (these are more reliable)
        const srcAndClass = `${src} ${className}`;

        for (const pattern of this.uiPatterns) {
            if (srcAndClass.includes(pattern)) {
                return {
                    passed: false,
                    reason: `UI element detected: contains '${pattern}' in src/class`
                };
            }
        }

        // Check image dimensions for obvious non-product images
        const rect = img.getBoundingClientRect();
        if (rect.width < this.minImageSize || rect.height < this.minImageSize) {
            return {
                passed: false,
                reason: 'Too small - likely icon or thumbnail'
            };
        }

        return { passed: true };
    }

    /**
     * Check if an image appears to be a UI element based on patterns
     * @param {HTMLImageElement} img - The image element to check
     * @returns {boolean} True if image appears to be a UI element
     */
    isUIElement(img) {
        return !this.quickExclusionCheck(img).passed;
    }

    /**
     * Check if image dimensions suggest it's likely a product image
     * @param {HTMLImageElement} img - The image element to check
     * @returns {Object} Result with isProductSize flag and dimensions
     */
    checkProductImageSize(img) {
        const rect = img.getBoundingClientRect();
        const naturalWidth = img.naturalWidth || 0;
        const naturalHeight = img.naturalHeight || 0;

        // Product images are typically larger than UI elements
        const minProductSize = 100;
        const maxProductSize = 2000;

        const isProductSize =
            rect.width >= minProductSize &&
            rect.height >= minProductSize &&
            rect.width <= maxProductSize &&
            rect.height <= maxProductSize;

        return {
            isProductSize,
            dimensions: {
                display: { width: rect.width, height: rect.height },
                natural: { width: naturalWidth, height: naturalHeight }
            }
        };
    }

    /**
     * Check for common patterns in image attributes that suggest non-product images
     * @param {HTMLImageElement} img - The image element to check
     * @returns {Object} Result with various pattern checks
     */
    checkImagePatterns(img) {
        const src = (img.src || '').toLowerCase();
        const alt = (img.alt || '').toLowerCase();
        const className = (img.className || '').toLowerCase();
        const id = (img.id || '').toLowerCase();

        const patterns = {
            hasLogo: /logo|brand|symbol/.test(`${src} ${alt} ${className} ${id}`),
            hasIcon: /icon|sprite|graphic/.test(`${src} ${alt} ${className} ${id}`),
            hasNavigation: /nav|menu|header|footer/.test(`${src} ${alt} ${className} ${id}`),
            hasAdvertisement: /ad|banner|promo|campaign/.test(`${src} ${alt} ${className} ${id}`),
            hasDecorative: /decoration|background|texture|pattern/.test(`${src} ${alt} ${className} ${id}`)
        };

        const hasUIPattern = Object.values(patterns).some(Boolean);

        return {
            patterns,
            hasUIPattern,
            summary: hasUIPattern ? 'Likely UI element' : 'Possible product image'
        };
    }

    /**
     * Get all configured UI patterns
     * @returns {string[]} Array of UI pattern strings
     */
    getUIPatterns() {
        return [...this.uiPatterns];
    }

    /**
     * Add a new UI pattern to the exclusion list
     * @param {string} pattern - The pattern to add
     */
    addUIPattern(pattern) {
        if (!this.uiPatterns.includes(pattern.toLowerCase())) {
            this.uiPatterns.push(pattern.toLowerCase());
        }
    }

    /**
     * Remove a UI pattern from the exclusion list
     * @param {string} pattern - The pattern to remove
     */
    removeUIPattern(pattern) {
        const index = this.uiPatterns.indexOf(pattern.toLowerCase());
        if (index > -1) {
            this.uiPatterns.splice(index, 1);
        }
    }

    /**
     * Update minimum image size threshold
     * @param {number} size - New minimum size in pixels
     */
    setMinImageSize(size) {
        this.minImageSize = Math.max(10, size); // Ensure minimum of 10px
    }

    /**
     * Get current minimum image size threshold
     * @returns {number} Current minimum size in pixels
     */
    getMinImageSize() {
        return this.minImageSize;
    }
}