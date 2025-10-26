/**
 * ViewportAnalysis - Scroll-based image detection for complex websites
 * 
 * This module provides scroll-triggered image detection for websites with:
 * - Infinite scroll implementations
 * - Complex lazy loading systems
 * - Virtual scrolling (like some e-commerce sites)
 * - Custom scroll containers
 * - Performance-critical scenarios where analyzing all images at once is too slow
 * 
 * CURRENTLY UNUSED - The extension uses one-time detection on page load instead.
 * This is kept for potential future use on problematic websites.
 * 
 * When to consider using this:
 * - Sites with 100+ images where initial detection is too slow
 * - Sites with complex lazy loading that breaks normal detection
 * - Sites with virtual scrolling or custom scroll containers
 * - Performance issues with full-page analysis
 * 
 * How it works:
 * 1. Uses IntersectionObserver to watch for images entering viewport
 * 2. Only analyzes images when they become visible (performance optimization)
 * 3. Tracks which images have been processed to avoid duplicates
 * 4. Can be enabled/disabled via message listeners
 */

export class ViewportAnalysis {
    constructor(contentScriptManager) {
        this.contentScript = contentScriptManager;
        this.analysisObserver = null;
        this.isEnabled = false;
    }

    /**
     * Enable viewport-based analysis
     * Creates IntersectionObserver to watch for images entering viewport
     */
    enable() {
        if (this.isEnabled) {
            console.log('⚠️ Viewport analysis already enabled');
            return;
        }

        const observerOptions = {
            root: null, // Use viewport as root
            rootMargin: '300px', // Start analyzing 300px before image enters viewport
            threshold: 0.01 // Trigger when 1% of image is visible
        };

        this.analysisObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    console.log('👁️ Image entered viewport:', {
                        alt: img.alt,
                        src: img.src.substring(0, 50),
                        clothingItemDetected: img.dataset.clothingItemDetected,
                        detectionInProgress: img.dataset.clothingItemDetectionInProgress
                    });

                    // Only analyze if not already checked and not currently analyzing
                    if (!img.dataset.clothingItemDetected && !img.dataset.clothingItemDetectionInProgress) {
                        console.log('🔄 Triggering analysis for scrolled image');
                        this.contentScript.analyzeNewImage(img);
                    } else {
                        console.log('⏭️ Skipping image (already processed)');
                    }
                }
            });
        }, observerOptions);

        // Start observing all images on the page
        this.observeAllImages();
        this.isEnabled = true;
        console.log('✅ Viewport analysis enabled');
    }

    /**
     * Disable viewport-based analysis
     */
    disable() {
        if (this.analysisObserver) {
            this.analysisObserver.disconnect();
            this.analysisObserver = null;
        }
        this.isEnabled = false;
        console.log('✅ Viewport analysis disabled');
    }

    /**
     * Start observing all images on the page
     * @private
     */
    observeAllImages() {
        const allImages = document.querySelectorAll('img');
        console.log(`👁️ Starting to observe ${allImages.length} images for viewport analysis`);
        
        allImages.forEach(img => {
            this.analysisObserver.observe(img);
        });
    }

    /**
     * Add a new image to observation (for dynamically added images)
     * @param {HTMLImageElement} img - Image element to observe
     */
    observeImage(img) {
        if (this.analysisObserver && this.isEnabled) {
            this.analysisObserver.observe(img);
        }
    }

    /**
     * Remove an image from observation
     * @param {HTMLImageElement} img - Image element to stop observing
     */
    unobserveImage(img) {
        if (this.analysisObserver) {
            this.analysisObserver.unobserve(img);
        }
    }

    /**
     * Check if viewport analysis is currently enabled
     * @returns {boolean} True if enabled
     */
    isViewportAnalysisEnabled() {
        return this.isEnabled;
    }
}
