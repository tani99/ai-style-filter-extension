import { DOMUtils } from '../utils/DOMUtils.js';

/**
 * DebugInterface provides debugging tools and detailed logging
 * for development and troubleshooting
 */
export class DebugInterface {
    constructor() {
        this.debugMode = false;
        this.lastDetectionResults = null;
        this.debugIndicatorId = 'ai-style-filter-indicator';
    }

    /**
     * Enable debug mode with enhanced logging
     */
    enableDebugMode() {
        this.debugMode = true;
        console.log('🐛 Debug mode enabled - rejected images will be highlighted');
        console.log('🐛 Additional debug information will be logged');

        // Add debug indicator to page
        this.addExtensionIndicator();
    }

    /**
     * Disable debug mode
     */
    disableDebugMode() {
        this.debugMode = false;
        console.log('🐛 Debug mode disabled');

        // Remove debug indicator
        this.removeExtensionIndicator();
    }

    /**
     * Toggle debug mode
     * @returns {boolean} New debug mode state
     */
    toggleDebugMode() {
        if (this.debugMode) {
            this.disableDebugMode();
        } else {
            this.enableDebugMode();
        }
        return this.debugMode;
    }

    /**
     * Get current debug mode state
     * @returns {boolean} True if debug mode is enabled
     */
    isDebugEnabled() {
        return this.debugMode;
    }

    /**
     * Log detailed detection results with statistics
     * @param {Array} detectedImages - Array of detected image objects
     * @param {Array} rejectedImages - Array of rejected image objects
     */
    logDetectionResults(detectedImages, rejectedImages) {
        console.log('📊 Product Detection Results:');
        console.log(`  ✅ Detected clothing images: ${detectedImages.length}`);
        console.log(`  ❌ Rejected images: ${rejectedImages.length}`);

        // Show rejection reason breakdown
        const rejectionReasons = {};
        rejectedImages.forEach(item => {
            rejectionReasons[item.method] = (rejectionReasons[item.method] || 0) + 1;
        });
        if (Object.keys(rejectionReasons).length > 0) {
            console.log('  📉 Rejection breakdown:', rejectionReasons);
        }

        // Style analysis summary
        const analyzedItems = detectedImages.filter(item => item.styleAnalysis);
        if (analyzedItems.length > 0) {
            const avgScore = analyzedItems.reduce((sum, item) => sum + item.styleAnalysis.score, 0) / analyzedItems.length;
            const scoreDistribution = {
                perfect: analyzedItems.filter(item => item.styleAnalysis.score >= 9).length,
                good: analyzedItems.filter(item => item.styleAnalysis.score >= 7 && item.styleAnalysis.score < 9).length,
                neutral: analyzedItems.filter(item => item.styleAnalysis.score >= 4 && item.styleAnalysis.score < 7).length,
                poor: analyzedItems.filter(item => item.styleAnalysis.score < 4).length
            };

            console.log('🎨 Style Analysis Summary:');
            console.log(`  📈 Analyzed products: ${analyzedItems.length}/${detectedImages.length}`);
            console.log(`  ⭐ Average score: ${Math.round(avgScore * 10) / 10}/10`);
            console.log(`  📊 Score distribution: Perfect(9-10): ${scoreDistribution.perfect}, Good(7-8): ${scoreDistribution.good}, Neutral(4-6): ${scoreDistribution.neutral}, Poor(1-3): ${scoreDistribution.poor}`);
        }

        // Summary of detected images
        if (detectedImages.length > 0) {
            console.log('\n✅ DETECTED IMAGES SUMMARY:');
            detectedImages.forEach((item, index) => {
                const info = item.imageInfo || DOMUtils.getImageInfo(item.element);
                const conf = item.confidence ? ` (${Math.round(item.confidence * 100)}%)` : '';
                const styleInfo = item.styleAnalysis ? ` | Score: ${item.styleAnalysis.score}/10` : '';
                console.log(`  ${index + 1}. "${info.alt}" - [${item.method}${conf}]${styleInfo} ${item.reasoning}`);
                console.log(`     Size: ${info.width}x${info.height}, Src: ${info.srcShort}`);
                if (item.styleAnalysis) {
                    console.log(`     🎨 Style Analysis: ${item.styleAnalysis.reasoning}`);
                }
            });

            // Show method statistics
            const methodStats = {};
            detectedImages.forEach(item => {
                methodStats[item.method] = (methodStats[item.method] || 0) + 1;
            });
            console.log('\n📊 Detection methods used:', methodStats);
        }

        // Summary of rejected images
        if (rejectedImages.length > 0) {
            console.log(`\n❌ REJECTED IMAGES SUMMARY (showing first 10 of ${rejectedImages.length}):`);
            rejectedImages.slice(0, 10).forEach((item, index) => {
                const info = item.imageInfo || DOMUtils.getImageInfo(item.element);
                const conf = item.confidence ? ` (${Math.round(item.confidence * 100)}%)` : '';
                console.log(`  ${index + 1}. "${info.alt}" - [${item.method}${conf}] ${item.reason}`);
                console.log(`     Size: ${info.width}x${info.height}, Src: ${info.srcShort}`);
            });

            if (rejectedImages.length > 10) {
                console.log(`     ... and ${rejectedImages.length - 10} more rejected images`);
            }
        }

        // Store results for retrieval
        this.lastDetectionResults = {
            detected: detectedImages.length,
            rejected: rejectedImages.length,
            timestamp: Date.now(),
            detectedImages: detectedImages.map(item => ({
                alt: item.imageInfo?.alt || item.element?.alt || '',
                method: item.method,
                confidence: item.confidence,
                styleScore: item.styleAnalysis?.score
            })),
            rejectedImages: rejectedImages.slice(0, 20).map(item => ({
                alt: item.imageInfo?.alt || item.element?.alt || '',
                method: item.method,
                reason: item.reason
            }))
        };
    }

    /**
     * Get stored detection statistics
     * @returns {Object|null} Detection results or null if none available
     */
    getDetectionStats() {
        return this.lastDetectionResults || null;
    }

    /**
     * Analyze current page structure for debugging
     * @param {Object} currentSite - Current site configuration
     * @param {string} currentUrl - Current page URL
     * @param {string} currentHost - Current hostname
     * @param {string} pageType - Detected page type
     * @returns {Object} Page structure analysis
     */
    debugPageStructure(currentSite, currentUrl, currentHost, pageType) {
        console.log('🔍 DEBUG: Page Structure Analysis');
        console.log('📄 Current page:', {
            url: currentUrl,
            host: currentHost,
            site: currentSite?.name || 'Unknown',
            pageType: pageType
        });

        // Test total images
        const allImages = document.querySelectorAll('img');
        console.log(`📸 Total images on page: ${allImages.length}`);

        // Sample some image sources for inspection
        console.log('🔍 Sample image sources:');
        Array.from(allImages).slice(0, 10).forEach((img, i) => {
            const rect = img.getBoundingClientRect();
            console.log(`  ${i+1}. src: ${img.src}`);
            console.log(`     alt: "${img.alt}"`);
            console.log(`     class: "${img.className}"`);
            console.log(`     size: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
        });

        if (currentSite && currentSite.selectors) {
            // Test our selectors manually
            console.log('🎯 Testing site-specific selectors:');
            currentSite.selectors.productImages.forEach(selector => {
                try {
                    const count = document.querySelectorAll(selector).length;
                    console.log(`  ${selector}: ${count} matches`);
                } catch (e) {
                    console.log(`  ${selector}: invalid selector`);
                }
            });

            console.log('📦 Testing product card selectors:');
            currentSite.selectors.productCards.forEach(selector => {
                try {
                    const count = document.querySelectorAll(selector).length;
                    console.log(`  ${selector}: ${count} matches`);
                } catch (e) {
                    console.log(`  ${selector}: invalid selector`);
                }
            });
        }

        const debugInfo = {
            totalImages: allImages.length,
            sampleImages: Array.from(allImages).slice(0, 5).map(img => ({
                src: img.src,
                alt: img.alt,
                className: img.className,
                dimensions: img.getBoundingClientRect()
            })),
            pageInfo: {
                url: currentUrl,
                host: currentHost,
                site: currentSite?.name || 'Unknown',
                pageType: pageType
            }
        };

        return debugInfo;
    }

    /**
     * Perform detailed visibility analysis on a specific image
     * @param {HTMLImageElement} img - Image element to analyze
     * @returns {Object} Detailed visibility analysis
     */
    debugImageVisibility(img) {
        console.log('🔍 DETAILED IMAGE VISIBILITY DEBUG');
        console.log('📸 Image:', img);
        console.log('🔗 Src:', img.src);
        console.log('📝 Alt:', img.alt);
        console.log('🏷️ Class:', img.className);

        const rect = img.getBoundingClientRect();
        const style = window.getComputedStyle(img);
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        const visibilityInfo = {
            boundingRect: {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
            },
            viewport: {
                width: viewportWidth,
                height: viewportHeight
            },
            computedStyle: {
                display: style.display,
                visibility: style.visibility,
                opacity: style.opacity,
                position: style.position,
                zIndex: style.zIndex,
                overflow: style.overflow
            },
            naturalDimensions: {
                width: img.naturalWidth,
                height: img.naturalHeight
            }
        };

        console.log('📐 Bounding Rect:', visibilityInfo.boundingRect);
        console.log('🖥️ Viewport:', visibilityInfo.viewport);
        console.log('🎨 Computed Style:', visibilityInfo.computedStyle);
        console.log('📏 Natural Dimensions:', visibilityInfo.naturalDimensions);

        // Calculate visibility status
        const isInViewport = rect.left < viewportWidth && rect.right > 0 &&
                           rect.top < viewportHeight && rect.bottom > 0;
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' &&
                         parseFloat(style.opacity) > 0;
        const hasSize = rect.width > 0 && rect.height > 0;

        const analysis = {
            isInViewport,
            isVisible,
            hasSize,
            overall: isInViewport && isVisible && hasSize
        };

        console.log('✅ Visibility Analysis:', analysis);
        return { ...visibilityInfo, analysis };
    }

    /**
     * Add visual extension indicator to the page
     */
    addExtensionIndicator() {
        // Remove any existing indicator
        this.removeExtensionIndicator();

        // Create a debug indicator
        const indicator = document.createElement('div');
        indicator.id = this.debugIndicatorId;
        indicator.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-weight: 500;
                z-index: 999999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border: 1px solid rgba(255,255,255,0.2);
                backdrop-filter: blur(10px);
                pointer-events: auto;
                cursor: pointer;
            ">
                🤖 AI Style Filter (Debug Mode)
            </div>
        `;

        // Add click handler to show debug info
        const indicatorElement = indicator.querySelector('div');
        indicatorElement.addEventListener('click', () => {
            this.showDebugConsole();
        });

        document.body.appendChild(indicator);
        console.log('🐛 Debug indicator added to page');
    }

    /**
     * Remove extension indicator from the page
     */
    removeExtensionIndicator() {
        const existing = document.getElementById(this.debugIndicatorId);
        if (existing) {
            existing.remove();
        }
    }

    /**
     * Show debug console information
     */
    showDebugConsole() {
        console.log('🐛 AI Style Filter Debug Information:');
        console.log('📊 Last Detection Results:', this.lastDetectionResults);
        console.log('🎯 Detected Elements:', document.querySelectorAll('[data-ai-style-detected="true"]').length);
        console.log('❌ Rejected Elements:', document.querySelectorAll('[data-ai-style-rejected="true"]').length);
        console.log('🎨 Visual Overlays:', document.querySelectorAll('[data-ai-style-overlay]').length);

        // Show current analysis statistics
        const stats = this.getAnalysisStatistics();
        console.log('📈 Analysis Statistics:', stats);
    }

    /**
     * Get comprehensive analysis statistics
     * @returns {Object} Analysis statistics
     */
    getAnalysisStatistics() {
        const detectedElements = document.querySelectorAll('[data-ai-style-detected="true"]');
        const rejectedElements = document.querySelectorAll('[data-ai-style-rejected="true"]');
        const overlayElements = document.querySelectorAll('[data-ai-style-overlay]');
        const scoreBadges = document.querySelectorAll('[data-ai-style-overlay="score-badge"]');

        return {
            elements: {
                detected: detectedElements.length,
                rejected: rejectedElements.length,
                overlays: overlayElements.length,
                scoreBadges: scoreBadges.length
            },
            lastResults: this.lastDetectionResults,
            debugMode: this.debugMode,
            timestamp: Date.now()
        };
    }

    /**
     * Log selector testing results
     * @param {Object} selectorStats - Statistics from selector testing
     */
    logSelectorStats(selectorStats) {
        console.log('🎯 Selector Testing Results:');
        console.log(`  📦 Product images found: ${selectorStats.siteSpecific || 0}`);
        console.log(`  🏷️ Product cards found: ${selectorStats.productCards || 0}`);
        console.log(`  🌐 General selectors found: ${selectorStats.general || 0}`);
        console.log(`  ⚡ Universal fallback used: ${selectorStats.universal || 0}`);
    }

    /**
     * Create debug summary for specific image
     * @param {HTMLImageElement} img - Image element
     * @param {Object} analysisResult - Analysis result for the image
     * @returns {Object} Debug summary
     */
    createImageDebugSummary(img, analysisResult) {
        const imageInfo = DOMUtils.getImageInfo(img);
        const visibilityInfo = this.debugImageVisibility(img);

        return {
            imageInfo,
            analysisResult,
            visibilityInfo,
            element: {
                tagName: img.tagName,
                id: img.id,
                className: img.className,
                dataset: { ...img.dataset }
            },
            timestamp: Date.now()
        };
    }

    /**
     * Export debug data for external analysis
     * @returns {Object} Comprehensive debug export
     */
    exportDebugData() {
        const debugData = {
            timestamp: Date.now(),
            debugMode: this.debugMode,
            lastResults: this.lastDetectionResults,
            statistics: this.getAnalysisStatistics(),
            pageInfo: {
                url: window.location.href,
                host: window.location.hostname,
                userAgent: navigator.userAgent,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            },
            elements: {
                totalImages: document.querySelectorAll('img').length,
                detectedImages: Array.from(document.querySelectorAll('[data-ai-style-detected="true"]')).map(img => ({
                    alt: img.alt,
                    src: img.src.slice(-50),
                    className: img.className,
                    index: img.dataset.detectionIndex
                })),
                rejectedImages: Array.from(document.querySelectorAll('[data-ai-style-rejected="true"]')).map(img => ({
                    alt: img.alt,
                    src: img.src.slice(-50),
                    className: img.className,
                    index: img.dataset.aiStyleRejectIndex
                }))
            }
        };

        console.log('📁 Debug data exported:', debugData);
        return debugData;
    }

    /**
     * Clear all debug state and indicators
     */
    cleanup() {
        this.removeExtensionIndicator();
        this.lastDetectionResults = null;
        this.debugMode = false;
        console.log('🧹 Debug interface cleaned up');
    }
}