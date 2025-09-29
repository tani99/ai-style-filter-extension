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
        this.isAIAvailable = false;
        this.checkAIAvailability();

        // Clothing category keywords for classification
        this.clothingCategories = [
            'shirt', 'dress', 'pants', 'jeans', 'jacket', 'coat', 'sweater',
            'shoes', 'sneakers', 'boots', 'hat', 'cap', 'socks', 'underwear',
            'skirt', 'shorts', 'hoodie', 'vest', 'blazer', 'suit', 'tie',
            'scarf', 'gloves', 'belt', 'bag', 'purse', 'backpack', 'sandals',
            'heels', 'flats', 'jewelry', 'necklace', 'bracelet', 'watch'
        ];

        // Non-clothing categories for exclusion
        this.nonClothingCategories = [
            'person', 'face', 'building', 'car', 'animal', 'food', 'plant',
            'furniture', 'electronics', 'logo', 'text', 'background'
        ];
    }

    /**
     * Check if Chrome's image classification AI is available
     * @private
     */
    async checkAIAvailability() {
        try {
            this.isAIAvailable = typeof window !== 'undefined' &&
                                 window.ai &&
                                 typeof window.ai.createImageClassifier === 'function';
        } catch (error) {
            this.isAIAvailable = false;
        }
    }

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

        // Layer 3: Image classification (more expensive, only if needed)
        const imageClassification = await this.classifyImageWithAI(img);
        if (imageClassification.confident) {
            return {
                isClothing: imageClassification.isClothing,
                reasoning: imageClassification.reasoning,
                method: 'ai_image_classification',
                confidence: imageClassification.confidence
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
     * Use Chrome's built-in image classification API
     * @param {HTMLImageElement} img - The image element to classify
     * @returns {Promise<Object>} Classification result
     */
    async classifyImageWithAI(img) {
        if (!this.isAIAvailable) {
            return { confident: false, reason: 'AI not available' };
        }

        try {
            // Create image classifier
            const classifier = await window.ai.createImageClassifier();

            // Create canvas for image processing
            const { canvas, ctx } = this.createImageCanvas(img);

            // Draw image to canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Classify the image
            const results = await classifier.classify(imageData);

            // Analyze results
            const analysis = this.analyzeClassificationResults(results);

            // Clean up
            classifier.destroy();

            return analysis;

        } catch (error) {
            console.log('AI image classification failed:', error);
            return {
                confident: false,
                reason: 'Classification error',
                error: error.message
            };
        }
    }

    /**
     * Create a canvas for image processing
     * @param {HTMLImageElement} img - The source image
     * @returns {Object} Canvas and context objects
     * @private
     */
    createImageCanvas(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size (smaller for faster processing, 224x224 is common for AI models)
        const maxSize = 224;
        const naturalWidth = img.naturalWidth || img.width || maxSize;
        const naturalHeight = img.naturalHeight || img.height || maxSize;

        // Maintain aspect ratio while fitting within max size
        const aspectRatio = naturalWidth / naturalHeight;
        if (naturalWidth > naturalHeight) {
            canvas.width = Math.min(naturalWidth, maxSize);
            canvas.height = Math.min(naturalHeight, maxSize / aspectRatio);
        } else {
            canvas.width = Math.min(naturalWidth, maxSize * aspectRatio);
            canvas.height = Math.min(naturalHeight, maxSize);
        }

        return { canvas, ctx };
    }

    /**
     * Analyze classification results to determine clothing likelihood
     * @param {Array} results - Classification results from AI
     * @returns {Object} Analysis result
     * @private
     */
    analyzeClassificationResults(results) {
        if (!results || results.length === 0) {
            return { confident: false, reason: 'No classification results' };
        }

        // Sort results by confidence
        const sortedResults = results.sort((a, b) => b.confidence - a.confidence);

        for (const result of sortedResults) {
            const label = result.label.toLowerCase();
            const confidence = result.confidence;

            // High confidence clothing detection
            if (confidence > 0.7 && this.isClothingCategory(label)) {
                return {
                    confident: true,
                    isClothing: true,
                    reasoning: `AI image classification: ${label} (${Math.round(confidence * 100)}%)`,
                    confidence: confidence,
                    detectedLabel: label
                };
            }

            // High confidence non-clothing detection
            if (confidence > 0.8 && this.isNonClothingCategory(label)) {
                return {
                    confident: true,
                    isClothing: false,
                    reasoning: `AI image classification: ${label} (${Math.round(confidence * 100)}%)`,
                    confidence: confidence,
                    detectedLabel: label
                };
            }
        }

        // Medium confidence check with lower thresholds
        const topResult = sortedResults[0];
        if (topResult.confidence > 0.5) {
            const label = topResult.label.toLowerCase();
            if (this.isClothingCategory(label)) {
                return {
                    confident: true,
                    isClothing: true,
                    reasoning: `AI image classification (medium confidence): ${label} (${Math.round(topResult.confidence * 100)}%)`,
                    confidence: topResult.confidence,
                    detectedLabel: label
                };
            }
        }

        return {
            confident: false,
            reason: 'Low confidence classification results',
            topResult: sortedResults[0]
        };
    }

    /**
     * Check if a label indicates a clothing category
     * @param {string} label - Classification label
     * @returns {boolean} True if it's a clothing category
     * @private
     */
    isClothingCategory(label) {
        return this.clothingCategories.some(category =>
            label.includes(category) || category.includes(label)
        );
    }

    /**
     * Check if a label indicates a non-clothing category
     * @param {string} label - Classification label
     * @returns {boolean} True if it's a non-clothing category
     * @private
     */
    isNonClothingCategory(label) {
        return this.nonClothingCategories.some(category =>
            label.includes(category) || category.includes(label)
        );
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

            // Add longer delay between batches for image classification
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
        if (!this.isAIAvailable) {
            return {
                success: false,
                reason: 'Image classification AI not available'
            };
        }

        try {
            // Try to create a classifier to test availability
            const classifier = await window.ai.createImageClassifier();
            classifier.destroy();

            return {
                success: true,
                reason: 'Image classification API is available'
            };
        } catch (error) {
            return {
                success: false,
                reason: 'Image classification test failed',
                error: error.message
            };
        }
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
        return this.isAIAvailable;
    }

    /**
     * Refresh AI availability status
     * @returns {Promise<boolean>} New availability status
     */
    async refreshAIAvailability() {
        await this.checkAIAvailability();
        return this.isAIAvailable;
    }
}