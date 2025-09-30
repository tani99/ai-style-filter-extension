// Core modules
import { SiteDetector } from './SiteDetector.js';
import { PageTypeDetector } from './PageTypeDetector.js';

// Detection modules
import { ImageDetector } from '../detection/ImageDetector.js';
import { CandidateFinder } from '../detection/CandidateFinder.js';

// AI modules
import { AIAnalysisEngine } from '../ai/AIAnalysisEngine.js';

// UI modules
import { LoadingAnimations } from '../ui/LoadingAnimations.js';
import { VisualIndicators } from '../ui/VisualIndicators.js';
import { DebugInterface } from '../ui/DebugInterface.js';

// Utility modules
import { EventListeners } from '../utils/EventListeners.js';
import { DOMUtils } from '../utils/DOMUtils.js';

/**
 * ContentScriptManager is the main orchestrating class that coordinates
 * all modules and provides the public API for the content script
 */
export class ContentScriptManager {
    constructor() {
        // Get current page info
        this.currentUrl = window.location.href;
        this.currentHost = window.location.hostname;

        // Initialize core components with proper parameters
        this.siteDetector = new SiteDetector(this.currentHost);
        this.pageTypeDetector = new PageTypeDetector(this.currentUrl, this.currentHost);

        // Detect current site and page type
        this.currentSite = this.siteDetector.detectCurrentSite();
        this.pageType = this.pageTypeDetector.detectPageType();

        // Initialize other components
        this.candidateFinder = new CandidateFinder(this.currentSite);
        this.imageDetector = new ImageDetector(this.currentSite, this.isClothingImageCallback.bind(this));
        this.aiAnalysisEngine = new AIAnalysisEngine();

        // UI components
        this.loadingAnimations = new LoadingAnimations();
        this.visualIndicators = new VisualIndicators();
        this.debugInterface = new DebugInterface();

        // Event management
        this.eventListeners = new EventListeners(this);

        // State tracking
        this.detectedProducts = [];
        this.processedImages = new Set();
        this.lastDetectionResults = null;
        this.isInitialized = false;

        // Performance settings
        this.maxConcurrentAnalyses = 6;
        this.viewportAnalysisEnabled = false; // Disabled - detect all images at once
        this.analysisObserver = null;
    }

    /**
     * Initialize the content script
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ ContentScriptManager already initialized');
            return;
        }

        console.log(`✅ AI Style Filter initializing on ${this.currentSite?.name || 'Unknown site'}`);
        console.log(`📄 Page Type: ${this.pageType}`);

        // Initialize based on page type
        this.initializeForPageType();

        // Set up event listeners
        this.setupEventListeners();

        // Set up viewport analysis
        this.setupViewportAnalysis();

        // Notify that initialization is complete
        this.notifyBackgroundScript();

        this.isInitialized = true;
        console.log('🎉 ContentScriptManager initialization complete');
    }

    /**
     * Initialize based on detected page type
     * @private
     */
    initializeForPageType() {
        switch (this.pageType) {
            case 'product':
                console.log('🛍️ Initializing for product page');
                this.initializeProductPage();
                break;
            case 'category':
            case 'search':
                console.log('📋 Initializing for listing page');
                this.initializeListingPage();
                break;
            default:
                console.log('🏠 Initializing for general page');
                this.initializeGeneralPage();
        }
    }

    /**
     * Initialize for product pages
     * @private
     */
    async initializeProductPage() {
        // Wait a bit for product images to load
        setTimeout(async () => {
            await this.detectProductImages();
        }, 500);
    }

    /**
     * Initialize for listing pages (category, search)
     * @private
     */
    async initializeListingPage() {
        // Wait for page to settle
        setTimeout(async () => {
            await this.detectProductImages();
        }, 1000);
    }

    /**
     * Initialize for general pages
     * @private
     */
    async initializeGeneralPage() {
        setTimeout(async () => {
            await this.detectProductImages();
        }, 1000);
    }

    /**
     * Set up event listeners
     * @private
     */
    setupEventListeners() {
        this.eventListeners.setupNavigationListener(() => {
            this.handleNavigationChange();
        });

        this.eventListeners.setupLazyLoadingDetection(() => {
            this.handleNewImagesDetected();
        });

        this.eventListeners.setupMessageListeners((message) => {
            this.handleMessage(message);
        });
    }

    /**
     * Set up viewport-based analysis with IntersectionObserver
     * Detects images as they scroll into view
     * @private
     */
    setupViewportAnalysis() {
        if (!this.viewportAnalysisEnabled) {
            console.log('⚠️ Viewport analysis is disabled');
            return;
        }

        const observerOptions = {
            root: null,
            rootMargin: '300px', // Start analyzing 300px before image enters viewport
            threshold: 0.01
        };

        this.analysisObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    console.log('👁️ Image entered viewport:', {
                        alt: img.alt,
                        src: img.src.substring(0, 50),
                        hasDetectedFlag: img.dataset.aiStyleDetected,
                        hasAnalyzingFlag: img.dataset.aiAnalyzing
                    });

                    if (!img.dataset.aiStyleDetected && !img.dataset.aiAnalyzing) {
                        console.log('🔄 Triggering analysis for scrolled image');
                        this.analyzeNewImage(img);
                    } else {
                        console.log('⏭️ Skipping image (already processed)');
                    }
                }
            });
        }, observerOptions);

        console.log('✅ IntersectionObserver created successfully');
    }

    /**
     * Observe all images on the page for lazy detection
     */
    observeAllImages() {
        if (!this.analysisObserver) {
            console.log('❌ No analysisObserver found - cannot observe images');
            return;
        }

        const allImages = document.querySelectorAll('img');
        let observedCount = 0;

        allImages.forEach(img => {
            if (!img.dataset.aiStyleDetected && !img.dataset.aiAnalyzing) {
                this.analysisObserver.observe(img);
                observedCount++;
            }
        });

        console.log(`👁️ Total images on page: ${allImages.length}`);
        console.log(`👁️ Images being observed for scroll detection: ${observedCount}`);
        console.log(`👁️ Images already marked (skipped): ${allImages.length - observedCount}`);
    }

    /**
     * Analyze a newly visible image
     * @param {HTMLImageElement} img - Image element to analyze
     */
    async analyzeNewImage(img) {
        // Mark as being analyzed to prevent duplicate analysis
        img.dataset.aiAnalyzing = 'true';

        try {
            // Create a temporary array with just this image
            const candidateImages = [img];

            // Use the same AI callback from imageDetector
            const imageInfo = this.imageDetector.constructor.name ?
                { alt: img.alt, src: img.src.substring(0, 50) } :
                { alt: img.alt, src: img.src };

            // Check visibility
            const visibilityCheck = this.imageDetector.visibilityChecker.isImageVisible(img);
            if (!visibilityCheck.isVisible) {
                img.dataset.aiStyleDetected = 'false';
                delete img.dataset.aiAnalyzing;
                return;
            }

            // Check quality
            const quality = this.imageDetector.visibilityChecker.checkImageQuality(img);
            if (!quality.isValid) {
                img.dataset.aiStyleDetected = 'false';
                delete img.dataset.aiAnalyzing;
                return;
            }

            // Run AI detection
            if (this.imageDetector.isClothingImageCallback) {
                const isClothing = await this.imageDetector.isClothingImageCallback(img);

                if (isClothing.isClothing) {
                    const currentCount = this.detectedProducts.length;
                    const result = {
                        element: img,
                        imageInfo: { alt: img.alt, src: img.src },
                        reason: isClothing.reasoning || 'AI detected as clothing',
                        confidence: isClothing.confidence || 0.8,
                        method: isClothing.method || 'ai_classification'
                    };

                    // Add indicator
                    this.visualIndicators.addDetectedImageIndicator(result, currentCount);
                    this.detectedProducts.push(result);

                    img.dataset.aiStyleDetected = 'true';
                    console.log(`✅ Scroll detected image ${currentCount + 1}: ${img.alt || img.src.substring(0, 50)}`);
                } else {
                    img.dataset.aiStyleDetected = 'false';
                }
            }

            delete img.dataset.aiAnalyzing;
        } catch (error) {
            console.error('Error analyzing new image:', error);
            delete img.dataset.aiAnalyzing;
            img.dataset.aiStyleDetected = 'false';
        }
    }


    /**
     * Main product image detection method
     * @param {Object} options - Detection options
     * @returns {Promise<Object>} Detection results
     */
    async detectProductImages(options = {}) {
        if (!this.currentSite) {
            console.log('❌ No supported site detected. Aborting detection.');
            return { detectedImages: [], rejectedImages: [] };
        }

        // Show loading animation
        this.loadingAnimations.showLoadingAnimation('Detecting clothing items...');

        try {
            // Use ImageDetector for the main detection logic
            const results = await this.imageDetector.detectProductImages(options);

            // Add visual indicators (basic green borders only, no scores)
            this.visualIndicators.addVisualIndicators(results.detectedImages, results.rejectedImages);

            // Log results if debug mode is enabled
            if (this.debugInterface.isDebugEnabled()) {
                this.debugInterface.logDetectionResults(results.detectedImages, results.rejectedImages);
            }

            // Store results
            this.detectedProducts = results.detectedImages;
            this.lastDetectionResults = {
                detected: results.detectedImages.length,
                rejected: results.rejectedImages.length,
                timestamp: Date.now(),
                pageType: this.pageType,
                site: this.currentSite.name
            };

            // Scroll observer disabled - all images detected at once
            // if (this.analysisObserver) {
            //     this.observeAllImages();
            // }

            // Hide loading animation
            this.loadingAnimations.hideLoadingAnimation();

            // Show success message
            if (results.detectedImages.length > 0) {
                this.loadingAnimations.showSuccessMessage(
                    `Found ${results.detectedImages.length} clothing items`
                );
            }

            return results;

        } catch (error) {
            console.error('Product detection failed:', error);
            this.loadingAnimations.hideLoadingAnimation();
            this.loadingAnimations.showErrorMessage('Detection failed');
            return { detectedImages: [], rejectedImages: [] };
        }
    }

    /**
     * Detect new images (for dynamic content)
     * @returns {Promise<Object>} Detection results for new images
     */
    async detectNewImages() {
        if (!this.currentSite) return { detectedImages: [], rejectedImages: [] };

        const results = await this.imageDetector.detectNewImages();

        if (results.detectedImages.length > 0) {
            this.visualIndicators.addVisualIndicators(results.detectedImages, results.rejectedImages);
            this.detectedProducts.push(...results.detectedImages);
        }

        return results;
    }

    /**
     * Callback for clothing image analysis (used by ImageDetector)
     * @param {HTMLImageElement} img - Image element to analyze
     * @returns {Promise<Object>} Analysis result
     * @private
     */
    async isClothingImageCallback(img) {
        return await this.aiAnalysisEngine.isClothingImage(img);
    }

    /**
     * Test site-specific selectors
     */
    testSelectors() {
        const results = this.candidateFinder.testSelectors();
        if (this.debugInterface.isDebugEnabled()) {
            this.debugInterface.logSelectorStats(results);
        }
        return results;
    }

    /**
     * Clear all product detection indicators and state
     */
    clearProductDetection() {
        this.visualIndicators.clearProductDetection();
        this.detectedProducts = [];
        this.processedImages.clear();
        this.lastDetectionResults = null;
        console.log('🧹 Product detection cleared');
    }

    /**
     * Enable debug mode
     */
    enableDebugMode() {
        this.debugInterface.enableDebugMode();
        this.imageDetector.enableDebugMode();
        console.log('🐛 Debug mode enabled across all components');
    }

    /**
     * Disable debug mode
     */
    disableDebugMode() {
        this.debugInterface.disableDebugMode();
        this.imageDetector.disableDebugMode();
        console.log('🐛 Debug mode disabled across all components');
    }

    /**
     * Get detection statistics
     * @returns {Object} Detection statistics
     */
    getDetectionStats() {
        return {
            lastResults: this.lastDetectionResults,
            detectedProducts: this.detectedProducts.length,
            processedImages: this.processedImages.size,
            indicatorStats: this.visualIndicators.getIndicatorStats(),
            debugStats: this.debugInterface.getAnalysisStatistics()
        };
    }

    /**
     * Debug page structure
     * @returns {Object} Page structure debug information
     */
    debugPageStructure() {
        return this.debugInterface.debugPageStructure(
            this.currentSite,
            this.currentUrl,
            this.currentHost,
            this.pageType
        );
    }

    /**
     * Get detected products
     * @returns {Array} Array of detected product objects
     */
    getDetectedProducts() {
        return this.imageDetector.getDetectedProducts();
    }

    /**
     * Handle navigation change (SPA support)
     * @private
     */
    handleNavigationChange() {
        console.log('🧭 Navigation detected, re-evaluating page...');

        // Update URL and page type
        this.currentUrl = window.location.href;
        this.pageType = this.pageTypeDetector.detectPageType(this.currentSite);

        // Clear current state
        this.clearProductDetection();

        // Re-initialize for new page
        setTimeout(() => {
            this.initializeForPageType();
        }, 1000);
    }

    /**
     * Handle new images detected via lazy loading
     * @private
     */
    async handleNewImagesDetected() {
        console.log('🖼️ New images detected, running detection...');
        await this.detectNewImages();
    }

    /**
     * Handle messages from background script or popup
     * @param {Object} message - Message object
     * @private
     */
    handleMessage(message) {
        switch (message.action) {
            case 'detectProducts':
                this.detectProductImages();
                break;
            case 'clearDetection':
                this.clearProductDetection();
                break;
            case 'enableDebug':
                this.enableDebugMode();
                break;
            case 'disableDebug':
                this.disableDebugMode();
                break;
            case 'getStats':
                return this.getDetectionStats();
            default:
                console.log('Unknown message:', message);
        }
    }

    /**
     * Notify background script of initialization
     * @private
     */
    notifyBackgroundScript() {
        try {
            chrome.runtime.sendMessage({
                action: 'contentScriptReady',
                site: this.currentSite?.name || 'unknown',
                pageType: this.pageType,
                url: this.currentUrl
            });
        } catch (error) {
            console.log('Could not notify background script:', error);
        }
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.ContentScriptManager = ContentScriptManager;
}