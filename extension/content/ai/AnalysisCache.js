import { DOMUtils } from '../utils/DOMUtils.js';

/**
 * AnalysisCache manages caching of AI analysis results to improve performance
 * and reduce redundant API calls
 */
export class AnalysisCache {
    constructor() {
        this.analysisCache = new Map();
        this.processedImages = new Set(); // Track which images we've already processed
        this.analysisStats = {
            totalAnalyzed: 0,
            cacheHits: 0,
            apiCalls: 0,
            averageScore: 0,
            consecutiveFailures: 0
        };
    }

    /**
     * Generate a unique cache key for a product image and style profile
     * @param {HTMLImageElement} productImage - The image element
     * @param {Object} profile - The user's style profile
     * @returns {string} Unique cache key
     */
    generateProductCacheKey(productImage, profile) {
        // Create unique key for caching based on image and profile
        const imageSrc = productImage.src || '';
        const imageAlt = productImage.alt || '';
        const profileHash = profile.generated_at || Date.now();

        // Simple hash function for cache key
        const text = `${imageSrc}|${imageAlt}|${profileHash}`;
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `product_${Math.abs(hash)}`;
    }

    /**
     * Get cache status for a specific image
     * @param {HTMLImageElement} img - The image element
     * @param {Object} userStyleProfile - The user's style profile
     * @returns {Object} Cache status information
     */
    getCacheStatusForImage(img, userStyleProfile = {}) {
        const imgKey = DOMUtils.getImageKey(img);
        const cacheKey = this.generateProductCacheKey(img, userStyleProfile);

        const status = {
            imgKey: imgKey,
            cacheKey: cacheKey.substring(0, 50) + '...',
            inCache: this.analysisCache.has(cacheKey),
            processed: this.processedImages.has(imgKey),
            detected: img.dataset.aiStyleDetected === 'true'
        };

        if (status.inCache) {
            const cached = this.analysisCache.get(cacheKey);
            status.cachedScore = cached.score;
            status.cachedMethod = cached.method;
        }

        console.log('🔍 Cache status for image:', status);
        return status;
    }

    /**
     * Check if analysis result is cached
     * @param {string} cacheKey - The cache key to check
     * @returns {boolean} True if cached
     */
    has(cacheKey) {
        return this.analysisCache.has(cacheKey);
    }

    /**
     * Get cached analysis result
     * @param {string} cacheKey - The cache key
     * @returns {Object|undefined} Cached analysis result or undefined
     */
    get(cacheKey) {
        if (this.analysisCache.has(cacheKey)) {
            this.analysisStats.cacheHits++;
            return this.analysisCache.get(cacheKey);
        }
        return undefined;
    }

    /**
     * Store analysis result in cache
     * @param {string} cacheKey - The cache key
     * @param {Object} result - The analysis result to cache
     */
    set(cacheKey, result) {
        this.analysisCache.set(cacheKey, result);
    }

    /**
     * Mark an image as processed
     * @param {string} imageKey - The image key
     */
    markImageProcessed(imageKey) {
        this.processedImages.add(imageKey);
    }

    /**
     * Check if an image has been processed
     * @param {string} imageKey - The image key
     * @returns {boolean} True if processed
     */
    isImageProcessed(imageKey) {
        return this.processedImages.has(imageKey);
    }

    /**
     * Clear the analysis cache
     */
    clearAnalysisCache() {
        this.analysisCache.clear();
        this.analysisStats = {
            totalAnalyzed: 0,
            cacheHits: 0,
            apiCalls: 0,
            averageScore: 0,
            consecutiveFailures: 0
        };
        console.log('🧹 Analysis cache cleared');
    }

    /**
     * Debug cache information
     * @returns {Object} Cache debug information
     */
    debugCache() {
        console.log('🗃️ Cache Debug Information:');
        console.log('Cache size:', this.analysisCache.size);
        console.log('Processed images:', this.processedImages.size);

        if (this.analysisCache.size > 0) {
            console.log('Cache contents (first 5 entries):');
            let count = 0;
            for (const [key, value] of this.analysisCache.entries()) {
                if (count >= 5) break;
                console.log(`  ${count + 1}. Score: ${value.score}/10, Method: ${value.method}, Confidence: ${Math.round(value.confidence * 100)}%`);
                console.log(`     Cache key: ${key.substring(0, 50)}...`);
                count++;
            }
        }

        return {
            cacheSize: this.analysisCache.size,
            processedImages: this.processedImages.size,
            cacheHitRate: this.analysisStats.totalAnalyzed > 0 ?
                Math.round((this.analysisStats.cacheHits / this.analysisStats.totalAnalyzed) * 100) : 0
        };
    }

    /**
     * Update analysis statistics
     * @param {Object} updates - Statistics updates
     */
    updateStats(updates) {
        Object.assign(this.analysisStats, updates);
    }

    /**
     * Get current analysis statistics
     * @returns {Object} Current statistics
     */
    getStats() {
        return { ...this.analysisStats };
    }

    /**
     * Reset consecutive failure count
     */
    resetFailureCount() {
        this.analysisStats.consecutiveFailures = 0;
    }

    /**
     * Increment consecutive failure count
     */
    incrementFailureCount() {
        this.analysisStats.consecutiveFailures++;
    }

    /**
     * Get cache size
     * @returns {number} Number of cached items
     */
    size() {
        return this.analysisCache.size;
    }
}