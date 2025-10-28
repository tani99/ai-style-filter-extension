import { CandidateFinder } from './CandidateFinder.js';
import { VisibilityChecker } from './VisibilityChecker.js';
import { QuickExclusion } from './QuickExclusion.js';
import { DOMUtils } from '../utils/DOMUtils.js';

/**
 * ImageDetector orchestrates the multi-layered image detection process
 * combining candidate finding, visibility checks, and AI analysis
 */
export class ImageDetector {
    constructor(currentSite, isClothingImageCallback) {
        this.currentSite = currentSite;
        this.candidateFinder = new CandidateFinder(currentSite);
        this.visibilityChecker = new VisibilityChecker();
        this.quickExclusion = new QuickExclusion();
        this.isClothingImageCallback = isClothingImageCallback; // AI callback

        this.detectedProducts = [];
        this.processedImages = new Set();
        this.debugMode = false;
    }

    /**
     * Main product image detection method
     * @param {Object} options - Detection options
     * @returns {Object} Detection results with detected and rejected images
     */
    async detectProductImages(options = {}) {
        console.log('🔍 Starting product image detection...');

        const detectedImages = [];
        const rejectedImages = [];

        if (!this.currentSite) {
            console.log('❌ No supported site detected. Aborting detection.');
            return { detectedImages, rejectedImages };
        }

        // Find candidate images using selectors
        const candidateImages = this.candidateFinder.findCandidateImages();

        if (candidateImages.length === 0) {
            console.log('⚠️ No candidate images found');
            return { detectedImages, rejectedImages };
        }

        console.log(`📸 Processing ${candidateImages.length} candidate images...`);

        // Process images in batches for performance
        const batchSize = 8;
        const allResults = [];

        for (let batchStart = 0; batchStart < candidateImages.length; batchStart += batchSize) {
            const batch = candidateImages.slice(batchStart, batchStart + batchSize);
            console.log(`🔄 Processing batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(candidateImages.length / batchSize)}`);

            const imageProcessingPromises = batch.map(async (img, i) => {
                const globalIndex = batchStart + i;
                const imageInfo = DOMUtils.getImageInfo(img);

                // Individual image processing logs removed - will show summary table instead

                // Mark as processed
                const imgKey = DOMUtils.getImageKey(img);
                this.processedImages.add(imgKey);

                // Quick exclusion check (fast)
                const visibilityCheck = this.visibilityChecker.isImageVisible(img);
                if (!visibilityCheck.isVisible) {
                    return {
                        type: 'rejected',
                        element: img,
                        imageInfo: imageInfo,
                        reason: visibilityCheck.reason,
                        confidence: 0.9,
                        method: 'visibility_check'
                    };
                }

                // Quality check
                const quality = this.visibilityChecker.checkImageQuality(img);
                if (!quality.isValid) {
                    return {
                        type: 'rejected',
                        element: img,
                        imageInfo: imageInfo,
                        reason: quality.reason,
                        confidence: 0.9,
                        method: 'quality_check'
                    };
                }

                // AI clothing detection (if callback provided)
                if (this.isClothingImageCallback) {
                    try {
                        const isClothing = await this.isClothingImageCallback(img);

                        if (isClothing.isClothing) {
                            return {
                                type: 'detected',
                                element: img,
                                imageInfo: imageInfo,
                                reason: isClothing.reasoning || 'AI detected as clothing',
                                confidence: isClothing.confidence || 0.8,
                                method: isClothing.method || 'ai_clothing_detection'  // More specific: indicates clothing detection
                            };
                        } else {
                            return {
                                type: 'rejected',
                                element: img,
                                imageInfo: imageInfo,
                                reason: isClothing.reasoning || 'AI rejected as non-clothing',
                                confidence: isClothing.confidence || 0.8,
                                method: isClothing.method || 'ai_clothing_detection'  // More specific: indicates clothing detection
                            };
                        }
                    } catch (error) {
                        // Fallback to context analysis
                        const contextResult = this.analyzeImageContext(img);
                        return {
                            type: contextResult.isClothing ? 'detected' : 'rejected',
                            element: img,
                            imageInfo: imageInfo,
                            reason: contextResult.reasoning,
                            confidence: 0.6,
                            method: 'context_analysis'
                        };
                    }
                } else {
                    // Fallback to context analysis when no AI callback
                    const contextResult = this.analyzeImageContext(img);
                    return {
                        type: contextResult.isClothing ? 'detected' : 'rejected',
                        element: img,
                        imageInfo: imageInfo,
                        reason: contextResult.reasoning,
                        confidence: 0.6,
                        method: 'context_analysis'
                    };
                }
            });

            const results = await Promise.all(imageProcessingPromises);
            allResults.push(...results);
        }

        // Separate detected and rejected images
        allResults.forEach(result => {
            if (result.type === 'detected') {
                detectedImages.push(result);
                // Mark image element as clothing item
                // 'true' = is clothing, 'false' = not clothing, undefined = not analyzed
                result.element.dataset.clothingItemDetected = 'true';
                result.element.dataset.aiStyleIndex = detectedImages.length - 1;
            } else {
                rejectedImages.push(result);
                result.element.dataset.clothingItemDetected = 'false';  // Not a clothing item
            }
        });

        // Store detected products
        this.detectedProducts = detectedImages;

        console.log(`✅ Detection complete:`);
        console.log(`  🎯 Detected: ${detectedImages.length} clothing images`);
        console.log(`  ❌ Rejected: ${rejectedImages.length} images`);

        return { detectedImages, rejectedImages };
    }

    /**
     * Detect new images (for dynamic content/lazy loading)
     * @returns {Object} Detection results for new images only
     */
    async detectNewImages() {
        const allCandidates = this.candidateFinder.findCandidateImages();
        // Only analyze images that haven't been checked yet (undefined = not analyzed)
        const newCandidates = allCandidates.filter(img => !img.dataset.clothingItemDetected);

        if (newCandidates.length === 0) {
            console.log('📸 No new images to detect');
            return { detectedImages: [], rejectedImages: [] };
        }

        console.log(`🔍 Analyzing ${newCandidates.length} new images...`);

        const detectedImages = [];
        const rejectedImages = [];

        // Process new candidates
        const imageProcessingPromises = newCandidates.map(async (img, i) => {
            const imageInfo = DOMUtils.getImageInfo(img);

            // Individual image processing logs removed - will show summary table instead

            // Quick exclusion and visibility checks
            const visibilityCheck = this.visibilityChecker.isImageVisible(img);
            if (!visibilityCheck.isVisible) {
                return {
                    type: 'rejected',
                    element: img,
                    imageInfo: imageInfo,
                    reason: visibilityCheck.reason,
                    confidence: 0.9,
                    method: 'visibility_check'
                };
            }

            const quality = this.visibilityChecker.checkImageQuality(img);
            if (!quality.isValid) {
                return {
                    type: 'rejected',
                    element: img,
                    imageInfo: imageInfo,
                    reason: quality.reason,
                    confidence: 0.9,
                    method: 'quality_check'
                };
            }

            // AI or context analysis
            if (this.isClothingImageCallback) {
                try {
                    const isClothing = await this.isClothingImageCallback(img);
                    return {
                        type: isClothing.isClothing ? 'detected' : 'rejected',
                        element: img,
                        imageInfo: imageInfo,
                        reason: isClothing.reasoning,
                        confidence: isClothing.confidence || 0.8,
                        method: isClothing.method || 'ai_clothing_detection'  // More specific: indicates clothing detection
                    };
                } catch (error) {
                    // AI analysis failed, will use fallback context analysis
                }
            }

            // Fallback context analysis
            const contextResult = this.analyzeImageContext(img);
            return {
                type: contextResult.isClothing ? 'detected' : 'rejected',
                element: img,
                imageInfo: imageInfo,
                reason: contextResult.reasoning,
                confidence: 0.6,
                method: 'context_analysis'
            };
        });

        const results = await Promise.all(imageProcessingPromises);

        // Separate and mark results
        const newDetectedImages = results.filter(result => result.type === 'detected');
        const newRejectedImages = results.filter(result => result.type === 'rejected');

        // Update existing detected products list
        if (newDetectedImages.length > 0) {
            const existingDetectedImages = document.querySelectorAll('[data-clothing-item-detected="true"]');
            const startIndex = existingDetectedImages.length;

            newDetectedImages.forEach((result, localIndex) => {
                const index = startIndex + localIndex;
                result.element.dataset.clothingItemDetected = 'true';  // Confirmed clothing item
                result.element.dataset.aiStyleIndex = index;
            });

            this.detectedProducts = [...this.detectedProducts, ...newDetectedImages];
        }

        // Mark rejected images
        newRejectedImages.forEach(result => {
            result.element.dataset.clothingItemDetected = 'false';  // Not a clothing item
        });

        console.log(`✅ New image detection complete:`);
        console.log(`  🎯 Detected: ${newDetectedImages.length} new clothing images`);
        console.log(`  ❌ Rejected: ${newRejectedImages.length} new images`);

        return { detectedImages: newDetectedImages, rejectedImages: newRejectedImages };
    }

    /**
     * Analyze image context to determine if it's likely a clothing item
     * @param {HTMLImageElement} img - The image element to analyze
     * @returns {Object} Context analysis result
     */
    analyzeImageContext(img) {
        // Check if image is in a product area
        const isInProductArea = this.isInProductArea(img);
        const rect = img.getBoundingClientRect();

        // If in a product area and reasonable size, likely clothing
        if (isInProductArea && rect.width > 100 && rect.height > 100) {
            return {
                isClothing: true,
                reasoning: 'Located in product area with appropriate size'
            };
        }

        // Check if image is in a grid layout (common for product catalogs)
        const isInGrid = this.isInGridLayout(img);
        if (isInGrid) {
            return {
                isClothing: true,
                reasoning: 'Located in product grid layout'
            };
        }

        // Default to including (better to have false positives than miss items)
        return {
            isClothing: true,
            reasoning: 'Default inclusion - no clear exclusion criteria met'
        };
    }

    /**
     * Check if image is in a grid layout
     * @param {HTMLImageElement} img - The image element to check
     * @returns {boolean} True if in grid layout
     */
    isInGridLayout(img) {
        let parent = img.parentElement;
        let depth = 0;

        while (parent && depth < 5) {
            const style = window.getComputedStyle(parent);

            // Check for CSS Grid or Flexbox with multiple items
            if (style.display === 'grid' ||
                (style.display === 'flex' && parent.children.length > 3)) {
                return true;
            }

            // Check for common grid class names
            const className = parent.className.toLowerCase();
            if (className.includes('grid') || className.includes('catalog') ||
                className.includes('products') || className.includes('items')) {
                return true;
            }

            parent = parent.parentElement;
            depth++;
        }

        return false;
    }

    /**
     * Check if image is in a product area based on selectors
     * @param {HTMLImageElement} img - The image element to check
     * @returns {boolean} True if in product area
     */
    isInProductArea(img) {
        const productSelectors = [
            ...(this.currentSite?.selectors?.productCards || []),
            '.product', '.item', '.card', '.tile', '.grid-item'
        ];

        let parent = img.parentElement;
        let depth = 0;

        while (parent && depth < 10) {
            for (const selector of productSelectors) {
                try {
                    if (parent.matches(selector)) {
                        return true;
                    }
                } catch (e) {
                    // Skip invalid selectors
                }
            }
            parent = parent.parentElement;
            depth++;
        }

        return false;
    }

    /**
     * Get detected products
     * @returns {Array} Array of detected product objects
     */
    getDetectedProducts() {
        return [...this.detectedProducts];
    }

    /**
     * Clear all detected products
     */
    clearDetectedProducts() {
        this.detectedProducts = [];
        this.processedImages.clear();

        // Remove detection markers from DOM
        const markedImages = document.querySelectorAll('[data-ai-style-detected]');
        markedImages.forEach(img => {
            img.removeAttribute('data-ai-style-detected');
            img.removeAttribute('data-ai-style-index');
        });
    }

    /**
     * Enable debug mode for detailed logging
     */
    enableDebugMode() {
        this.debugMode = true;
        console.log('🐛 ImageDetector debug mode enabled');
    }

    /**
     * Disable debug mode
     */
    disableDebugMode() {
        this.debugMode = false;
    }

    /**
     * Update site configuration
     * @param {Object} siteConfig - New site configuration
     */
    updateSiteConfig(siteConfig) {
        this.currentSite = siteConfig;
        this.candidateFinder.updateSiteConfig(siteConfig);
    }

    /**
     * Get detection statistics
     * @returns {Object} Statistics about detection results
     */
    getDetectionStats() {
        const totalProcessed = this.processedImages.size;
        const totalDetected = this.detectedProducts.length;
        const totalRejected = totalProcessed - totalDetected;

        return {
            totalProcessed,
            totalDetected,
            totalRejected,
            detectionRate: totalProcessed > 0 ? (totalDetected / totalProcessed) * 100 : 0
        };
    }
}