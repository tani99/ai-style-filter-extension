import { buildPromptRankingPrompt } from '../config/Prompts.js';
import { BaseProductMatcher } from './BaseProductMatcher.js';

/**
 * ProductSearchMatcher analyzes detected product images against user's text search query
 * and provides tier-based matching (1-3) using Chrome's built-in AI Prompt API
 * Uses actual image classification for accurate matching beyond just alt text
 */
export class ProductSearchMatcher extends BaseProductMatcher {
    constructor() {
        super();
        this.maxScore = 3;  // Score range: 1-3 (tier system)
        this.analyzerName = 'ProductSearchMatcher';
    }

    /**
     * Analyze a single product image against user's prompt
     * Convenience wrapper around base analyze() method
     * @param {HTMLImageElement} productImage - Product image element
     * @param {string} userPrompt - User's search prompt
     * @returns {Promise<Object>} Analysis result with tier (1=bad, 2=fine, 3=good) and reasoning
     */
    async analyzeProductWithPrompt(productImage, userPrompt) {
        return this.analyze(productImage, { userPrompt });
    }


    /**
     * Generates AI-powered visual descriptions by analyzing actual image pixels
     * 
     * Purpose: Creates our own "alt text" through visual analysis to support accurate 
     * product ranking when existing alt text is missing, generic, or misleading.
     * E-commerce sites often have poor metadata like "Product_12345", but this function
     * sees what's actually in the image (e.g., "dress", "red clothing", "jacket").
     * 
     * Process:
     * 1. Resizes image to 224x224 (ML standard) while maintaining aspect ratio
     * 2. Uses Chrome's Built-in AI Image Classifier to analyze pixel data
     * 3. Returns top 3 visual classifications with confidence scores
     * 4. Results are fed into the ranking prompt alongside alt text
     * 
     * Example output:
     * {
     *   success: true,
     *   classifications: [
     *     { label: "dress", confidence: 87 },
     *     { label: "red clothing", confidence: 65 },
     *     { label: "fashion", confidence: 52 }
     *   ]
     * }
     * 
     * @param {HTMLImageElement} img - Product image to visually analyze
     * @returns {Promise<Object|null>} Classification results with labels and confidence scores, or null if classifier unavailable
     * @private
     */
    async classifyImage(img) {
        if (!this.isImageClassifierAvailable) {
            return null;
        }

        try {
            // Create image classifier
            const classifier = await window.ai.createImageClassifier();

            // Create canvas for image processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas size (224x224 is standard for image classification)
            const maxSize = 224;
            const naturalWidth = img.naturalWidth || img.width || maxSize;
            const naturalHeight = img.naturalHeight || img.height || maxSize;

            // Maintain aspect ratio
            const aspectRatio = naturalWidth / naturalHeight;
            if (naturalWidth > naturalHeight) {
                canvas.width = Math.min(naturalWidth, maxSize);
                canvas.height = Math.min(naturalHeight, maxSize / aspectRatio);
            } else {
                canvas.width = Math.min(naturalWidth, maxSize * aspectRatio);
                canvas.height = Math.min(naturalHeight, maxSize);
            }

            // Draw image to canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Classify the image
            const results = await classifier.classify(imageData);

            // Clean up
            classifier.destroy();

            // Get top 3 results
            const sortedResults = results.sort((a, b) => b.confidence - a.confidence).slice(0, 3);

            return {
                success: true,
                classifications: sortedResults.map(r => ({
                    label: r.label,
                    confidence: Math.round(r.confidence * 100)
                }))
            };

        } catch (error) {
            console.warn('Image classification failed:', error);
            return null;
        }
    }

    /**
     * Build analysis prompt for prompt-based ranking
     * Implementation of BaseProductMatcher.buildPrompt()
     * Includes actual image classification results if available
     * @private
     */
    async buildPrompt(productImage, options) {
        const { userPrompt } = options;

        // Image-only analysis: do not use alt text or image classification
        const altText = '';
        const imageContext = '';
        const classificationInfo = '';

        // Use centralized prompt builder (now image-only)
        return buildPromptRankingPrompt({
            userPrompt,
            altText,
            imageContext,
            classificationInfo
        });
    }


    /**
     * Generate cache key for product and prompt
     * Uses both image and prompt since same image can have different results for different prompts
     * @private
     */
    getCacheKey(productImage, options) {
        const { userPrompt = '' } = options;

        // Use image src and prompt for cache key
        const imageSrc = productImage.src || productImage.currentSrc || '';

        // Simple hash of the image src (first 50 chars + length)
        const imageHash = imageSrc.substring(0, 50) + imageSrc.length;

        // Simple hash of prompt (first 30 chars + length)
        const promptHash = userPrompt.substring(0, 30) + userPrompt.length;

        return `prompt_${imageHash}_${promptHash}`;
    }

    /**
     * Analyze detected products against user's prompt (moved from ContentScriptManager)
     * This method is kept for potential future use when prompt mode is re-enabled
     * @param {Array<Object>} detectedProducts - Array of detected product objects
     * @param {string} userPrompt - User's search prompt
     * @param {Object} callbacks - Callback functions for progress and completion
     * @returns {Promise<Array>} Analysis results
     */
    async analyzeDetectedProducts(detectedProducts, userPrompt, callbacks = {}) {
        console.log('🎯 ProductSearchMatcher.analyzeDetectedProducts called');
        console.log('   Products:', detectedProducts.length);
        console.log('   Prompt:', userPrompt);

        if (detectedProducts.length === 0) {
            console.log('ℹ️ No detected products to analyze');
            return [];
        }

        if (!userPrompt) {
            console.warn('⚠️ No prompt provided');
            return [];
        }

        // Extract image elements from detected products
        const productImages = detectedProducts.map(product => product.element);

        try {
            // Initialize the analyzer
            await this.initialize();

            // Analyze products in batches
            console.log('🚀 Starting batch analysis...');
            const analysisResults = await this.analyzeBatch(
                productImages,
                { userPrompt },
                {
                    batchSize: 10,
                    delayBetweenBatches: 500,
                    onProgress: (progress) => {
                        console.log(`📊 Analysis progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
                        if (callbacks.onProgress) {
                            callbacks.onProgress(progress);
                        }
                    }
                }
            );

            console.log('✅ Batch analysis complete, results:', analysisResults);
            return analysisResults;

        } catch (error) {
            console.error('❌ Product analysis failed:', error);
            if (callbacks.onError) {
                callbacks.onError(error);
            }
            return [];
        }
    }

}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ProductSearchMatcher = ProductSearchMatcher;
}
