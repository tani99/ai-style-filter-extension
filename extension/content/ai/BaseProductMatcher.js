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
                temperature: 0.3,
                topK: 5
            });

            console.log('✅ Test session created successfully');
            testSession.destroy();
            console.log('✅ Test session destroyed');

            // Check if image classification API is available
            console.log('🔧 Checking image classification API...');
            this.isImageClassifierAvailable = typeof window !== 'undefined' &&
                                              window.ai &&
                                              typeof window.ai.createImageClassifier === 'function';

            if (this.isImageClassifierAvailable) {
                console.log('✅ Image classification API available');
                // Test it
                try {
                    const testClassifier = await window.ai.createImageClassifier();
                    testClassifier.destroy();
                    console.log('✅ Image classification test successful');
                } catch (error) {
                    console.warn('⚠️ Image classification test failed:', error.message);
                    this.isImageClassifierAvailable = false;
                }
            } else {
                console.warn('⚠️ Image classification API not available - will use alt text only');
            }

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
        console.log('🔍 analyze called for:', {
            alt: productImage.alt,
            options: options,
            src: productImage.src.substring(0, 60) + '...'
        });

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
                console.log('📦 Using cached analysis for product:', cached);
                return { ...cached, cached: true };
            }
        }

        // Check if this product is already being analyzed
        if (this.pendingAnalyses.has(cacheKey)) {
            console.log('⏳ Analysis already in progress, waiting...');
            return await this.pendingAnalyses.get(cacheKey);
        }

        // Create promise for this analysis (using child's implementation)
        console.log('🚀 Starting new analysis for product');
        const analysisPromise = this._performAnalysis(productImage, options, cacheKey);
        this.pendingAnalyses.set(cacheKey, analysisPromise);

        try {
            const result = await analysisPromise;
            console.log('✅ Analysis complete:', result);
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
     * Parse AI response to extract score and reasoning
     * Shared implementation - uses child's maxScore property
     * @param {string} response - Raw AI response
     * @returns {Object} Parsed result with score and reasoning
     */
    parseAnalysisResponse(response) {
        try {
            const lines = response.split('\n');
            let score = Math.ceil(this.maxScore / 2); // Default to middle score
            let reasoning = 'Unable to analyze';

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
            }

            return {
                success: true,
                score,
                reasoning,
                method: 'ai_analysis',
                rawResponse: response
            };

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
        console.log('📝 _performAnalysis started');

        try {
            // Build analysis prompt (using child's implementation)
            console.log('🔨 Building analysis prompt...');
            const prompt = await this.buildPrompt(productImage, options);
            console.log('📄 Prompt built (length: ' + prompt.length + ' chars)');
            console.log('📄 Full prompt:\n', prompt);

            // Create AI session (using official Prompt API)
            console.log('🤖 Creating LanguageModel session for this analysis...');
            const session = await window.LanguageModel.create({
                temperature: 0.1,
                topK: 5
            });
            console.log('✅ LanguageModel session created');

            // Get AI response
            console.log('🤖 Sending prompt to session...');
            const response = await session.prompt(prompt);
            console.log('🤖 Response received:', response);

            // Clean up session
            session.destroy();
            console.log('🗑️ Session destroyed');

            // Parse response (using child's implementation)
            console.log('🔍 Parsing AI response...');
            const result = this.parseAnalysisResponse(response);
            console.log('✅ Parsed result:', result);

            // Cache the result
            this.cacheResult(cacheKey, result);

            console.log(`✅ Analysis complete: ${JSON.stringify(result)}`);
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
            console.log('📄 Description prompt built (length: ' + prompt.length + ' chars)');

            // Create AI session
            console.log('🤖 Creating LanguageModel session for description...');
            const session = await window.LanguageModel.create({
                temperature: 0.7,  // Higher temperature for more creative descriptions
                topK: 20
            });
            console.log('✅ LanguageModel session created');

            // Get AI response
            console.log('🤖 Generating outfit description...');
            const description = await session.prompt(prompt);
            console.log('✅ Description received:', description.substring(0, 100) + '...');

            // Clean up session
            session.destroy();
            console.log('🗑️ Session destroyed');

            // Clean up the description (remove any extra formatting)
            const cleanDescription = description.trim();

            console.log('✅ Outfit description generated successfully');
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
