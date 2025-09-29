/**
 * StyleMatcher handles style profile analysis and matching using Chrome's AI
 * to determine how well products align with user's style preferences
 */
export class StyleMatcher {
    constructor() {
        this.isAIAvailable = false;
        this.checkAIAvailability();
        this.fallbackRules = this.initializeFallbackRules();
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
     * Analyze product style using AI and user's style profile
     * @param {HTMLImageElement} img - The product image element
     * @param {Object} styleProfile - User's style profile
     * @returns {Promise<Object>} Style analysis result
     */
    async analyzeProductStyle(img, styleProfile) {
        if (!styleProfile) {
            return {
                confident: false,
                reason: 'No style profile available'
            };
        }

        // Check AI availability
        if (!this.isAIAvailable) {
            return this.fallbackProductAnalysis(img, styleProfile);
        }

        try {
            // Create AI text session
            const session = await window.ai.createTextSession({
                temperature: 0.2, // Low temperature for consistent analysis
                topK: 3
            });

            // Create analysis prompt
            const prompt = this.createProductAnalysisPrompt(img, styleProfile);

            // Get AI response
            const response = await session.prompt(prompt);

            // Clean up session
            session.destroy();

            // Parse and return result
            return this.parseProductAnalysisResponse(response);

        } catch (error) {
            console.log('AI product style analysis failed:', error);
            return this.fallbackProductAnalysis(img, styleProfile);
        }
    }

    /**
     * Create the analysis prompt for product style matching
     * @param {HTMLImageElement} img - The product image element
     * @param {Object} styleProfile - User's style profile
     * @returns {string} Formatted prompt
     * @private
     */
    createProductAnalysisPrompt(img, styleProfile) {
        const alt = img.alt || '';
        const title = img.title || '';
        const src = img.src || '';
        const filename = src.split('/').pop() || '';

        // Extract style categories and colors from profile
        const categories = styleProfile.categories || [];
        const colors = styleProfile.colors || [];
        const reasoning = styleProfile.reasoning || '';

        const userStyleCategories = categories.map(cat =>
            `${cat.category} (${Math.round(cat.confidence * 100)}%)`
        ).join(', ');

        const userColors = colors.map(color =>
            `${color.name || 'color'} (${color.hex})`
        ).join(', ');

        return `Analyze if this product matches the user's style preferences.

Product Information:
- Alt text: "${alt}"
- Title: "${title}"
- Filename: "${filename}"

User's Style Profile:
- Preferred categories: ${userStyleCategories}
- Preferred colors: ${userColors}
- Style reasoning: "${reasoning}"

Respond with ONLY one of these formats:
- "MATCH: [score 0-100] - [reason]" if it matches their style
- "NO_MATCH: [score 0-100] - [reason]" if it doesn't match

Examples:
- "MATCH: 85 - Casual dress matches user's bohemian and casual style preferences"
- "NO_MATCH: 20 - Formal suit doesn't align with user's casual streetwear style"

Consider style categories, color preferences, and overall aesthetic compatibility.`;
    }

    /**
     * Parse the AI response into a structured result
     * @param {string} response - Raw AI response
     * @returns {Object} Parsed result
     * @private
     */
    parseProductAnalysisResponse(response) {
        const cleanResponse = response.trim();

        // Parse MATCH response
        const matchRegex = /^MATCH:\s*(\d+)\s*-\s*(.+)$/i;
        const matchMatch = cleanResponse.match(matchRegex);

        if (matchMatch) {
            const score = parseInt(matchMatch[1]);
            const reason = matchMatch[2].trim();

            return {
                confident: true,
                isStyleMatch: true,
                score: score,
                reasoning: `AI style analysis: ${reason}`,
                confidence: Math.min(score / 100, 0.95), // Convert to 0-1 scale
                method: 'ai_style_analysis'
            };
        }

        // Parse NO_MATCH response
        const noMatchRegex = /^NO_MATCH:\s*(\d+)\s*-\s*(.+)$/i;
        const noMatchMatch = cleanResponse.match(noMatchRegex);

        if (noMatchMatch) {
            const score = parseInt(noMatchMatch[1]);
            const reason = noMatchMatch[2].trim();

            return {
                confident: true,
                isStyleMatch: false,
                score: score,
                reasoning: `AI style analysis: ${reason}`,
                confidence: Math.min((100 - score) / 100, 0.95),
                method: 'ai_style_analysis'
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
     * Fallback product analysis using rule-based matching
     * @param {HTMLImageElement} img - The product image element
     * @param {Object} styleProfile - User's style profile
     * @returns {Object} Analysis result
     * @private
     */
    fallbackProductAnalysis(img, styleProfile) {
        const alt = (img.alt || '').toLowerCase();
        const title = (img.title || '').toLowerCase();
        const text = `${alt} ${title}`;

        const categories = styleProfile.categories || [];
        const colors = styleProfile.colors || [];

        let matchScore = 0;
        let matchReasons = [];

        // Check category matches
        for (const userCategory of categories) {
            const categoryName = userCategory.category.toLowerCase();
            const categoryConfidence = userCategory.confidence || 0;

            if (this.fallbackRules.categories[categoryName]) {
                const keywords = this.fallbackRules.categories[categoryName];
                for (const keyword of keywords) {
                    if (text.includes(keyword)) {
                        const points = Math.round(categoryConfidence * 30);
                        matchScore += points;
                        matchReasons.push(`${categoryName} style (${keyword}): +${points} points`);
                        break; // Only count each category once
                    }
                }
            }
        }

        // Check color matches (basic text matching)
        for (const userColor of colors) {
            const colorName = (userColor.name || '').toLowerCase();
            if (colorName && text.includes(colorName)) {
                matchScore += 10;
                matchReasons.push(`color match (${colorName}): +10 points`);
            }
        }

        // Determine if it's a match (threshold: 25 points)
        const isMatch = matchScore >= 25;
        const confidence = Math.min(matchScore / 100, 0.8); // Max 80% confidence for fallback

        return {
            confident: matchScore > 0,
            isStyleMatch: isMatch,
            score: matchScore,
            reasoning: matchReasons.length > 0
                ? `Fallback analysis: ${matchReasons.join('; ')}`
                : 'Fallback analysis: No clear style indicators found',
            confidence: confidence,
            method: 'fallback_style_analysis'
        };
    }

    /**
     * Initialize fallback matching rules
     * @returns {Object} Fallback rules object
     * @private
     */
    initializeFallbackRules() {
        return {
            categories: {
                'casual': ['casual', 'everyday', 'relaxed', 'comfort', 'basic', 't-shirt', 'jeans'],
                'formal': ['formal', 'business', 'office', 'professional', 'suit', 'blazer', 'dress shirt'],
                'bohemian': ['boho', 'bohemian', 'flowy', 'peasant', 'ethnic', 'festival', 'free-spirited'],
                'minimalist': ['minimal', 'simple', 'clean', 'basic', 'essential', 'sleek'],
                'vintage': ['vintage', 'retro', 'classic', 'timeless', 'throwback', 'old-school'],
                'streetwear': ['street', 'urban', 'hip-hop', 'sneaker', 'hoodie', 'cap', 'graphic'],
                'sporty': ['sport', 'athletic', 'active', 'gym', 'workout', 'performance', 'athletic'],
                'edgy': ['edgy', 'punk', 'rock', 'leather', 'studded', 'grunge', 'alternative'],
                'romantic': ['romantic', 'feminine', 'floral', 'lace', 'ruffles', 'soft', 'delicate'],
                'preppy': ['preppy', 'ivy', 'collegiate', 'blazer', 'polo', 'plaid', 'classic']
            }
        };
    }

    /**
     * Analyze multiple products in batch
     * @param {Array} products - Array of {img, styleProfile} objects
     * @param {Object} options - Analysis options
     * @returns {Promise<Array>} Array of analysis results
     */
    async analyzeMultipleProducts(products, options = {}) {
        const batchSize = options.batchSize || 3; // Smaller batch for style analysis
        const results = [];

        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);

            const batchPromises = batch.map(async (product, index) => {
                const globalIndex = i + index;
                try {
                    const result = await this.analyzeProductStyle(product.img, product.styleProfile);
                    return {
                        index: globalIndex,
                        element: product.img,
                        result: result
                    };
                } catch (error) {
                    return {
                        index: globalIndex,
                        element: product.img,
                        result: {
                            confident: false,
                            reason: 'Style analysis failed',
                            error: error.message,
                            method: 'error'
                        }
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Add delay between batches
            if (i + batchSize < products.length) {
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }

        return results;
    }

    /**
     * Get style matching statistics
     * @param {Array} analysisResults - Array of analysis results
     * @returns {Object} Statistics about style matching
     */
    getStyleMatchingStats(analysisResults) {
        const stats = {
            total: analysisResults.length,
            matches: 0,
            noMatches: 0,
            aiAnalyzed: 0,
            fallbackAnalyzed: 0,
            averageScore: 0,
            averageConfidence: 0
        };

        let totalScore = 0;
        let totalConfidence = 0;

        analysisResults.forEach(analysis => {
            const result = analysis.result;

            if (result.confident) {
                if (result.isStyleMatch) {
                    stats.matches++;
                } else {
                    stats.noMatches++;
                }

                if (result.method === 'ai_style_analysis') {
                    stats.aiAnalyzed++;
                } else if (result.method === 'fallback_style_analysis') {
                    stats.fallbackAnalyzed++;
                }

                totalScore += result.score || 0;
                totalConfidence += result.confidence || 0;
            }
        });

        const analyzedCount = stats.matches + stats.noMatches;
        stats.averageScore = analyzedCount > 0 ? Math.round(totalScore / analyzedCount) : 0;
        stats.averageConfidence = analyzedCount > 0 ? Math.round((totalConfidence / analyzedCount) * 100) : 0;

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
     * Test AI style analysis functionality
     * @returns {Promise<Object>} Test result
     */
    async testStyleAnalysis() {
        if (!this.isAIAvailable) {
            return {
                success: false,
                reason: 'AI not available'
            };
        }

        try {
            const session = await window.ai.createTextSession({
                temperature: 0.2,
                topK: 3
            });

            const testResponse = await session.prompt('Respond with "MATCH: 75 - Test successful" if you can understand this message.');
            session.destroy();

            const parsed = this.parseProductAnalysisResponse(testResponse);
            const success = parsed.confident && parsed.isStyleMatch;

            return {
                success,
                response: testResponse,
                parsed: parsed,
                reason: success ? 'AI style analysis test passed' : 'Unexpected AI response'
            };
        } catch (error) {
            return {
                success: false,
                reason: 'AI style analysis test failed',
                error: error.message
            };
        }
    }

    /**
     * Add or update a fallback category rule
     * @param {string} category - Category name
     * @param {string[]} keywords - Keywords for the category
     */
    updateFallbackRule(category, keywords) {
        this.fallbackRules.categories[category.toLowerCase()] = keywords.map(k => k.toLowerCase());
    }

    /**
     * Get current fallback rules
     * @returns {Object} Current fallback rules
     */
    getFallbackRules() {
        return { ...this.fallbackRules };
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