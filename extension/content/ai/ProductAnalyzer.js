/**
 * ProductAnalyzer analyzes detected product images against user's style profile
 * and provides compatibility scores using Chrome's built-in AI
 */
export class ProductAnalyzer {
    constructor() {
        this.analysisCache = new Map();
        this.maxCacheSize = 100;
        this.isInitialized = false;
        this.pendingAnalyses = new Map();
    }

    /**
     * Initialize AI session for product analysis
     * @returns {Promise<boolean>} True if initialized successfully
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('✅ ProductAnalyzer already initialized');
            return true;
        }

        console.log('🔧 Initializing ProductAnalyzer...');

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

            // Check model availability (using correct method from docs)
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

            this.isInitialized = true;
            console.log('✅ ProductAnalyzer initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize ProductAnalyzer:', error);
            console.error('   Error details:', error.message, error.stack);
            return false;
        }
    }

    /**
     * Analyze a single product image against user's style profile
     * @param {HTMLImageElement} productImage - Product image element
     * @param {Object} styleProfile - User's style profile
     * @returns {Promise<Object>} Analysis result with score (1-10) and reasoning
     */
    async analyzeProduct(productImage, styleProfile) {
        console.log('🔍 analyzeProduct called for:', {
            alt: productImage.alt,
            src: productImage.src.substring(0, 60) + '...'
        });

        if (!this.isInitialized) {
            console.log('⚠️ ProductAnalyzer not initialized, initializing now...');
            const initialized = await this.initialize();
            if (!initialized) {
                console.error('❌ Failed to initialize ProductAnalyzer');
                return {
                    success: false,
                    score: 5,
                    reasoning: 'AI not available - neutral score',
                    method: 'fallback'
                };
            }
        }

        // Check cache first
        const cacheKey = this.getCacheKey(productImage, styleProfile);
        if (this.analysisCache.has(cacheKey)) {
            const cached = this.analysisCache.get(cacheKey);
            console.log('📦 Using cached analysis for product:', cached);
            return { ...cached, cached: true };
        }

        // Check if this product is already being analyzed
        if (this.pendingAnalyses.has(cacheKey)) {
            console.log('⏳ Analysis already in progress, waiting...');
            return await this.pendingAnalyses.get(cacheKey);
        }

        // Create promise for this analysis
        console.log('🚀 Starting new analysis for product');
        const analysisPromise = this._performAnalysis(productImage, styleProfile, cacheKey);
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
     * Perform the actual AI analysis
     * @private
     */
    async _performAnalysis(productImage, styleProfile, cacheKey) {
        console.log('📝 _performAnalysis started');

        try {
            // Build analysis prompt
            console.log('🔨 Building analysis prompt...');
            const prompt = this.buildAnalysisPrompt(productImage, styleProfile);
            console.log('📄 Prompt built (length: ' + prompt.length + ' chars)');
            console.log('📄 Full prompt:\n', prompt);

            // Create AI session (using official Prompt API - exactly as documented)
            console.log('🤖 Creating LanguageModel session for this analysis...');
            const session = await window.LanguageModel.create({
                temperature: 0.3,  // Slightly higher for varied scoring
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

            // Parse response
            console.log('🔍 Parsing AI response...');
            const result = this.parseAnalysisResponse(response);
            console.log('✅ Parsed result:', result);

            // Cache the result
            this.cacheResult(cacheKey, result);

            console.log(`✅ Product analyzed: Score ${result.score}/10 - ${result.reasoning}`);
            return result;

        } catch (error) {
            console.error('❌ Product analysis failed:', error);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            return {
                success: false,
                score: 5,
                reasoning: 'Analysis error - neutral score',
                method: 'error_fallback',
                error: error.message
            };
        }
    }

    /**
     * Analyze multiple products in batches
     * @param {Array<HTMLImageElement>} productImages - Array of product image elements
     * @param {Object} styleProfile - User's style profile
     * @param {Object} options - Batch options
     * @returns {Promise<Array<Object>>} Array of analysis results
     */
    async analyzeBatch(productImages, styleProfile, options = {}) {
        const {
            batchSize = 3,
            delayBetweenBatches = 500,
            onProgress = null
        } = options;

        if (!this.isInitialized) {
            await this.initialize();
        }

        const results = [];
        const totalProducts = productImages.length;

        console.log(`🔄 Starting batch analysis of ${totalProducts} products (${batchSize} at a time)`);

        // Process in batches
        for (let i = 0; i < productImages.length; i += batchSize) {
            const batch = productImages.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(productImages.length / batchSize);

            console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

            // Analyze batch concurrently
            const batchPromises = batch.map(img =>
                this.analyzeProduct(img, styleProfile)
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
     * Build analysis prompt for AI
     * @private
     */
    buildAnalysisPrompt(productImage, styleProfile) {
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

        const prompt = `Analyze this clothing item for style compatibility:

IMAGE CONTEXT:
- Alt text: "${altText}"
- ${imageContext}

USER'S STYLE PROFILE:
- Best colors: ${bestColors.join(', ')}
${avoidColors.length > 0 ? `- Avoid colors: ${avoidColors.join(', ')}` : ''}
- Style categories: ${styleCategories.join(', ')}
- Aesthetic: ${aestheticKeywords.join(', ')}
- Recommended patterns: ${recommendedPatterns.join(', ')}
${avoidPatterns.length > 0 ? `- Avoid patterns: ${avoidPatterns.join(', ')}` : ''}

TASK:
Rate this item's compatibility with the user's style from 1-10. Be VERY STRICT and critical:
- 1-3: Major conflicts with style (wrong colors, opposite aesthetic, clashing patterns)
- 4-6: Partial conflicts or neutral (some mismatches with user's preferences)
- 7-8: Good match (fits most style preferences but not exceptional)
- 9-10: Perfect match (exceptional alignment with colors, patterns, and aesthetic - ONLY award these scores to items that truly excel)

Be critical and selective. Most items should score 1-8. Only give 9-10 to items that are TRULY exceptional matches.

Respond in this exact format:
SCORE: [number 1-10]
REASON: [brief 1-sentence explanation]

Example response:
SCORE: 8
REASON: Navy blazer matches classic style and recommended colors well.`;

        return prompt;
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
     * Parse AI response to extract score (1-10) and reasoning
     * @private
     */
    parseAnalysisResponse(response) {
        try {
            const lines = response.split('\n');
            let score = 5;
            let reasoning = 'Unable to analyze';

            for (const line of lines) {
                if (line.includes('SCORE:')) {
                    const scoreMatch = line.match(/SCORE:\s*(\d+)/i);
                    if (scoreMatch) {
                        score = parseInt(scoreMatch[1], 10);
                        score = Math.max(1, Math.min(10, score)); // Clamp to 1-10
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
                score: 5,
                reasoning: 'Parse error - neutral score',
                method: 'parse_error_fallback'
            };
        }
    }

    /**
     * Generate cache key for product and profile
     * @private
     */
    getCacheKey(productImage, styleProfile) {
        // Use image src and profile version/timestamp for cache key
        const imageSrc = productImage.src || productImage.currentSrc || '';
        const profileVersion = styleProfile.version || '1.0';
        const profileTimestamp = styleProfile.generated_at || 0;

        // Simple hash of the image src (first 50 chars + length)
        const imageHash = imageSrc.substring(0, 50) + imageSrc.length;

        return `${imageHash}_${profileVersion}_${profileTimestamp}`;
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
        console.log('🧹 Product analysis cache cleared');
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
     * Utility delay function
     * @private
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Destroy analyzer and clean up resources
     */
    async destroy() {
        this.analysisCache.clear();
        this.pendingAnalyses.clear();
        this.isInitialized = false;

        console.log('🗑️ ProductAnalyzer destroyed');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ProductAnalyzer = ProductAnalyzer;
}