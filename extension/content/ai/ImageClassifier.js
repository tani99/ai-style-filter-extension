import { QuickExclusion } from '../detection/QuickExclusion.js';
import { AltTextAnalyzer } from './AltTextAnalyzer.js';

/**
 * ImageClassifier uses Chrome's built-in image classification API and combines
 * multiple AI-powered detection layers for accurate clothing identification
 */
export class ImageClassifier {
    constructor() {
        this.quickExclusion = new QuickExclusion();
        this.altTextAnalyzer = new AltTextAnalyzer();
        // Image classification is disabled; we rely on quick exclusion and alt text only
        this.isAIAvailable = false;
    }

    // Image classification availability checks removed

    /**
     * Multi-layered clothing detection using AI
     * @param {HTMLImageElement} img - The image element to classify
     * @returns {Promise<Object>} Classification result with confidence and reasoning
     */
    async isClothingImage(img) {
        // Layer 1: Quick exclusion checks (fastest, no AI needed)
        const quickExclusion = this.quickExclusion.quickExclusionCheck(img);
        if (!quickExclusion.passed) {
            return {
                isClothing: false,
                reasoning: quickExclusion.reason,
                method: 'quick_exclusion',
                confidence: 0.9
            };
        }

        // Layer 2: AI-powered alt text analysis (fast, uses language model)
        const altTextAnalysis = await this.altTextAnalyzer.analyzeAltTextWithAI(img);
        if (altTextAnalysis.confident) {
            return {
                isClothing: altTextAnalysis.isClothing,
                reasoning: altTextAnalysis.reasoning,
                method: 'ai_alt_text',
                confidence: altTextAnalysis.confidence
            };
        }

        // Layer 4: Default fallback (better to include than miss)
        return {
            isClothing: true,
            reasoning: 'Default inclusion - no clear exclusion criteria met',
            method: 'fallback_inclusion',
            confidence: 0.5
        };
    }

    /**
     * Classify multiple images in batch
     * @param {HTMLImageElement[]} images - Array of image elements
     * @param {Object} options - Classification options
     * @returns {Promise<Array>} Array of classification results
     */
    async classifyMultipleImages(images, options = {}) {
        const batchSize = options.batchSize || 3; // Smaller batch for image classification
        const results = [];

        for (let i = 0; i < images.length; i += batchSize) {
            const batch = images.slice(i, i + batchSize);

            const batchPromises = batch.map(async (img, index) => {
                const globalIndex = i + index;
                try {
                    const result = await this.isClothingImage(img);
                    return {
                        index: globalIndex,
                        element: img,
                        result: result
                    };
                } catch (error) {
                    return {
                        index: globalIndex,
                        element: img,
                        result: {
                            isClothing: false,
                            reasoning: 'Classification failed',
                            method: 'error',
                            confidence: 0,
                            error: error.message
                        }
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Add a small delay between batches
            if (i + batchSize < images.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        return results;
    }

    /**
     * Test AI classification functionality
     * @returns {Promise<Object>} Test result
     */
    async testClassificationFunctionality() {
        return {
            success: false,
            reason: 'Image classification disabled; using alt text only'
        };
    }

    /**
     * Get current clothing categories
     * @returns {string[]} Array of clothing category keywords
     */
    getClothingCategories() {
        return [...this.clothingCategories];
    }

    /**
     * Add a clothing category keyword
     * @param {string} category - Category keyword to add
     */
    addClothingCategory(category) {
        if (!this.clothingCategories.includes(category.toLowerCase())) {
            this.clothingCategories.push(category.toLowerCase());
        }
    }

    /**
     * Remove a clothing category keyword
     * @param {string} category - Category keyword to remove
     */
    removeClothingCategory(category) {
        const index = this.clothingCategories.indexOf(category.toLowerCase());
        if (index > -1) {
            this.clothingCategories.splice(index, 1);
        }
    }

    /**
     * Check if AI is currently available
     * @returns {boolean} True if AI is available
     */
    isAIReady() {
        return false;
    }

    /**
     * Refresh AI availability status
     * @returns {Promise<boolean>} New availability status
     */
    async refreshAIAvailability() {
        return false;
    }
}