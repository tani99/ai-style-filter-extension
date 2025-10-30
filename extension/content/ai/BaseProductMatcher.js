/**
 * BaseProductMatcher - Parent class for AI-powered product matching
 * Contains shared functionality for caching, initialization, and utilities
 * used by PersonalStyleMatcher and ProductSearchMatcher
 */
export class BaseProductMatcher {
    constructor() {
        this.analysisCache = new Map();
        this.maxCacheSize = 100;
        this.isInitialized = false;
        this.pendingAnalyses = new Map();
        this.isImageClassifierAvailable = false;
    }

    /**
     * Initialize AI session for analysis
     * @returns {Promise<boolean>} True if initialized successfully
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('✅ Analyzer already initialized');
            return true;
        }

        console.log('🔧 Initializing Analyzer...');

        try {
            // Check if LanguageModel is available (official Prompt API)
            if (!window.LanguageModel) {
                console.error('❌ Chrome Prompt API not available');
                console.log('   window.LanguageModel:', window.LanguageModel);
                console.error('');
                console.error('📌 TO FIX THIS:');
                console.error('   1. Check Chrome version (need 128+): chrome://settings/help');
                console.error('   2. Enable flag: chrome://flags/#prompt-api-for-gemini-nano → Enabled');
                console.error('   3. Enable flag: chrome://flags/#optimization-guide-on-device-model → Enabled BypassPerfRequirement');
                console.error('   4. Restart Chrome completely');
                console.error('   5. Wait 5 mins for model download');
                console.error('   6. Test: Run in console: await window.LanguageModel.availability()');
                console.error('');
                return false;
            }

            console.log('✅ Chrome Prompt API detected (window.LanguageModel available)');

            // Check model availability
            console.log('🔧 Checking model availability...');
            const availability = await window.LanguageModel.availability();
            console.log('📊 Model availability:', availability);

            if (availability === 'no') {
                console.error('❌ Language model not available');
                return false;
            }

            if (availability === 'after-download') {
                console.warn('⚠️ Model is downloading... Please wait and try again in a few minutes');
                console.log('   Status:', availability);
                return false;
            }

            console.log('✅ Model is available');

            // Test creating a session to verify it works
            console.log('🔧 Testing session creation...');
            const testSession = await window.LanguageModel.create({
                temperature: 0,
                topK: 5
            });

            console.log('✅ Test session created successfully');
            testSession.destroy();
            console.log('✅ Test session destroyed');

            // Image classification explicitly disabled; rely on alt text only
            this.isImageClassifierAvailable = false;
            console.log('ℹ️ Image classification disabled; using alt text only');

            this.isInitialized = true;
            console.log('✅ Analyzer initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize Analyzer:', error);
            console.error('   Error details:', error.message, error.stack);
            return false;
        }
    }

    /**
     * Extract context information from image element
     * @private
     */
    extractImageContext(img) {
        const contexts = [];

        // Check parent elements for product info
        let parent = img.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
            // Look for price indicators
            const priceElements = parent.querySelectorAll('[class*="price"], [class*="Price"]');
            if (priceElements.length > 0) {
                contexts.push('product listing context');
                break;
            }

            // Look for product titles
            const titleElements = parent.querySelectorAll('h1, h2, h3, h4, [class*="title"], [class*="Title"]');
            if (titleElements.length > 0) {
                const titleText = Array.from(titleElements)
                    .map(el => el.textContent.trim())
                    .filter(text => text.length > 0 && text.length < 100)
                    .slice(0, 1);
                if (titleText.length > 0) {
                    contexts.push(`product title: "${titleText[0]}"`);
                }
            }

            parent = parent.parentElement;
            depth++;
        }

        return contexts.length > 0 ? contexts.join(', ') : 'no additional context';
    }

    /**
     * Cache analysis result
     * @private
     */
    cacheResult(cacheKey, result) {
        // Implement LRU-style cache: remove oldest if at max size
        if (this.analysisCache.size >= this.maxCacheSize) {
            const firstKey = this.analysisCache.keys().next().value;
            this.analysisCache.delete(firstKey);
        }

        this.analysisCache.set(cacheKey, {
            ...result,
            cachedAt: Date.now()
        });
    }

    /**
     * Clear analysis cache
     */
    clearCache() {
        this.analysisCache.clear();
        console.log('🧹 Analysis cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getCacheStats() {
        return {
            size: this.analysisCache.size,
            maxSize: this.maxCacheSize,
            utilizationPercentage: Math.round((this.analysisCache.size / this.maxCacheSize) * 100)
        };
    }

    /**
     * Unified analyze method - handles common analysis flow
     * Children should implement _performAnalysis() and getCacheKey()
     * @param {HTMLImageElement} productImage - Product image element
     * @param {Object} options - Analysis options (styleProfile, userPrompt, etc.)
     * @returns {Promise<Object>} Analysis result
     */
    async analyze(productImage, options = {}) {
        if (!this.isInitialized) {
            console.log('⚠️ Analyzer not initialized, initializing now...');
            const initialized = await this.initialize();
            if (!initialized) {
                console.error('❌ Failed to initialize Analyzer');
                return this._getDefaultFallback();
            }
        }

        // Check cache first (using child's cache key implementation)
        const cacheKey = this.getCacheKey(productImage, options);
        if (this.analysisCache.has(cacheKey)) {
            const cached = this.analysisCache.get(cacheKey);

            // VALIDATION: Ensure cached score is within valid range for this analyzer
            if (cached.score && (cached.score < 1 || cached.score > this.maxScore)) {
                console.warn(`⚠️ Invalid cached score ${cached.score} (expected 1-${this.maxScore}). Clearing stale cache entry.`);
                this.analysisCache.delete(cacheKey);
                // Continue to perform new analysis below
            } else {
                return { ...cached, cached: true };
            }
        }

        // Check if this product is already being analyzed
        if (this.pendingAnalyses.has(cacheKey)) {
            return await this.pendingAnalyses.get(cacheKey);
        }

        // Create promise for this analysis (using child's implementation)
        const analysisPromise = this._performAnalysis(productImage, options, cacheKey);
        this.pendingAnalyses.set(cacheKey, analysisPromise);

        try {
            const result = await analysisPromise;
            return result;
        } finally {
            this.pendingAnalyses.delete(cacheKey);
        }
    }

    /**
     * Get default fallback result when initialization fails
     * Uses child's maxScore to return neutral score
     * @private
     */
    _getDefaultFallback() {
        return {
            success: false,
            score: Math.ceil(this.maxScore / 2),
            reasoning: 'AI not available - neutral result',
            method: 'fallback'
        };
    }

    /**
     * Generate cache key for product and options
     * Children MUST override this method
     * @param {HTMLImageElement} productImage - Product image element
     * @param {Object} options - Analysis options
     * @returns {string} Cache key
     */
    getCacheKey(productImage, options) {
        throw new Error('getCacheKey() must be implemented by child class');
    }

    /**
     * Build analysis prompt for AI
     * Children MUST override this method
     * @param {HTMLImageElement} productImage - Product image element
     * @param {Object} options - Analysis options
     * @returns {Promise<string>} Formatted prompt
     */
    async buildPrompt(productImage, options) {
        throw new Error('buildPrompt() must be implemented by child class');
    }

    /**
     * Parse AI response to extract score, reasoning, and description
     * Shared implementation - uses child's maxScore property
     * @param {string} response - Raw AI response
     * @returns {Object} Parsed result with score, reasoning, and description
     */
    parseAnalysisResponse(response) {
        try {
            const lines = response.split('\n');
            let score = Math.ceil(this.maxScore / 2); // Default to middle score
            let reasoning = 'Unable to analyze';
            let description = null;

            for (const line of lines) {
                if (line.includes('SCORE:')) {
                    const scoreMatch = line.match(/SCORE:\s*(\d+)/i);
                    if (scoreMatch) {
                        score = parseInt(scoreMatch[1], 10);
                        score = Math.max(1, Math.min(this.maxScore, score)); // Clamp to 1-maxScore
                    }
                }
                if (line.includes('REASON:')) {
                    reasoning = line.replace(/REASON:/i, '').trim();
                }
                if (line.includes('DESCRIPTION:')) {
                    description = line.replace(/DESCRIPTION:/i, '').trim();
                }
            }

            // If description spans multiple lines, capture the rest
            if (description !== null) {
                const descriptionIndex = lines.findIndex(line => line.includes('DESCRIPTION:'));
                if (descriptionIndex !== -1) {
                    // Get the description from the same line
                    const firstLinePart = lines[descriptionIndex].replace(/DESCRIPTION:/i, '').trim();
                    // Get any additional lines that don't start with SCORE: or REASON:
                    const additionalLines = [];
                    for (let i = descriptionIndex + 1; i < lines.length; i++) {
                        if (!lines[i].match(/^(SCORE:|REASON:|DESCRIPTION:)/i) && lines[i].trim()) {
                            additionalLines.push(lines[i].trim());
                        } else if (lines[i].match(/^(SCORE:|REASON:|DESCRIPTION:)/i)) {
                            break;
                        }
                    }
                    description = [firstLinePart, ...additionalLines].join(' ').trim();
                }
            }

            const result = {
                success: true,
                score,
                reasoning,
                method: 'ai_analysis',
                rawResponse: response
            };

            // Only include description if it was found
            if (description) {
                result.description = description;
            }

            return result;

        } catch (error) {
            console.error('Failed to parse analysis response:', error);
            return {
                success: false,
                score: Math.ceil(this.maxScore / 2),
                reasoning: 'Parse error - neutral score',
                method: 'parse_error_fallback'
            };
        }
    }

    /**
     * Perform the actual AI analysis
     * Shared implementation - calls child's buildPrompt() and parseAnalysisResponse()
     * @param {HTMLImageElement} productImage - Product image element
     * @param {Object} options - Analysis options
     * @param {string} cacheKey - Cache key for this analysis
     * @returns {Promise<Object>} Analysis result
     * @private
     */
    async _performAnalysis(productImage, options, cacheKey) {
        try {
            // Build analysis prompt (using child's implementation)
            const prompt = await this.buildPrompt(productImage, options);

            // Create AI session (using official Prompt API)
            const session = await window.LanguageModel.create({
                temperature: 0,
                topK: 5,
                outputLanguage: 'en'
            });

            // Get AI response
            const response = await session.prompt(prompt);

            // Clean up session
            session.destroy();

            // Parse response (using child's implementation)
            const result = this.parseAnalysisResponse(response);

            // Cache the result
            this.cacheResult(cacheKey, result);

            return result;

        } catch (error) {
            console.error('❌ Analysis failed:', error);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            return {
                success: false,
                score: Math.ceil(this.maxScore / 2),
                reasoning: 'Analysis error - neutral result',
                method: 'error_fallback',
                error: error.message
            };
        }
    }

    /**
     * Analyze multiple products in batches
     * Shared implementation - calls this.analyze() which uses child's implementations
     * @param {Array<HTMLImageElement>} productImages - Array of product image elements
     * @param {Object} analysisOptions - Options for analysis (styleProfile, userPrompt, etc.)
     * @param {Object} batchOptions - Batch processing options
     * @returns {Promise<Array<Object>>} Array of analysis results
     */
    async analyzeBatch(productImages, analysisOptions = {}, batchOptions = {}) {
        const {
            batchSize = 3,
            delayBetweenBatches = 500,
            onProgress = null
        } = batchOptions;

        if (!this.isInitialized) {
            await this.initialize();
        }

        const results = [];
        const totalProducts = productImages.length;

        console.log(`🔄 Starting batch analysis of ${totalProducts} products (${batchSize} at a time)`);
        if (analysisOptions.userPrompt) {
            console.log(`🔍 User prompt: "${analysisOptions.userPrompt}"`);
        }

        // Process in batches
        for (let i = 0; i < productImages.length; i += batchSize) {
            const batch = productImages.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(productImages.length / batchSize);

            console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

            // Analyze batch concurrently
            const batchPromises = batch.map(img =>
                this.analyze(img, analysisOptions)
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Call progress callback
            if (onProgress) {
                onProgress({
                    completed: results.length,
                    total: totalProducts,
                    percentage: Math.round((results.length / totalProducts) * 100)
                });
            }

            // Delay between batches (except for last batch)
            if (i + batchSize < productImages.length) {
                await this.delay(delayBetweenBatches);
            }
        }

        console.log(`✅ Batch analysis complete: ${results.length} products analyzed`);
        return results;
    }

    /**
     * Utility delay function
     * @private
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate detailed outfit description for virtual try-on
     * @param {HTMLImageElement} productImage - Product image element
     * @returns {Promise<string|null>} Outfit description or null if failed
     */
    async generateOutfitDescription(productImage) {
        console.log('👗 Generating outfit description for:', productImage.alt || productImage.src.substring(0, 60));

        if (!this.isInitialized) {
            console.log('⚠️ Analyzer not initialized, initializing now...');
            const initialized = await this.initialize();
            if (!initialized) {
                console.error('❌ Failed to initialize Analyzer');
                return null;
            }
        }

        try {
            // Import prompt builder (dynamic import to avoid circular dependencies)
            const { buildOutfitDescriptionPrompt } = await import('../config/Prompts.js');

            // Extract image information
            const altText = productImage.alt || '';
            const imageContext = this.extractImageContext(productImage);

            // Build prompt
            const prompt = buildOutfitDescriptionPrompt({ altText, imageContext });

            // Create AI session
            const session = await window.LanguageModel.create({
                temperature: 0,
                topK: 20,
                outputLanguage: 'en'
            });

            // Get AI response
            const description = await session.prompt(prompt);

            // Clean up session
            session.destroy();

            // Clean up the description (remove any extra formatting)
            const cleanDescription = description.trim();

            return cleanDescription;

        } catch (error) {
            console.error('❌ Failed to generate outfit description:', error);
            console.error('   Error message:', error.message);
            return null;
        }
    }

    /**
     * Destroy analyzer and clean up resources
     */
    async destroy() {
        this.analysisCache.clear();
        this.pendingAnalyses.clear();
        this.isInitialized = false;

        console.log('🗑️ Analyzer destroyed');
    }
}
