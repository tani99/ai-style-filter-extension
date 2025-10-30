import { buildProductAnalysisPrompt } from '../config/Prompts.js';
import { BaseProductMatcher } from './BaseProductMatcher.js';

/**
 * PersonalStyleMatcher analyzes detected product images against user's personal style profile
 * and provides compatibility scores (1-10) using Chrome's built-in AI
 */
export class PersonalStyleMatcher extends BaseProductMatcher {
    constructor() {
        super();
        this.maxScore = 10;  // Score range: 1-10
        this.analyzerName = 'PersonalStyleMatcher';
    }

    /**
     * Analyze a single product image against user's style profile
     * Convenience wrapper around base analyze() method
     * @param {HTMLImageElement} productImage - Product image element
     * @param {Object} styleProfile - User's style profile
     * @returns {Promise<Object>} Analysis result with score (1-10) and reasoning
     */
    async analyzeProduct(productImage, styleProfile) {
        return this.analyze(productImage, { styleProfile });
    }


    /**
     * Build analysis prompt for AI
     * Implementation of BaseProductMatcher.buildPrompt()
     * @private
     */
    async buildPrompt(productImage, options) {
        const { styleProfile } = options;

        // Extract key information from style profile
        const bestColors = styleProfile.color_palette?.best_colors || [];
        const avoidColors = styleProfile.color_palette?.avoid_colors || [];
        const styleCategories = styleProfile.style_categories?.map(c => c.name) || [];
        const recommendedPatterns = styleProfile.pattern_preferences?.recommended_patterns || [];
        const avoidPatterns = styleProfile.pattern_preferences?.avoid_patterns || [];
        const aestheticKeywords = styleProfile.overall_aesthetic?.keywords || [];

        // Get image context
        const altText = productImage.alt || '';
        const imageContext = this.extractImageContext(productImage);

        // Use centralized prompt builder
        const prompt = buildProductAnalysisPrompt({
            altText,
            imageContext,
            bestColors,
            avoidColors,
            styleCategories,
            aestheticKeywords,
            recommendedPatterns,
            avoidPatterns,
        });
        console.log('🔍 The prompt i asked:', prompt);
        return prompt;
    }


    /**
     * Generate cache key for product
     * Only uses image src since style profile is global (one per session)
     * When style profile changes, cache should be cleared entirely
     * @private
     */
    getCacheKey(productImage, options) {
        // Use only image src for cache key (ignore styleProfile in options)
        const imageSrc = productImage.src || productImage.currentSrc || '';

        // Simple hash of the image src (first 50 chars + length)
        const imageHash = imageSrc.substring(0, 50) + imageSrc.length;

        return `product_${imageHash}`;
    }

}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PersonalStyleMatcher = PersonalStyleMatcher;
}