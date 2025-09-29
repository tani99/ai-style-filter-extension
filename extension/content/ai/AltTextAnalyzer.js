/**
 * AltTextAnalyzer uses Chrome's built-in language model to analyze image alt text
 * and determine if it describes clothing or fashion items
 */
export class AltTextAnalyzer {
    constructor() {
        this.isAIAvailable = false;
        this.checkAIAvailability();
    }

    /**
     * Check if Chrome's AI is available
     * @private
     */
    async checkAIAvailability() {
        try {
            this.isAIAvailable = typeof window !== 'undefined' &&
                                 window.ai &&
                                 typeof window.ai.createTextSession === 'function';
        } catch (error) {
            this.isAIAvailable = false;
        }
    }

    /**
     * Analyze image alt text using Chrome's language model
     * @param {HTMLImageElement} img - The image element to analyze
     * @returns {Promise<Object>} Analysis result with confidence and classification
     */
    async analyzeAltTextWithAI(img) {
        // Extract text content from image
        const alt = img.alt || '';
        const title = img.title || '';
        const src = img.src || '';

        // Return early if no text content to analyze
        if (!alt && !title) {
            return {
                confident: false,
                reason: 'No alt text or title available'
            };
        }

        // Check AI availability
        if (!this.isAIAvailable) {
            return {
                confident: false,
                reason: 'Chrome AI not available'
            };
        }

        try {
            // Create AI text session
            const session = await window.ai.createTextSession({
                temperature: 0.1, // Low temperature for consistent classification
                topK: 1
            });

            // Create analysis prompt
            const prompt = this.createAnalysisPrompt(alt, title, src);

            // Get AI response
            const response = await session.prompt(prompt);

            // Clean up session
            session.destroy();

            // Parse and return result
            return this.parseAIResponse(response);

        } catch (error) {
            console.log('AI alt text analysis failed:', error);
            return {
                confident: false,
                reason: 'AI analysis error',
                error: error.message
            };
        }
    }

    /**
     * Create the analysis prompt for the AI
     * @param {string} alt - Alt text
     * @param {string} title - Title text
     * @param {string} src - Image source URL
     * @returns {string} Formatted prompt
     * @private
     */
    createAnalysisPrompt(alt, title, src) {
        const filename = src.split('/').pop() || '';

        return `Analyze this image description and determine if it describes clothing, shoes, or fashion accessories.

Image alt text: "${alt}"
Image title: "${title}"
Image filename: "${filename}"

Respond with ONLY one of these formats:
- "CLOTHING: [item type]" if it's clothing/shoes/accessories
- "NOT_CLOTHING: [reason]" if it's not clothing

Examples:
- "CLOTHING: dress" for a dress
- "CLOTHING: sneakers" for shoes
- "CLOTHING: handbag" for accessories
- "NOT_CLOTHING: logo" for company logos
- "NOT_CLOTHING: navigation" for UI elements
- "NOT_CLOTHING: model" for person/model photos without focus on clothing`;
    }

    /**
     * Parse the AI response into a structured result
     * @param {string} response - Raw AI response
     * @returns {Object} Parsed result
     * @private
     */
    parseAIResponse(response) {
        const cleanResponse = response.trim();

        if (cleanResponse.startsWith('CLOTHING:')) {
            const itemType = cleanResponse.split(':')[1]?.trim() || 'clothing item';
            return {
                confident: true,
                isClothing: true,
                reasoning: `AI classified as clothing: ${itemType}`,
                confidence: 0.9,
                method: 'ai_alt_text_analysis',
                itemType: itemType
            };
        }

        if (cleanResponse.startsWith('NOT_CLOTHING:')) {
            const reason = cleanResponse.split(':')[1]?.trim() || 'non-clothing item';
            return {
                confident: true,
                isClothing: false,
                reasoning: `AI classified as non-clothing: ${reason}`,
                confidence: 0.9,
                method: 'ai_alt_text_analysis',
                exclusionReason: reason
            };
        }

        // If response doesn't match expected format
        return {
            confident: false,
            reason: 'Unexpected AI response format',
            rawResponse: cleanResponse
        };
    }

    /**
     * Analyze multiple images' alt text in batch
     * @param {HTMLImageElement[]} images - Array of image elements
     * @param {Object} options - Analysis options
     * @returns {Promise<Array>} Array of analysis results
     */
    async analyzeMultipleAltTexts(images, options = {}) {
        const batchSize = options.batchSize || 5;
        const results = [];

        for (let i = 0; i < images.length; i += batchSize) {
            const batch = images.slice(i, i + batchSize);

            const batchPromises = batch.map(async (img, index) => {
                const globalIndex = i + index;
                try {
                    const result = await this.analyzeAltTextWithAI(img);
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
                            confident: false,
                            reason: 'Analysis failed',
                            error: error.message
                        }
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Add delay between batches to avoid overwhelming the AI
            if (i + batchSize < images.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return results;
    }

    /**
     * Get statistics about alt text content
     * @param {HTMLImageElement[]} images - Array of image elements
     * @returns {Object} Statistics about alt text availability
     */
    getAltTextStatistics(images) {
        const stats = {
            total: images.length,
            hasAlt: 0,
            hasTitle: 0,
            hasEither: 0,
            hasNeither: 0,
            avgAltLength: 0,
            avgTitleLength: 0
        };

        let totalAltLength = 0;
        let totalTitleLength = 0;

        images.forEach(img => {
            const alt = img.alt || '';
            const title = img.title || '';

            if (alt) {
                stats.hasAlt++;
                totalAltLength += alt.length;
            }
            if (title) {
                stats.hasTitle++;
                totalTitleLength += title.length;
            }
            if (alt || title) {
                stats.hasEither++;
            } else {
                stats.hasNeither++;
            }
        });

        stats.avgAltLength = stats.hasAlt > 0 ? Math.round(totalAltLength / stats.hasAlt) : 0;
        stats.avgTitleLength = stats.hasTitle > 0 ? Math.round(totalTitleLength / stats.hasTitle) : 0;

        return stats;
    }

    /**
     * Check if AI is currently available
     * @returns {boolean} True if AI is available
     */
    isAIReady() {
        return this.isAIAvailable;
    }

    /**
     * Perform a quick test of AI functionality
     * @returns {Promise<Object>} Test result
     */
    async testAIFunctionality() {
        if (!this.isAIAvailable) {
            return {
                success: false,
                reason: 'AI not available'
            };
        }

        try {
            const session = await window.ai.createTextSession({
                temperature: 0.1,
                topK: 1
            });

            const testResponse = await session.prompt('Respond with "TEST_SUCCESS" if you can understand this message.');
            session.destroy();

            const success = testResponse.includes('TEST_SUCCESS');

            return {
                success,
                response: testResponse,
                reason: success ? 'AI test passed' : 'Unexpected AI response'
            };
        } catch (error) {
            return {
                success: false,
                reason: 'AI test failed',
                error: error.message
            };
        }
    }

    /**
     * Extract clothing-related keywords from text
     * @param {string} text - Text to analyze
     * @returns {string[]} Array of clothing keywords found
     */
    extractClothingKeywords(text) {
        const clothingKeywords = [
            'dress', 'shirt', 'pants', 'jeans', 'skirt', 'blouse', 'sweater',
            'jacket', 'coat', 'shoes', 'boots', 'sneakers', 'sandals',
            'bag', 'handbag', 'purse', 'backpack', 'hat', 'cap',
            'jewelry', 'necklace', 'bracelet', 'watch', 'earrings',
            'top', 'bottom', 'outfit', 'clothing', 'fashion', 'style'
        ];

        const lowerText = text.toLowerCase();
        return clothingKeywords.filter(keyword => lowerText.includes(keyword));
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