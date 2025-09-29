import { AnalysisCache } from './AnalysisCache.js';
import { ImageClassifier } from './ImageClassifier.js';
import { AltTextAnalyzer } from './AltTextAnalyzer.js';
import { StyleMatcher } from './StyleMatcher.js';
import { DOMUtils } from '../utils/DOMUtils.js';

/**
 * AIAnalysisEngine coordinates all AI-powered product analysis including
 * image classification, alt text analysis, style matching, and queue management
 */
export class AIAnalysisEngine {
    constructor(userStyleProfile = null) {
        this.userStyleProfile = userStyleProfile;

        // Initialize AI components
        this.imageClassifier = new ImageClassifier();
        this.altTextAnalyzer = new AltTextAnalyzer();
        this.styleMatcher = new StyleMatcher();
        this.analysisCache = new AnalysisCache();

        // Queue management
        this.analysisQueue = [];
        this.activeAnalyses = 0;
        this.maxConcurrentAnalyses = 4;

        // Circuit breaker for handling API failures
        this.circuitBreakerThreshold = 5;
        this.circuitBreakerOpen = false;

        // Analysis statistics
        this.analysisStats = {
            totalAnalyzed: 0,
            apiCalls: 0,
            cacheHits: 0,
            failures: 0,
            consecutiveFailures: 0,
            averageScore: 0
        };
    }

    /**
     * Analyze a single product for style compatibility
     * @param {HTMLImageElement} productImage - The product image element
     * @param {Object} userProfile - User's style profile (optional, uses instance profile if not provided)
     * @returns {Promise<Object>} Analysis result with score and reasoning
     */
    async analyzeProduct(productImage, userProfile = null) {
        // Use provided profile or fallback to instance profile
        const profile = userProfile || this.userStyleProfile;

        if (!profile) {
            console.log('⚠️ No style profile available - skipping product analysis');
            return {
                score: 5, // Neutral score when no profile
                reasoning: 'No style profile available for analysis',
                method: 'no_profile',
                confidence: 0
            };
        }

        // Generate cache key for this product
        const cacheKey = this.generateProductCacheKey(productImage, profile);

        // Check cache first
        if (this.analysisCache.has(cacheKey)) {
            this.analysisStats.cacheHits++;
            console.log('💾 Using cached analysis result');
            return this.analysisCache.get(cacheKey);
        }

        // Check if we can start a new analysis (performance limiting)
        if (this.activeAnalyses >= this.maxConcurrentAnalyses) {
            // Safety check: prevent queue from growing too large
            const maxQueueSize = 200;
            if (this.analysisQueue.length >= maxQueueSize) {
                console.warn(`⚠️ Analysis queue full (${maxQueueSize} items), dropping request for safety`);
                return {
                    score: 5,
                    reasoning: 'Analysis queue full - skipped for performance',
                    confidence: 0,
                    method: 'queue_full'
                };
            }

            // Add to queue for later processing
            return new Promise((resolve) => {
                this.analysisQueue.push({
                    productImage,
                    userProfile: profile,
                    resolve,
                    cacheKey
                });
                console.log(`📥 Analysis queued (${this.analysisQueue.length} in queue)`);
            });
        }

        return this.performProductAnalysis(productImage, profile, cacheKey);
    }

    /**
     * Perform the actual product analysis
     * @param {HTMLImageElement} productImage - The product image element
     * @param {Object} profile - User's style profile
     * @param {string} cacheKey - Cache key for the result
     * @returns {Promise<Object>} Analysis result
     * @private
     */
    async performProductAnalysis(productImage, profile, cacheKey) {
        this.activeAnalyses++;
        this.analysisStats.apiCalls++;

        const imageInfo = DOMUtils.getImageInfo(productImage);
        console.log(`🔍 Analyzing product compatibility (${this.activeAnalyses}/${this.maxConcurrentAnalyses} active): "${imageInfo.alt}"`);

        // Circuit breaker check
        if (this.circuitBreakerOpen) {
            console.warn('⚡ Circuit breaker open - using fallback analysis');
            const fallbackResult = this.fallbackProductAnalysis(productImage, profile);
            this.analysisCache.set(cacheKey, fallbackResult);
            return fallbackResult;
        }

        try {
            // First, check if this is actually clothing using our image classifier
            const isClothingResult = await this.imageClassifier.isClothingImage(productImage);

            if (!isClothingResult.isClothing) {
                const result = {
                    score: 1,
                    reasoning: `Not clothing: ${isClothingResult.reasoning}`,
                    confidence: isClothingResult.confidence,
                    method: isClothingResult.method
                };

                this.analysisCache.set(cacheKey, result);
                this.updateAnalysisStats(result);
                return result;
            }

            // If it's clothing, analyze style compatibility
            const styleAnalysis = await this.styleMatcher.analyzeProductStyle(productImage, profile);

            let result;
            if (styleAnalysis.confident) {
                // Convert style match to score (1-10 scale)
                const baseScore = styleAnalysis.isStyleMatch ?
                    Math.max(6, Math.round(styleAnalysis.score / 10)) :
                    Math.min(4, Math.round(styleAnalysis.score / 25));

                result = {
                    score: baseScore,
                    reasoning: styleAnalysis.reasoning,
                    confidence: styleAnalysis.confidence,
                    method: styleAnalysis.method
                };

                // Reset circuit breaker on success
                this.analysisStats.consecutiveFailures = 0;
                if (this.circuitBreakerOpen) {
                    this.circuitBreakerOpen = false;
                    console.log('⚡ Circuit breaker reset - AI requests restored');
                }
            } else {
                // Fallback analysis if style matching fails
                result = this.fallbackProductAnalysis(productImage, profile);
                console.log(`⚠️ Style analysis failed, using fallback: ${styleAnalysis.reason}`);

                // Update failure tracking
                this.analysisStats.failures++;
                this.analysisStats.consecutiveFailures++;

                // Check if we should open circuit breaker
                if (this.analysisStats.consecutiveFailures >= this.circuitBreakerThreshold) {
                    this.circuitBreakerOpen = true;
                    console.warn(`⚡ Circuit breaker opened after ${this.circuitBreakerThreshold} consecutive failures`);
                }
            }

            // Cache the result
            this.analysisCache.set(cacheKey, result);
            this.updateAnalysisStats(result);

            console.log(`✅ Product analysis complete: Score ${result.score}/10 (${result.method})`);
            return result;

        } catch (error) {
            console.warn('Product analysis error, using fallback:', error.message);

            // Update failure tracking
            this.analysisStats.failures++;
            this.analysisStats.consecutiveFailures++;

            // Return fallback result instead of throwing
            const fallbackResult = this.fallbackProductAnalysis(productImage, profile);

            // Cache the fallback result to avoid retrying
            this.analysisCache.set(cacheKey, fallbackResult);
            this.updateAnalysisStats(fallbackResult);

            return fallbackResult;
        } finally {
            this.activeAnalyses--;

            // Process next item in queue
            if (this.analysisQueue.length > 0 && this.activeAnalyses < this.maxConcurrentAnalyses) {
                const next = this.analysisQueue.shift();
                next.resolve(this.performProductAnalysis(next.productImage, next.userProfile, next.cacheKey));
            }
        }
    }

    /**
     * Analyze multiple products in batches
     * @param {HTMLImageElement[]} productImages - Array of product image elements
     * @param {Object} options - Analysis options
     * @returns {Promise<Array>} Array of analysis results
     */
    async analyzeMultipleProducts(productImages, options = {}) {
        console.log(`🔄 Starting batch analysis of ${productImages.length} products`);

        const batchSize = options.batchSize || 8;
        const results = [];

        // Process in batches to avoid overwhelming the API
        for (let i = 0; i < productImages.length; i += batchSize) {
            const batch = productImages.slice(i, i + batchSize);
            console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(productImages.length/batchSize)}`);

            const batchPromises = batch.map(async (img, index) => {
                const globalIndex = i + index;
                try {
                    const analysis = await this.analyzeProduct(img);
                    return {
                        element: img,
                        analysis: analysis,
                        index: globalIndex
                    };
                } catch (error) {
                    console.error(`Analysis failed for product ${globalIndex}:`, error);
                    return {
                        element: img,
                        analysis: {
                            score: 5,
                            reasoning: 'Analysis failed',
                            confidence: 0,
                            method: 'error'
                        },
                        index: globalIndex
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Small delay between batches to be respectful to API
            if (i + batchSize < productImages.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        console.log(`✅ Batch analysis complete: ${results.length} products analyzed`);
        this.logAnalysisStatistics();

        return results;
    }

    /**
     * Fallback product analysis using rule-based approach
     * @param {HTMLImageElement} productImage - The product image element
     * @param {Object} profile - User's style profile
     * @returns {Object} Fallback analysis result
     * @private
     */
    fallbackProductAnalysis(productImage, profile) {
        // Use StyleMatcher's fallback analysis
        return this.styleMatcher.fallbackProductAnalysis(productImage, profile);
    }

    /**
     * Generate cache key for a product analysis
     * @param {HTMLImageElement} productImage - The product image element
     * @param {Object} profile - User's style profile
     * @returns {string} Cache key
     * @private
     */
    generateProductCacheKey(productImage, profile) {
        const imageKey = DOMUtils.getImageKey(productImage);
        const profileHash = this.hashObject(profile);
        return `${imageKey}_${profileHash}`;
    }

    /**
     * Create a simple hash of an object for caching
     * @param {Object} obj - Object to hash
     * @returns {string} Hash string
     * @private
     */
    hashObject(obj) {
        const str = JSON.stringify(obj, Object.keys(obj).sort());
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `product_${Math.abs(hash)}`;
    }

    /**
     * Update analysis statistics
     * @param {Object} result - Analysis result
     * @private
     */
    updateAnalysisStats(result) {
        this.analysisStats.totalAnalyzed++;
        this.analysisStats.averageScore =
            (this.analysisStats.averageScore * (this.analysisStats.totalAnalyzed - 1) + result.score) /
            this.analysisStats.totalAnalyzed;
    }

    /**
     * Log current analysis statistics
     */
    logAnalysisStatistics() {
        const cacheStats = {
            totalAnalyzed: this.analysisStats.totalAnalyzed,
            cacheHits: this.analysisStats.cacheHits,
            apiCalls: this.analysisStats.apiCalls,
            failures: this.analysisStats.failures,
            averageScore: this.analysisStats.averageScore.toFixed(1),
            cacheHitRate: this.analysisStats.totalAnalyzed > 0 ?
                ((this.analysisStats.cacheHits / this.analysisStats.totalAnalyzed) * 100).toFixed(1) + '%' : '0%',
            circuitBreakerOpen: this.circuitBreakerOpen,
            consecutiveFailures: this.analysisStats.consecutiveFailures
        };

        const queueStats = {
            queueLength: this.analysisQueue.length,
            activeAnalyses: this.activeAnalyses,
            maxConcurrent: this.maxConcurrentAnalyses,
            cacheSize: this.analysisCache.size
        };

        console.log('📊 Analysis Statistics:', cacheStats);
        console.log('📊 Queue Statistics:', queueStats);
    }

    /**
     * Debug information about analysis queue
     * @returns {Object} Queue debugging information
     */
    debugAnalysisQueue() {
        console.log('🔍 Analysis Queue Debug:', {
            queueLength: this.analysisQueue.length,
            activeAnalyses: this.activeAnalyses,
            maxConcurrent: this.maxConcurrentAnalyses,
            cacheSize: this.analysisCache.size
        });

        if (this.analysisQueue.length > 0) {
            console.log('📥 Queue items (first 5):');
            this.analysisQueue.slice(0, 5).forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.productImage.alt || 'no alt'} (${item.productImage.src?.slice(-30) || 'no src'})`);
            });
        }

        return {
            queueLength: this.analysisQueue.length,
            activeAnalyses: this.activeAnalyses,
            cacheSize: this.analysisCache.size
        };
    }

    /**
     * Reset analysis state (useful for debugging)
     */
    resetAnalysisState() {
        this.analysisQueue = [];
        this.activeAnalyses = 0;
        this.analysisCache.clear();
        this.circuitBreakerOpen = false;
        this.analysisStats = {
            totalAnalyzed: 0,
            apiCalls: 0,
            cacheHits: 0,
            failures: 0,
            consecutiveFailures: 0,
            averageScore: 0
        };

        console.log('🔄 Analysis state reset');
    }

    /**
     * Reset circuit breaker manually
     */
    resetCircuitBreaker() {
        this.circuitBreakerOpen = false;
        this.analysisStats.consecutiveFailures = 0;
        console.log('⚡ Circuit breaker manually reset');
    }

    /**
     * Update user style profile
     * @param {Object} newProfile - New style profile
     */
    updateStyleProfile(newProfile) {
        this.userStyleProfile = newProfile;
        // Clear cache when profile changes
        this.analysisCache.clear();
        console.log('👤 Style profile updated, cache cleared');
    }

    /**
     * Get current analysis statistics
     * @returns {Object} Current statistics
     */
    getAnalysisStats() {
        return {
            ...this.analysisStats,
            queueLength: this.analysisQueue.length,
            activeAnalyses: this.activeAnalyses,
            cacheSize: this.analysisCache.size,
            circuitBreakerOpen: this.circuitBreakerOpen
        };
    }

    /**
     * Test all AI components
     * @returns {Promise<Object>} Test results for all components
     */
    async testAllComponents() {
        const results = {
            imageClassifier: await this.imageClassifier.testClassificationFunctionality(),
            altTextAnalyzer: await this.altTextAnalyzer.testAIFunctionality(),
            styleMatcher: await this.styleMatcher.testStyleAnalysis()
        };

        console.log('🧪 AI Components Test Results:', results);
        return results;
    }

    /**
     * Check if all AI components are ready
     * @returns {Promise<boolean>} True if all components are ready
     */
    async isAIReady() {
        const classifierReady = this.imageClassifier.isAIReady();
        const altTextReady = this.altTextAnalyzer.isAIReady();
        const styleMatcherReady = this.styleMatcher.isAIReady();

        return classifierReady && altTextReady && styleMatcherReady;
    }

    /**
     * Refresh AI availability for all components
     * @returns {Promise<Object>} Availability status for each component
     */
    async refreshAIAvailability() {
        const availability = {
            imageClassifier: await this.imageClassifier.refreshAIAvailability(),
            altTextAnalyzer: await this.altTextAnalyzer.refreshAIAvailability(),
            styleMatcher: await this.styleMatcher.refreshAIAvailability()
        };

        console.log('🔄 AI Availability Status:', availability);
        return availability;
    }
}