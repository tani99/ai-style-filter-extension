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
import { ScoreBadgeManager } from '../ui/ScoreBadgeManager.js';
import { StyleToggleController } from '../ui/StyleToggleController.js';

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
        this.personalStyleMatcher = new PersonalStyleMatcher();
        this.productSearchMatcher = new ProductSearchMatcher();

        // UI components
        this.loadingAnimations = new LoadingAnimations();
        this.globalProgressIndicator = new GlobalProgressIndicator();
        this.debugInterface = new DebugInterface();

        // Visual indicators
        this.visualIndicators = new VisualIndicators(false);

        // NEW: Simplified badge and toggle components
        this.scoreBadgeManager = new ScoreBadgeManager();
        this.styleToggleController = new StyleToggleController(this);

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
        this.isStyleModeOn = false; // NEW: Simple toggle for score badges and visual effects

        // Background task
        this.backgroundTaskInterval = null; // Interval ID for background task

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
        const storageStart = performance.now();
        await Promise.all([
            this.loadStyleProfile(),
            this.loadUIVisibility(),
            this.loadToggleState() // NEW: Load toggle state for score badges
        ]);
        console.log(`⏱️ Storage operations (profile + visibility + toggle) took ${(performance.now() - storageStart).toFixed(2)}ms`);

        // Set up event listeners (non-blocking)
        this.setupEventListeners();

        // Viewport analysis moved to separate module (ViewportAnalysis.js)
        // Currently unused - extension uses one-time detection instead

        // Show style toggle controls on the page automatically (non-blocking)
        this.styleToggleController.showControls();

        // Notify that initialization is complete (non-blocking)
        this.notifyBackgroundScript();

        // Run initial product detection after a very short delay to ensure DOM is ready
        this.runInitialDetection();

        this.isInitialized = true;
        console.log(`🎉 ContentScriptManager initialization complete - Total: ${(performance.now() - initStart).toFixed(2)}ms`);

        // Start background task
        this.startBackgroundTask();
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

            // Print summary table of detection results
            this.printImageDetectionSummary(results.detectedImages, results.rejectedImages);

            // Scroll-based detection moved to ViewportAnalysis.js module

            // Hide loading animation
            this.loadingAnimations.hideLoadingAnimation();

            // Show success message
            if (results.detectedImages.length > 0) {
                this.loadingAnimations.showSuccessMessage(
                    `Found ${results.detectedImages.length} clothing items`
                );

                // REMOVED: Old analysis trigger - See IMAGE_ANALYSIS_REFACTOR_PLAN.md
                // await this.analyzeCombined(results.detectedImages);
                // TODO: New lazy-loading analysis system will be implemented here
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
     * Print summary table of detected images with their details
     * @param {Array} detectedImages - Array of detected image objects
     * @param {Array} rejectedImages - Array of rejected image objects
     * @private
     */
    printImageDetectionSummary(detectedImages, rejectedImages) {
        console.log('\n📊 IMAGE DETECTION SUMMARY');
        console.log('═'.repeat(100));
        
        // Header with src column
        console.log('│ Index │ Alt Text                    │ Indicator │ Status    │ Image Src');
        console.log('├───────┼─────────────────────────────┼───────────┼───────────┼─────────────────────────────────────┤');
        
        // Process detected images
        detectedImages.forEach((item, index) => {
            const altText = item.imageInfo?.alt || 'No alt text';
            const truncatedAlt = altText.length > 25 ? altText.substring(0, 22) + '...' : altText.padEnd(25);
            const indicatorStatus = '✅ Added';
            const status = 'Detected';
            const src = item.imageInfo?.src || item.element?.src || 'No src';
            const truncatedSrc = src.length > 35 ? src.substring(0, 32) + '...' : src.padEnd(35);
            
            console.log(`│ ${(index + 1).toString().padStart(5)} │ ${truncatedAlt} │ ${indicatorStatus.padEnd(9)} │ ${status.padEnd(9)} │ ${truncatedSrc} │`);
        });
        
        // Process rejected images (if any)
        rejectedImages.forEach((item, index) => {
            const altText = item.imageInfo?.alt || 'No alt text';
            const truncatedAlt = altText.length > 25 ? altText.substring(0, 22) + '...' : altText.padEnd(25);
            const indicatorStatus = '❌ None';
            const status = 'Rejected';
            const src = item.imageInfo?.src || item.element?.src || 'No src';
            const truncatedSrc = src.length > 35 ? src.substring(0, 32) + '...' : src.padEnd(35);
            
            console.log(`│ ${(detectedImages.length + index + 1).toString().padStart(5)} │ ${truncatedAlt} │ ${indicatorStatus.padEnd(9)} │ ${status.padEnd(9)} │ ${truncatedSrc} │`);
        });
        
        // Footer
        console.log('└───────┴─────────────────────────────┴───────────┴───────────┴─────────────────────────────────────┘');
        console.log(`📈 Total: ${detectedImages.length} detected, ${rejectedImages.length} rejected`);
        console.log('═'.repeat(100) + '\n');
    }

    // REMOVED: detectNewImages method - lazy loading detection disabled

    // REMOVED: analyzeNewProducts method - See IMAGE_ANALYSIS_REFACTOR_PLAN.md
    // This method also used Promise.all() for concurrent analysis without rate limiting
    // TODO: Will be replaced with queue-based analysis system in Phase 2

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

            this.isShowingStyleSuggestions = result.showStyleSuggestions || false;

            console.log('🎯 Show Style Suggestions:', this.isShowingStyleSuggestions);
        } catch (error) {
            console.error('❌ Failed to load UI visibility setting:', error);
        }
    }

    /**
     * Load toggle state for score badges from storage
     * @private
     */
    async loadToggleState() {
        try {
            const result = await chrome.storage.local.get(['styleToggleOn']);
            this.isStyleModeOn = result.styleToggleOn || false;

            // Sync with badge manager
            this.scoreBadgeManager.isVisible = this.isStyleModeOn;

            console.log('✅ Style mode loaded:', this.isStyleModeOn ? 'ON' : 'OFF');
        } catch (error) {
            console.error('❌ Failed to load toggle state:', error);
        }
    }

    // REMOVED: analyzeCombined method - See IMAGE_ANALYSIS_REFACTOR_PLAN.md
    // This method used Promise.all() to analyze all images simultaneously with no rate limiting
    // TODO: Will be replaced with queue-based analysis system in Phase 2


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
        
        // Stop background task when clearing detection
        this.stopBackgroundTask();
        
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
        this.styleToggleController.toggleControls();
    }

    /**
     * Show style overlay controls
     */
    showStyleOverlayControls() {
        this.styleToggleController.showControls();
    }

    /**
     * Hide style overlay controls
     */
    hideStyleOverlayControls() {
        this.styleToggleController.hideControls();
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
     * Set style mode toggle state (called by StyleToggleController)
     * @param {boolean} isOn - true = show badges, false = hide badges
     */
    async setStyleModeToggle(isOn) {
        console.log(`🔄 Setting style mode: ${isOn ? 'ON' : 'OFF'}`);

        this.isStyleModeOn = isOn;

        if (isOn) {
            // Toggle ON: Show all badges for images with scores
            this.scoreBadgeManager.showAllBadges();
        } else {
            // Toggle OFF: Hide all badges and clear effects
            this.scoreBadgeManager.hideAllBadges();
        }

        console.log(`✅ Style mode ${isOn ? 'enabled' : 'disabled'}`);
    }

    /**
     * Show or hide style suggestion UI elements
     * @param {boolean} show - true to show UI suggestions, false to hide them
     * @returns {Promise<void>}
     */
    async showStyleSuggestions(show) {
        console.log(`🔄 showStyleSuggestions called with show=${show}`);

        // Update UI visibility state
        this.isShowingStyleSuggestions = show;

        if (show) {
            // Show style scores from existing analysis
            if (this.detectedProducts.length > 0 && this.styleProfile) {
                console.log('🎨 Displaying style scores...');
                // TODO: Style score display will be reimplemented with new queue system
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

    /**
     * Start background task that runs every 5 seconds
     * @private
     */
    startBackgroundTask() {
        console.log('🔄 Starting background task (runs every 5 seconds)');
        
        this.backgroundTaskInterval = setInterval(() => {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`🔄 Running in background - ${timestamp}`);
            
            // Check for updated src attributes and update stored images
            if (this.detectedProducts && this.detectedProducts.length > 0) {
                let updatedCount = 0;

                this.detectedProducts.forEach((item, index) => {
                    // Query DOM element by alt text instead of data-detection-index
                    // This is more reliable for lazy-loaded images where DOM elements may be replaced
                    const altText = item.imageInfo?.alt;
                    let currentElement = null;

                    if (altText && altText !== '(no alt text)') {
                        // Find the image by alt text (safer than querySelector with special characters)
                        const allImages = document.querySelectorAll('img');
                        currentElement = Array.from(allImages).find(img => img.alt === altText);
                    }

                    const currentSrc = currentElement?.src || '';
                    const storedSrc = item.imageInfo?.src || '';

                    // Check if src has been updated (lazy loading completed)
                    if (currentSrc && currentSrc !== storedSrc && !currentSrc.startsWith('data:')) {
                        // Update the stored imageInfo with new src
                        item.imageInfo.src = currentSrc;
                        item.imageInfo.srcShort = currentSrc.length > 60 ?
                            '.../' + currentSrc.split('/').pop().substring(0, 57) + '...' :
                            currentSrc;

                        // Update the stored element reference to the fresh DOM element
                        item.element = currentElement;

                        updatedCount++;
                        console.log(`🔄 Updated image ${index + 1} (alt: "${altText}"): ${storedSrc} → ${currentSrc}`);
                    }
                });

                if (updatedCount > 0) {
                    console.log(`✅ Updated ${updatedCount} images with new src attributes`);
                }

                // Print summary table with image src column
                this.printImageDetectionSummary(this.detectedProducts, []);
            } else {
                console.log('📸 No detected images found');
            }
        }, 5000); // 5 seconds
    }

    /**
     * Stop the background task
     * @private
     */
    stopBackgroundTask() {
        if (this.backgroundTaskInterval) {
            clearInterval(this.backgroundTaskInterval);
            this.backgroundTaskInterval = null;
            console.log('⏹️ Background task stopped');
        }
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.ContentScriptManager = ContentScriptManager;
}