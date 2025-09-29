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
        // Initialize core components
        this.siteDetector = new SiteDetector();
        this.pageTypeDetector = new PageTypeDetector();

        // Detect current site and page type
        this.currentSite = this.siteDetector.detectCurrentSite();
        this.currentUrl = window.location.href;
        this.currentHost = window.location.hostname;
        this.pageType = this.pageTypeDetector.detectPageType(this.currentSite);

        // Initialize other components
        this.candidateFinder = new CandidateFinder(this.currentSite);
        this.imageDetector = new ImageDetector(this.currentSite, this.isClothingImageCallback.bind(this));
        this.aiAnalysisEngine = new AIAnalysisEngine();

        // UI components
        this.loadingAnimations = new LoadingAnimations();
        this.visualIndicators = new VisualIndicators();
        this.debugInterface = new DebugInterface();

        // Event management
        this.eventListeners = new EventListeners(this.currentSite);

        // State tracking
        this.detectedProducts = [];
        this.processedImages = new Set();
        this.lastDetectionResults = null;
        this.isInitialized = false;

        // Performance settings
        this.maxConcurrentAnalyses = 6;
        this.viewportAnalysisEnabled = true;
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

        // Initialize AI analysis engine
        await this.initializeStyleAnalysis();

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
     * Initialize style analysis system
     * @private
     */
    async initializeStyleAnalysis() {
        console.log('🎨 Initializing style analysis system...');

        // Load user's style profile from storage
        await this.loadUserStyleProfile();

        // Update AI analysis engine with the profile
        if (this.userStyleProfile) {
            this.aiAnalysisEngine.updateStyleProfile(this.userStyleProfile);
        }
    }

    /**
     * Load user's style profile from chrome storage
     * @private
     */
    async loadUserStyleProfile() {
        try {
            const result = await chrome.storage.local.get(['styleProfile']);
            if (result.styleProfile) {
                this.userStyleProfile = result.styleProfile;
                console.log('📋 Style profile loaded for product analysis:', {
                    colors: this.userStyleProfile.color_palette?.best_colors?.length || 0,
                    styles: this.userStyleProfile.style_categories?.length || 0,
                    generated: new Date(this.userStyleProfile.generated_at).toLocaleDateString()
                });
            } else {
                console.log('⚠️ No style profile found - product analysis will be limited');
            }
        } catch (error) {
            console.error('Failed to load style profile:', error);
        }
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
     * Initialize product page specific features
     * @private
     */
    initializeProductPage() {
        console.log('🛍️ Setting up product page features...');
        this.testSelectors();

        // Start detection after a delay to allow dynamic content to load
        setTimeout(async () => {
            await this.detectProductImages();
        }, 1000);
    }

    /**
     * Initialize listing page specific features
     * @private
     */
    initializeListingPage() {
        console.log('📋 Setting up listing page features...');
        this.testSelectors();

        // Start detection with longer delay for grid loading
        setTimeout(async () => {
            await this.detectProductImages();
        }, 1500);
    }

    /**
     * Initialize general page features
     * @private
     */
    initializeGeneralPage() {
        console.log('🏠 Setting up general page features...');
        this.testSelectors();

        // Delayed detection for dynamic content
        setTimeout(async () => {
            await this.detectProductImages();
        }, 2000);
    }

    /**
     * Set up all event listeners
     * @private
     */
    setupEventListeners() {
        // Set up Chrome extension message listeners
        this.eventListeners.setupMessageListeners(this);

        // Set up navigation listeners for SPA support
        this.eventListeners.setupNavigationListener(() => {
            this.handleNavigationChange();
        });

        // Set up lazy loading detection
        this.eventListeners.setupLazyLoadingDetection(() => {
            this.handleNewImagesDetected();
        });
    }

    /**
     * Set up viewport-based analysis system
     * @private
     */
    setupViewportAnalysis() {
        if (!('IntersectionObserver' in window) || !this.viewportAnalysisEnabled) {
            return;
        }

        this.analysisObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.target.tagName === 'IMG') {
                    const img = entry.target;

                    // Check if it's a detected clothing image that needs style analysis
                    if (img.dataset.aiStyleDetected === 'true' && !img.dataset.styleAnalyzed) {
                        this.analyzeProductInViewport(img);
                    }
                }
            });
        }, {
            rootMargin: '50px',
            threshold: 0.1
        });

        // Start observing all detected images
        document.querySelectorAll('[data-ai-style-detected="true"]').forEach(img => {
            this.analysisObserver.observe(img);
        });
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

            // Add visual indicators
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

            // Set up viewport analysis for new images
            if (this.analysisObserver && results.detectedImages.length > 0) {
                results.detectedImages.forEach(item => {
                    this.analysisObserver.observe(item.element);
                });
            }

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
        if (!this.imageDetector) {
            return { detectedImages: [], rejectedImages: [] };
        }

        this.loadingAnimations.showLoadingAnimation('Analyzing new products...');

        try {
            const results = await this.imageDetector.detectNewImages();

            if (results.detectedImages.length > 0) {
                // Calculate start index for new images
                const existingDetected = document.querySelectorAll('[data-ai-style-detected="true"]').length;
                const startIndex = existingDetected - results.detectedImages.length;

                // Add visual indicators
                this.visualIndicators.addVisualIndicators(results.detectedImages, results.rejectedImages, startIndex);

                // Set up viewport analysis
                if (this.analysisObserver) {
                    results.detectedImages.forEach(item => {
                        this.analysisObserver.observe(item.element);
                    });
                }

                // Update stored products
                this.detectedProducts = [...this.detectedProducts, ...results.detectedImages];

                this.loadingAnimations.showSuccessMessage(
                    `Found ${results.detectedImages.length} new items`
                );
            } else {
                this.loadingAnimations.hideLoadingAnimation();
            }

            return results;

        } catch (error) {
            console.error('New image detection failed:', error);
            this.loadingAnimations.hideLoadingAnimation();
            return { detectedImages: [], rejectedImages: [] };
        }
    }

    /**
     * Callback for clothing image analysis (used by ImageDetector)
     * @param {HTMLImageElement} img - Image element to analyze
     * @returns {Promise<Object>} Analysis result
     * @private
     */
    async isClothingImageCallback(img) {
        // This integrates ImageClassifier functionality into the detection pipeline
        return await this.aiAnalysisEngine.imageClassifier.isClothingImage(img);
    }

    /**
     * Analyze product for style compatibility when it enters viewport
     * @param {HTMLImageElement} img - Image element
     * @private
     */
    async analyzeProductInViewport(img) {
        if (!this.userStyleProfile) {
            return;
        }

        try {
            const analysis = await this.aiAnalysisEngine.analyzeProduct(img);

            // Mark as analyzed to prevent re-analysis
            img.dataset.styleAnalyzed = 'true';

            // Update visual indicators with style analysis
            // This would require extending VisualIndicators to update existing overlays
            console.log(`🎨 Style analysis complete for viewport image: ${analysis.score}/10`);

        } catch (error) {
            console.log('Style analysis failed for viewport image:', error);
        }
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
        this.aiAnalysisEngine.resetAnalysisState();
        this.detectedProducts = [];
        this.processedImages.clear();
        this.lastDetectionResults = null;

        if (this.analysisObserver) {
            this.analysisObserver.disconnect();
            this.setupViewportAnalysis();
        }

        console.log('🧹 All product detection cleared');
    }

    /**
     * Enable debug mode
     */
    enableDebugMode() {
        this.debugInterface.enableDebugMode();
        this.visualIndicators.setDebugMode(true);
        this.imageDetector.enableDebugMode();
        console.log('🐛 Debug mode enabled across all components');
    }

    /**
     * Disable debug mode
     */
    disableDebugMode() {
        this.debugInterface.disableDebugMode();
        this.visualIndicators.setDebugMode(false);
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
            aiStats: this.aiAnalysisEngine.getAnalysisStats(),
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
            }).catch(() => {
                // Ignore connection errors during page transitions
            });
        } catch (error) {
            // Ignore runtime errors during cleanup
        }
    }

    /**
     * Update site configuration (useful for dynamic updates)
     * @param {Object} newSiteConfig - New site configuration
     */
    updateSiteConfig(newSiteConfig) {
        this.currentSite = newSiteConfig;
        this.candidateFinder.updateSiteConfig(newSiteConfig);
        this.imageDetector.updateSiteConfig(newSiteConfig);
        console.log('🔄 Site configuration updated');
    }

    /**
     * Cleanup all resources
     */
    cleanup() {
        // Clean up observers
        if (this.analysisObserver) {
            this.analysisObserver.disconnect();
        }

        // Clean up UI components
        this.loadingAnimations.cleanup();
        this.visualIndicators.cleanup();
        this.debugInterface.cleanup();

        // Clean up event listeners
        this.eventListeners.cleanup();

        // Reset state
        this.detectedProducts = [];
        this.processedImages.clear();
        this.isInitialized = false;

        console.log('🧹 ContentScriptManager cleanup complete');
    }

    /**
     * Get comprehensive status information
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            site: this.currentSite?.name || 'Unknown',
            pageType: this.pageType,
            detectedProducts: this.detectedProducts.length,
            debugMode: this.debugInterface.isDebugEnabled(),
            aiReady: this.aiAnalysisEngine ? this.aiAnalysisEngine.isAIReady() : false,
            timestamp: Date.now()
        };
    }
}