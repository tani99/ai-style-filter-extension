/**
 * PromptRankingEngine analyzes detected product images against user's text prompt
 * and provides compatibility scores using Chrome's built-in AI Prompt API
 * Uses actual image classification for accurate matching
 */
export class PromptRankingEngine {
    constructor() {
        this.analysisCache = new Map();
        this.maxCacheSize = 100;
        this.isInitialized = false;
        this.pendingAnalyses = new Map();
        this.isImageClassifierAvailable = false;
    }

    /**
     * Initialize AI session for prompt-based ranking
     * @returns {Promise<boolean>} True if initialized successfully
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('✅ PromptRankingEngine already initialized');
            return true;
        }

        console.log('🔧 Initializing PromptRankingEngine...');

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
            console.log('✅ PromptRankingEngine initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize PromptRankingEngine:', error);
            console.error('   Error details:', error.message, error.stack);
            return false;
        }
    }

    /**
     * Analyze a single product image against user's prompt
     * @param {HTMLImageElement} productImage - Product image element
     * @param {string} userPrompt - User's search prompt
     * @returns {Promise<Object>} Analysis result with tier (1=bad, 2=fine, 3=good) and reasoning
     */
    async analyzeProductWithPrompt(productImage, userPrompt) {
        console.log('🔍 analyzeProductWithPrompt called for:', {
            alt: productImage.alt,
            prompt: userPrompt,
            src: productImage.src.substring(0, 60) + '...'
        });

        if (!this.isInitialized) {
            console.log('⚠️ PromptRankingEngine not initialized, initializing now...');
            const initialized = await this.initialize();
            if (!initialized) {
                console.error('❌ Failed to initialize PromptRankingEngine');
                return {
                    success: false,
                    tier: 2,
                    reasoning: 'AI not available - neutral tier',
                    method: 'fallback'
                };
            }
        }

        // Check cache first
        const cacheKey = this.getCacheKey(productImage, userPrompt);
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
        console.log('🚀 Starting new prompt-based analysis for product');
        const analysisPromise = this._performPromptAnalysis(productImage, userPrompt, cacheKey);
        this.pendingAnalyses.set(cacheKey, analysisPromise);

        try {
            const result = await analysisPromise;
            console.log('✅ Prompt analysis complete:', result);
            return result;
        } finally {
            this.pendingAnalyses.delete(cacheKey);
        }
    }

    /**
     * Perform the actual AI analysis against user prompt
     * @private
     */
    async _performPromptAnalysis(productImage, userPrompt, cacheKey) {
        console.log('📝 _performPromptAnalysis started');

        try {
            // Build analysis prompt (now async because it classifies the image)
            console.log('🔨 Building prompt analysis prompt with image classification...');
            const prompt = await this.buildPromptAnalysisPrompt(productImage, userPrompt);
            console.log('📄 Prompt built (length: ' + prompt.length + ' chars)');
            console.log('📄 Full prompt:\n', prompt);

            // Create AI session
            console.log('🤖 Creating LanguageModel session for this analysis...');
            const session = await window.LanguageModel.create({
                temperature: 0.3,  // Lower temperature for more consistent scoring
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

            console.log(`✅ Product analyzed with prompt: Tier ${result.tier}/3 - ${result.reasoning}`);
            return result;

        } catch (error) {
            console.error('❌ Prompt-based product analysis failed:', error);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            return {
                success: false,
                tier: 2,
                reasoning: 'Analysis error - neutral tier',
                method: 'error_fallback',
                error: error.message
            };
        }
    }

    /**
     * Analyze multiple products in batches against user prompt
     * @param {Array<HTMLImageElement>} productImages - Array of product image elements
     * @param {string} userPrompt - User's search prompt
     * @param {Object} options - Batch options
     * @returns {Promise<Array<Object>>} Array of analysis results
     */
    async analyzeBatch(productImages, userPrompt, options = {}) {
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

        console.log(`🔄 Starting batch prompt analysis of ${totalProducts} products (${batchSize} at a time)`);
        console.log(`🔍 User prompt: "${userPrompt}"`);

        // Process in batches
        for (let i = 0; i < productImages.length; i += batchSize) {
            const batch = productImages.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(productImages.length / batchSize);

            console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} products)`);

            // Analyze batch concurrently
            const batchPromises = batch.map(img =>
                this.analyzeProductWithPrompt(img, userPrompt)
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

        console.log(`✅ Batch prompt analysis complete: ${results.length} products analyzed`);
        return results;
    }

    /**
     * Classify image using Chrome's image classification API
     * @param {HTMLImageElement} img - Image to classify
     * @returns {Promise<Object>} Classification results
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
     * Includes actual image classification results if available
     * @private
     */
    async buildPromptAnalysisPrompt(productImage, userPrompt) {
        // Get image context
        const altText = productImage.alt || '';
        const imageContext = this.extractImageContext(productImage);

        // Try to classify the actual image
        const imageClassification = await this.classifyImage(productImage);

        // Build classification info for the prompt
        let classificationInfo = '';
        if (imageClassification && imageClassification.classifications.length > 0) {
            classificationInfo = '\nIMAGE CLASSIFICATION (AI analyzed actual image pixels):';
            imageClassification.classifications.forEach((c, i) => {
                classificationInfo += `\n  ${i + 1}. ${c.label} (${c.confidence}% confidence)`;
            });
        }

        const prompt = `Analyze this clothing item for how well it matches this specific search request:

USER IS LOOKING FOR: "${userPrompt}"

IMAGE CONTEXT:
- Alt text: "${altText}"
- ${imageContext}${classificationInfo}

TASK:
Rate how well this item matches the user's specific request using ONLY these 3 tiers:
- TIER 1 (NO): Does not match the request at all (wrong item type, color, or style)
- TIER 2 (MAYBE): Partially matches but missing key attributes from the request
- TIER 3 (YES): Strong match - closely matches what the user is looking for

Be DECISIVE and specific. Consider:
- Item type match (e.g., if user wants "dress", this should be a dress)
- Color match (if user specifies color like "black", check if this matches)
- Style attributes (e.g., "A-line", "casual", "formal", "running")
- Pattern or material (if specified in user's request)
- Overall relevance to the search query

IMPORTANT RULES:
- PRIORITIZE the image classification results (actual AI analysis of pixels) over alt text
- If image classification shows labels that match the user's request: higher tier likely
- If image classification shows labels that conflict with the request: lower tier likely
- Use alt text as secondary information to supplement the classification
- If the image classification clearly matches the request: TIER 3
- If the image classification conflicts with the request: TIER 1
- If information is limited or ambiguous: TIER 2

Respond in this exact format:
TIER: [number 1, 2, or 3]
REASON: [brief 1-sentence explanation of why this matches or doesn't match the request]

Example 1 - Good match:
User prompt: "black A-line dress"
Alt text: "Black A-line midi dress with v-neck"
Response:
TIER: 3
REASON: Black A-line dress matches all specified criteria perfectly.

Example 2 - Wrong item:
User prompt: "black A-line dress"
Alt text: "White floral maxi skirt"
Response:
TIER: 1
REASON: This is a skirt, not a dress, and wrong color.

Example 3 - Partial match:
User prompt: "black A-line dress"
Alt text: "Black bodycon dress"
Response:
TIER: 2
REASON: Black dress but bodycon style instead of A-line.`;

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
     * Parse AI response to extract tier (1=bad, 2=fine, 3=good) and reasoning
     * @private
     */
    parseAnalysisResponse(response) {
        try {
            const lines = response.split('\n');
            let tier = 2;
            let reasoning = 'Unable to analyze';

            for (const line of lines) {
                if (line.includes('TIER:')) {
                    const tierMatch = line.match(/TIER:\s*(\d+)/i);
                    if (tierMatch) {
                        tier = parseInt(tierMatch[1], 10);
                        tier = Math.max(1, Math.min(3, tier)); // Clamp to 1-3
                    }
                }
                if (line.includes('REASON:')) {
                    reasoning = line.replace(/REASON:/i, '').trim();
                }
            }

            return {
                success: true,
                tier,
                reasoning,
                method: 'prompt_analysis',
                rawResponse: response
            };

        } catch (error) {
            console.error('Failed to parse prompt analysis response:', error);
            return {
                success: false,
                tier: 2,
                reasoning: 'Parse error - neutral tier',
                method: 'parse_error_fallback'
            };
        }
    }

    /**
     * Generate cache key for product and prompt
     * @private
     */
    getCacheKey(productImage, userPrompt) {
        // Use image src and prompt for cache key
        const imageSrc = productImage.src || productImage.currentSrc || '';

        // Simple hash of the image src (first 50 chars + length)
        const imageHash = imageSrc.substring(0, 50) + imageSrc.length;

        // Simple hash of prompt (first 30 chars + length)
        const promptHash = userPrompt.substring(0, 30) + userPrompt.length;

        return `${imageHash}_prompt_${promptHash}`;
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
        console.log('🧹 Prompt analysis cache cleared');
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

        console.log('🗑️ PromptRankingEngine destroyed');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PromptRankingEngine = PromptRankingEngine;
}
