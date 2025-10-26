// Core modules
import { SiteDetector } from './SiteDetector.js';
import { PageTypeDetector } from './PageTypeDetector.js';

// Detection modules
import { ImageDetector } from '../detection/ImageDetector.js';
import { CandidateFinder } from '../detection/CandidateFinder.js';

// AI modules
import { AIAnalysisEngine } from '../ai/AIAnalysisEngine.js';
import { PersonalStyleMatcher } from '../ai/PersonalStyleMatcher.js';
import { ProductSearchMatcher } from '../ai/ProductSearchMatcher.js';

// UI modules
import { LoadingAnimations } from '../ui/LoadingAnimations.js';
import { GlobalProgressIndicator } from '../ui/GlobalProgressIndicator.js';
import { VisualIndicators } from '../ui/VisualIndicators.js';
import { DebugInterface } from '../ui/DebugInterface.js';
import { StyleOverlayController } from '../ui/StyleOverlayController.js';

// Utility modules
import { EventListeners } from '../utils/EventListeners.js';
import { DOMUtils } from '../utils/DOMUtils.js';
import { FilterStateManager } from '../utils/FilterStateManager.js';

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
        this.personalStyleMatcher = new PersonalStyleMatcher();
        this.productSearchMatcher = new ProductSearchMatcher();

        // UI components
        this.loadingAnimations = new LoadingAnimations();
        this.globalProgressIndicator = new GlobalProgressIndicator();
        this.debugInterface = new DebugInterface();

        // Filter components
        this.filterStateManager = new FilterStateManager();
        this.visualIndicators = new VisualIndicators(false);
        this.styleOverlayController = new StyleOverlayController();

        // Event management
        this.eventListeners = new EventListeners(this);

        // State tracking
        this.detectedProducts = [];
        this.processedImages = new Set();
        this.lastDetectionResults = null;
        this.isInitialized = false;
        this.styleProfile = null; // User's style profile loaded from storage
        this.productAnalysisResults = new Map(); // Map of image -> analysis result

        // UI visibility state
        this.isShowingStyleSuggestions = false; // true = show UI suggestions, false = hide UI

        // Performance settings
        // Viewport analysis moved to separate module (ViewportAnalysis.js)
    }

    /**
     * Initialize the content script
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ ContentScriptManager already initialized');
            return;
        }

        const initStart = performance.now();
        console.log(`✅ AI Style Filter initializing on ${this.currentSite?.name || 'Unknown site'}`);
        console.log(`📄 Page Type: ${this.pageType}`);

        // Inject reactive filter CSS styles
        const cssStart = performance.now();
        this.injectFilterStyles();
        console.log(`⏱️ CSS injection took ${(performance.now() - cssStart).toFixed(2)}ms`);

        // Load user's style profile and UI visibility setting in parallel
        const profileStart = performance.now();
        const storageStart = performance.now();
        const [profileResult, uiVisibilityResult] = await Promise.all([
            this.loadStyleProfile(),
            this.loadUIVisibility()
        ]);
        console.log(`⏱️ Storage operations (profile + ranking) took ${(performance.now() - storageStart).toFixed(2)}ms`);

        // Initialize filter state manager
        const filterStart = performance.now();
        await this.filterStateManager.initialize();
        console.log(`⏱️ Filter state init took ${(performance.now() - filterStart).toFixed(2)}ms`);

        // Set up event listeners (non-blocking)
        this.setupEventListeners();

        // Viewport analysis moved to separate module (ViewportAnalysis.js)
        // Currently unused - extension uses one-time detection instead

        // Show style overlay controls on the page automatically (non-blocking)
        this.styleOverlayController.showControls();

        // Notify that initialization is complete (non-blocking)
        this.notifyBackgroundScript();

        // Run initial product detection after a very short delay to ensure DOM is ready
        this.runInitialDetection();

        this.isInitialized = true;
        console.log(`🎉 ContentScriptManager initialization complete - Total: ${(performance.now() - initStart).toFixed(2)}ms`);
    }

    /**
     * Inject CSS stylesheet for reactive filter styling
     * @private
     */
    injectFilterStyles() {
        const styleId = 'ai-style-filter-css';

        // Check if already injected
        if (document.getElementById(styleId)) {
            console.log('ℹ️ Filter CSS already injected');
            return;
        }

        try {
            const link = document.createElement('link');
            link.id = styleId;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = chrome.runtime.getURL('content/styles/FilterStyles.css');

            document.head.appendChild(link);
            console.log('✅ Filter CSS injected successfully');
        } catch (error) {
            console.error('❌ Failed to inject filter CSS:', error);
        }
    }

    /**
     * Run initial product detection after a brief delay
     * @private
     */
    async runInitialDetection() {
        const delayStart = performance.now();
        // Wait for page to settle and images to load
        // Reduced delay significantly - most pages are ready much faster
        setTimeout(async () => {
            console.log(`⏱️ Delay before detection: ${(performance.now() - delayStart).toFixed(2)}ms`);
            const detectionStart = performance.now();
            await this.detectProductImages();
            console.log(`⏱️ Image detection took ${(performance.now() - detectionStart).toFixed(2)}ms`);
        }, 500); // Increased to 500ms to allow for lazy loading and dynamic content
    }

    /**
     * Set up event listeners
     * @private
     */
    setupEventListeners() {
        this.eventListeners.setupNavigationListener(() => {
            this.handleNavigationChange();
        });

        // DISABLED: Lazy loading detection causes issues with image hover swaps
        // Only detect initial images on page load, not dynamic changes
        // this.eventListeners.setupLazyLoadingDetection(() => {
        //     this.handleNewImagesDetected();
        // });

        // EventListeners handles message setup directly
        this.eventListeners.setupMessageListeners();

        // Listen for showStyleSuggestions changes from popup
        this.setupUIVisibilityListener();
    }

    /**
     * Setup storage listener for UI visibility changes
     * @private
     */
    setupUIVisibilityListener() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.showStyleSuggestions) {
                const newValue = changes.showStyleSuggestions.newValue;
                const oldValue = changes.showStyleSuggestions.oldValue;

                console.log(`🔄 showStyleSuggestions changed: ${oldValue} → ${newValue}`);

                // Update state and toggle UI
                this.isShowingStyleSuggestions = newValue;
                this.showStyleSuggestions(newValue);
            }
        });
    }

    // Viewport analysis code moved to /detection/ViewportAnalysis.js
    // This feature is currently unused - extension uses one-time detection instead




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

            // Scroll-based detection moved to ViewportAnalysis.js module

            // Hide loading animation
            this.loadingAnimations.hideLoadingAnimation();

            // Show success message
            if (results.detectedImages.length > 0) {
                this.loadingAnimations.showSuccessMessage(
                    `Found ${results.detectedImages.length} clothing items`
                );

                // Process each image: generates descriptions (and scores if style profile exists)
                // Uses unified concurrent logic regardless of whether style profile exists
                await this.analyzeCombined(results.detectedImages);
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
     * Also triggers scoring for newly detected images
     * @returns {Promise<Object>} Detection results for new images
     */
    async detectNewImages() {
        if (!this.currentSite) return { detectedImages: [], rejectedImages: [] };

        const results = await this.imageDetector.detectNewImages();

        if (results.detectedImages.length > 0) {
            console.log(`🆕 Found ${results.detectedImages.length} new clothing items via lazy loading`);

            // Get the current count before adding new products (for proper indexing)
            const startIndex = this.detectedProducts.length;

            // Add visual indicators (green borders)
            this.visualIndicators.addVisualIndicators(results.detectedImages, results.rejectedImages, startIndex);

            // Add to detected products list
            this.detectedProducts.push(...results.detectedImages);

            // If we have a style profile, analyze these new products too
            if (this.styleProfile) {
                console.log(`📊 Starting analysis for ${results.detectedImages.length} newly detected products...`);

                // Add loading indicators to new products
                results.detectedImages.forEach((item, localIndex) => {
                    const globalIndex = startIndex + localIndex;
                    this.visualIndicators.addLoadingIndicator(item.element, globalIndex);
                });

                // Analyze the new products
                await this.analyzeNewProducts(results.detectedImages, startIndex);
            }
        }

        return results;
    }

    /**
     * Analyze newly detected products (from lazy loading)
     * Always runs style analysis in background, shows UI based on mode
     * @param {Array<Object>} newProducts - Array of newly detected product objects
     * @param {number} startIndex - Starting index for these products in the overall list
     * @private
     */
    async analyzeNewProducts(newProducts, startIndex) {
        console.log(`🔍 Analyzing ${newProducts.length} new products starting at index ${startIndex}...`);

        if (!this.styleProfile) {
            console.log('ℹ️ No style profile - skipping analysis');
            return;
        }

        // Show global progress indicator for new products
        this.globalProgressIndicator.show(newProducts.length, 'Analyzing new products');

        try {
            await this.personalStyleMatcher.initialize();

            // Track completion count for progress updates
            let completedCount = 0;

            // Process ALL new products concurrently - same pattern as analyzeCombined
            const analysisPromises = newProducts.map(async (product, localIndex) => {
                const img = product.element;
                const globalIndex = startIndex + localIndex;

                try {
                    // Analyze product with style profile
                    const styleResult = await this.personalStyleMatcher.analyzeProduct(img, this.styleProfile);

                    // Extract and store description
                    if (styleResult && styleResult.description) {
                        img.dataset.aiOutfitDescription = styleResult.description;
                    }

                    // Store style analysis result
                    if (styleResult) {
                        this.productAnalysisResults.set(img, styleResult);
                    }

                    // Update progress
                    completedCount++;
                    this.globalProgressIndicator.updateProgress(completedCount);

                    console.log(`✅ [${completedCount}/${newProducts.length}] New product analyzed (score: ${styleResult?.score})`);

                    // ⚡ PROGRESSIVE UI UPDATE: Add score overlay immediately if UI is enabled
                    if (this.showStyleSuggestions && styleResult && product?.element?.isConnected) {
                        const isFallback = styleResult.success === false ||
                                          (styleResult.method && styleResult.method.includes('fallback'));

                        if (!isFallback) {
                            try {
                                this.visualIndicators.addScoreOverlay(
                                    product.element,
                                    styleResult.score,
                                    styleResult.reasoning,
                                    globalIndex,
                                    'style'
                                );
                                console.error(`Adding score overlay for new product ${globalIndex + 1}:`, overlayError);

                            } catch (overlayError) {
                                console.error(`❌ Failed to add score overlay for new product ${globalIndex + 1}:`, overlayError);
                            }
                        }
                    }

                    return { success: true, index: localIndex };

                } catch (error) {
                    console.error(`❌ Error analyzing new product ${globalIndex + 1}:`, error);
                    completedCount++;
                    this.globalProgressIndicator.updateProgress(completedCount);
                    return { success: false, index: localIndex, error };
                }
            });

            // Wait for all analyses to complete
            console.log(`🚀 Started ${analysisPromises.length} concurrent analysis requests for new products...`);
            await Promise.all(analysisPromises);

            console.log(`✅ Background style analysis complete for ${newProducts.length} new products`);

            // ⚡ Score overlays are now added progressively during analysis
            // No batch UI update needed here - overlays appear as soon as each analysis completes

            // Hide progress indicator
            this.globalProgressIndicator.hide();

        } catch (error) {
            console.error('❌ Failed to analyze new products:', error);
            this.globalProgressIndicator.hide();
        }
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
     * Load user's style profile from storage
     * @returns {Promise<void>}
     */
    async loadStyleProfile() {
        try {
            const result = await chrome.storage.local.get(['styleProfile']);
            if (result.styleProfile) {
                this.styleProfile = result.styleProfile;
                console.log('✅ Style profile loaded:', {
                    version: this.styleProfile.version,
                    generatedAt: new Date(this.styleProfile.generated_at).toLocaleString(),
                    categories: this.styleProfile.style_categories?.map(c => c.name).join(', ')
                });
            } else {
                console.log('ℹ️ No style profile found in storage');
            }
        } catch (error) {
            console.error('❌ Failed to load style profile:', error);
        }
    }

    /**
     * Load UI visibility setting from storage
     * @returns {Promise<void>}
     */
    async loadUIVisibility() {
        try {
            const result = await chrome.storage.local.get(['showStyleSuggestions']);

            this.showStyleSuggestions = result.showStyleSuggestions || false;

            console.log('🎯 Show Style Suggestions:', this.showStyleSuggestions);
        } catch (error) {
            console.error('❌ Failed to load UI visibility setting:', error);
        }
    }

    /**
     * Combined analysis: Generate descriptions (and optionally style scores) for each image
     * Uses the same concurrent processing logic regardless of whether style profile exists
     * @param {Array<Object>} detectedImages - Array of detected product objects
     * @returns {Promise<void>}
     * @private
     */
    async analyzeCombined(detectedImages) {
        console.log('🔍 Starting combined analysis for', detectedImages.length, 'products...');

        if (detectedImages.length === 0) {
            return;
        }

        const productImages = detectedImages.map(product => product.element);
        const hasStyleProfile = !!this.styleProfile;

        // Show global progress indicator
        const progressMessage = hasStyleProfile ? 'Analyzing products' : 'Generating descriptions';
        this.globalProgressIndicator.show(detectedImages.length, progressMessage);

        try {
            await this.personalStyleMatcher.initialize();

            // Track completion count for progress updates
            let completedCount = 0;

            // Process ALL images concurrently - start all requests at once
            const analysisPromises = detectedImages.map(async (product, i) => {
                const img = product.element;

                try {
                    if (hasStyleProfile) {
                        // WITH style profile: Single AI call that returns both description and style score
                        const styleResult = await this.personalStyleMatcher.analyzeProduct(img, this.styleProfile);

                        // Extract and store description from the combined result
                        if (styleResult && styleResult.description) {
                            img.dataset.aiOutfitDescription = styleResult.description;
                        }

                        // Store style analysis result
                        if (styleResult) {
                            this.productAnalysisResults.set(img, styleResult);
                        }

                        // Update progress (atomic increment)
                        completedCount++;
                        this.globalProgressIndicator.updateProgress(completedCount);

                        console.log(`✅ [${completedCount}/${detectedImages.length}] Completed analysis (score: ${styleResult?.score})`);

                        // ⚡ PROGRESSIVE UI UPDATE: Add score overlay immediately if UI is enabled
                        if (this.showStyleSuggestions && styleResult && product?.element?.isConnected) {
                            const isFallback = styleResult.success === false ||
                                              (styleResult.method && styleResult.method.includes('fallback'));

                            if (!isFallback) {
                                try {
                                    this.visualIndicators.addScoreOverlay(
                                        product.element,
                                        styleResult.score,
                                        styleResult.reasoning,
                                        i,
                                        'style'
                                    );
                                    console.error(`Adding score overlay for product ${i + 1}:`, overlayError);
                                } catch (overlayError) {
                                    console.error(`❌ Failed to add score overlay for product ${i + 1}:`, overlayError);
                                }
                            }
                        }

                    } else {
                        // WITHOUT style profile: Just generate outfit description
                        const description = await this.personalStyleMatcher.generateOutfitDescription(img);

                        // Store description
                        if (description) {
                            img.dataset.aiOutfitDescription = description;
                        }

                        // Update progress (atomic increment)
                        completedCount++;
                        this.globalProgressIndicator.updateProgress(completedCount);

                        console.log(`✅ [${completedCount}/${detectedImages.length}] Generated description`);
                    }

                    return { success: true, index: i };

                } catch (error) {
                    console.error(`❌ Error analyzing product ${i + 1}:`, error);
                    completedCount++;
                    this.globalProgressIndicator.updateProgress(completedCount);
                    return { success: false, index: i, error };
                }
            });

            // Wait for all analyses to complete
            console.log(`🚀 Started ${analysisPromises.length} concurrent analysis requests...`);
            await Promise.all(analysisPromises);

            console.log(`✅ Combined analysis complete for ${detectedImages.length} products`);

            // ⚡ Score overlays are now added progressively during analysis (see lines 472-490)
            // No batch UI update needed here - overlays appear as soon as each analysis completes

            // Hide progress indicator
            this.globalProgressIndicator.hide();

            // Show permanent success message
            if (hasStyleProfile) {
                const analyzedCount = productImages.filter(img => this.productAnalysisResults.has(img)).length;
                const totalCount = productImages.length;
                this.loadingAnimations.showSuccessMessage(
                    `Analysis complete! ${analyzedCount}/${totalCount} images analyzed`,
                    null
                );
            } else {
                this.loadingAnimations.showSuccessMessage(
                    `Descriptions generated for ${detectedImages.length} products`,
                    null
                );
            }

        } catch (error) {
            console.error('❌ Combined analysis failed:', error);
            this.globalProgressIndicator.hide();
        }
    }

    /**
     * Add score overlays to product images (safer version with pairs)
     * @param {Array<Object>} productResultPairs - Array of {product, result, index} objects
     * @private
     */
    addScoreOverlays(productResultPairs) {
        console.log('🎨 addScoreOverlays called with', productResultPairs.length, 'pairs');

        productResultPairs.forEach(({product, result, index}) => {
            console.log(`   Product ${index + 1}:`, {
                hasProduct: !!product,
                hasElement: !!product?.element,
                isConnected: !!product?.element?.isConnected,
                score: result?.score,
                reasoning: result?.reasoning
            });

            if (!result) {
                console.warn(`   ⚠️ No result for product at index ${index}`);
                return;
            }

            if (!product || !product.element) {
                console.warn(`   ⚠️ Cannot add score overlay - missing product or element at index ${index}`);
                return;
            }

            // SAFETY CHECK: Verify element is still in DOM before adding overlay
            if (!product.element.isConnected) {
                console.warn(`   ⚠️ Product ${index + 1} element is no longer in DOM - skipping score overlay`);
                return;
            }

            // Only show badge if analysis was successful (not a fallback)
            const isFallback = result.success === false ||
                              (result.method && result.method.includes('fallback'));

            if (isFallback) {
                console.log(`   ⚠️ Product ${index + 1} returned fallback result - keeping loading indicator`);
                // Keep the loading indicator, don't replace it with a fallback badge
            } else {
                console.log(`   ✏️ Calling addScoreOverlay for product ${index + 1}:`, {
                    score: result.score,
                    scoreType: typeof result.score,
                    reasoning: result.reasoning?.substring(0, 50),
                    imgAlt: product.element.alt
                });
                // Add score overlay to product
                try {
                    this.visualIndicators.addScoreOverlay(
                        product.element,
                        result.score,
                        result.reasoning,
                        index,
                        'style'
                    );
                } catch (error) {
                    console.error(`   ❌ Failed to add score overlay for product ${index + 1}:`, error);
                }
            }
        });

        console.log('✅ Product score overlays added');
    }

    /**
     * Clear all product analysis data
     */
    clearProductAnalysis() {
        this.productAnalysisResults.clear();
        this.personalStyleMatcher.clearCache();
        console.log('🧹 Product analysis data cleared');
    }

    /**
     * Clear all product detection indicators and state
     */
    clearProductDetection() {
        this.visualIndicators.clearProductDetection();
        this.detectedProducts = [];
        this.processedImages.clear();
        this.lastDetectionResults = null;
        this.clearProductAnalysis(); // Also clear analysis data
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

        // Run detection on new page
        this.runInitialDetection();
    }

    // Message handling moved to EventListeners.js for centralized management


    /**
     * Toggle style overlay controls visibility
     */
    toggleStyleOverlayControls() {
        this.styleOverlayController.toggleControls();
    }

    /**
     * Show style overlay controls
     */
    showStyleOverlayControls() {
        this.styleOverlayController.showControls();
        // Sync StyleOverlayController UI with FilterStateManager state
        const currentState = this.filterStateManager.getFilterState();
        this.styleOverlayController.setFilterState(currentState);
    }

    /**
     * Hide style overlay controls
     */
    hideStyleOverlayControls() {
        this.styleOverlayController.hideControls();
    }

    /**
     * Get current filter state
     * @returns {Object} Current filter state
     */
    getFilterState() {
        return this.filterStateManager.getFilterState();
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


    /**
     * Show or hide style suggestion UI elements
     * @param {boolean} show - true to show UI suggestions, false to hide them
     * @returns {Promise<void>}
     */
    async showStyleSuggestions(show) {
        console.log(`🔄 showStyleSuggestions called with show=${show}`);

        // Update UI visibility state
        this.showStyleSuggestions = show;

        if (show) {
            // Show style scores from existing analysis
            if (this.detectedProducts.length > 0 && this.styleProfile) {
                console.log('🎨 Displaying style scores...');
                
                // Create array of [product, result] pairs for safe updating
                const productResultPairs = this.detectedProducts.map((product, i) => ({
                    product,
                    result: this.productAnalysisResults.get(product.element),
                    index: i
                })).filter(pair => pair.result); // Only include products that have results

                // Display existing results using safer pairs approach
                this.addScoreOverlays(productResultPairs);
            } else if (!this.styleProfile) {
                console.log('ℹ️ No style profile available');
            } else {
                console.log('ℹ️ No detected products');
            }
        } else {
            // Remove all visual indicators from page (but keep data)
            console.log('🧹 Hiding visual indicators...');
            this.visualIndicators.clearAllIndicators();

            console.log('✅ Style suggestions hidden - UI hidden (background analysis preserved)');
        }
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.ContentScriptManager = ContentScriptManager;
}