// Core modules
import { SiteDetector } from './SiteDetector.js';
import { PageTypeDetector } from './PageTypeDetector.js';

// Detection modules
import { ImageDetector } from '../detection/ImageDetector.js';
import { CandidateFinder } from '../detection/CandidateFinder.js';

// AI modules
import { AIAnalysisEngine } from '../ai/AIAnalysisEngine.js';
import { ProductAnalyzer } from '../ai/ProductAnalyzer.js';
import { PromptRankingEngine } from '../ai/PromptRankingEngine.js';

// UI modules
import { LoadingAnimations } from '../ui/LoadingAnimations.js';
import { VisualIndicators } from '../ui/VisualIndicators.js';
import { DebugInterface } from '../ui/DebugInterface.js';
import { FilterControls } from '../ui/FilterControls.js';

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
        this.productAnalyzer = new ProductAnalyzer();
        this.promptRankingEngine = new PromptRankingEngine();

        // UI components
        this.loadingAnimations = new LoadingAnimations();
        this.debugInterface = new DebugInterface();

        // Filter components
        this.filterStateManager = new FilterStateManager();
        this.visualIndicators = new VisualIndicators(false, this.filterStateManager);
        this.filterControls = new FilterControls(this.handleFilterChange.bind(this));

        // Event management
        this.eventListeners = new EventListeners(this);

        // State tracking
        this.detectedProducts = [];
        this.processedImages = new Set();
        this.lastDetectionResults = null;
        this.isInitialized = false;
        this.styleProfile = null; // User's style profile loaded from storage
        this.productAnalysisResults = new Map(); // Map of image -> analysis result

        // Prompt ranking mode state
        this.currentRankingMode = 'style'; // 'style' or 'prompt'
        this.userPrompt = ''; // Current user prompt for prompt mode

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

        // Inject reactive filter CSS styles
        this.injectFilterStyles();

        // Load user's style profile
        await this.loadStyleProfile();

        // Load ranking mode and prompt
        await this.loadRankingMode();

        // Initialize filter state manager
        await this.filterStateManager.initialize();
        this.filterStateManager.addListener(this.handleFilterStateChange.bind(this));

        // Initialize based on page type
        this.initializeForPageType();

        // Set up event listeners
        this.setupEventListeners();

        // Set up viewport analysis
        this.setupViewportAnalysis();

        // Show filter controls on the page automatically
        this.filterControls.showControls();

        // Notify that initialization is complete
        this.notifyBackgroundScript();

        this.isInitialized = true;
        console.log('🎉 ContentScriptManager initialization complete');
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

        // EventListeners handles message setup directly
        this.eventListeners.setupMessageListeners();
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

                // Analyze products against style profile immediately
                if (this.styleProfile) {
                    // Add loading indicators to all detected products
                    results.detectedImages.forEach((item, index) => {
                        this.visualIndicators.addLoadingIndicator(item.element, index);
                    });

                    // Start analyzing all products immediately (in parallel)
                    this.analyzeDetectedProductsInParallel();
                } else {
                    console.log('ℹ️ No style profile available - skipping product analysis');
                }
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
     * @param {Array<Object>} newProducts - Array of newly detected product objects
     * @param {number} startIndex - Starting index for these products in the overall list
     * @private
     */
    async analyzeNewProducts(newProducts, startIndex) {
        console.log(`🔍 Analyzing ${newProducts.length} new products starting at index ${startIndex}...`);

        const productImages = newProducts.map(product => product.element);

        // Track active analyses
        let activeAnalyses = 0;
        let completedCount = 0;
        let currentIndex = 0;

        // Analyze with controlled concurrency
        await new Promise((resolve) => {
            const startNextAnalysis = async () => {
                if (currentIndex >= productImages.length && activeAnalyses === 0) {
                    resolve();
                    return;
                }

                while (currentIndex < productImages.length && activeAnalyses < this.maxConcurrentAnalyses) {
                    const localIndex = currentIndex;
                    const globalIndex = startIndex + localIndex;
                    const img = productImages[localIndex];
                    currentIndex++;
                    activeAnalyses++;

                    console.log(`🔄 Analyzing new product ${globalIndex + 1} (${activeAnalyses} active)`);

                    this.productAnalyzer.analyzeProduct(img, this.styleProfile)
                        .then((result) => {
                            this.productAnalysisResults.set(img, result);

                            const product = newProducts[localIndex];
                            if (product && product.element) {
                                // Only show badge if analysis was successful (not a fallback)
                                const isFallback = result.success === false ||
                                                  (result.method && result.method.includes('fallback'));

                                if (isFallback) {
                                    console.log(`   ⚠️ New product ${globalIndex + 1} returned fallback - keeping loading indicator`);
                                } else {
                                    this.visualIndicators.addScoreOverlay(
                                        product.element,
                                        result.score,
                                        result.reasoning,
                                        globalIndex,
                                        this.currentRankingMode
                                    );

                                    console.log(`✅ New product ${globalIndex + 1} score: ${result.score}/10`);
                                }
                                completedCount++;
                            }
                        })
                        .catch((error) => {
                            console.error(`❌ Failed to analyze new product ${globalIndex + 1}:`, error);
                            completedCount++;
                        })
                        .finally(() => {
                            activeAnalyses--;
                            startNextAnalysis();
                        });
                }
            };

            startNextAnalysis();
        });

        console.log(`✅ Finished analyzing ${completedCount} new products`);
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
     * Load ranking mode and user prompt from storage
     * @returns {Promise<void>}
     */
    async loadRankingMode() {
        try {
            const result = await chrome.storage.local.get(['rankingMode', 'userPrompt']);

            this.currentRankingMode = result.rankingMode || 'style';
            this.userPrompt = result.userPrompt || '';

            console.log('🎯 Ranking Mode:', this.currentRankingMode);
            if (this.currentRankingMode === 'prompt') {
                console.log('🔍 User Prompt:', `"${this.userPrompt}"`);
            }
        } catch (error) {
            console.error('❌ Failed to load ranking mode:', error);
        }
    }

    /**
     * Analyze all detected products against user's style profile
     * Implements Step 5.1: Real-time Product Analysis
     * @returns {Promise<void>}
     */
    async analyzeDetectedProducts() {
        console.log('🎯 analyzeDetectedProducts called');
        console.log('   Ranking mode:', this.currentRankingMode);
        console.log('   Detected products:', this.detectedProducts.length);

        if (this.detectedProducts.length === 0) {
            console.log('ℹ️ No detected products to analyze');
            return;
        }

        // Choose analyzer and parameter based on ranking mode
        let analyzer;
        let analysisParam;
        let loadingMessage;

        if (this.currentRankingMode === 'prompt') {
            // Prompt mode validation
            if (!this.userPrompt) {
                console.warn('⚠️ Prompt mode active but no prompt set');
                return;
            }

            analyzer = this.promptRankingEngine;
            analysisParam = this.userPrompt;
            loadingMessage = `Searching for "${this.userPrompt}"...`;

            console.log('🔍 Using Prompt Ranking Mode');
            console.log('   Prompt:', `"${this.userPrompt}"`);

        } else {
            // Style mode validation
            if (!this.styleProfile) {
                console.warn('⚠️ No style profile available for analysis');
                console.log('   You need to upload photos and generate a style profile first');
                return;
            }

            analyzer = this.productAnalyzer;
            analysisParam = this.styleProfile;
            loadingMessage = 'Analyzing products against your style...';

            console.log('✨ Using Style Profile Mode');
            console.log('   Style profile details:', {
                colors: this.styleProfile.color_palette?.best_colors,
                styles: this.styleProfile.style_categories?.map(c => c.name),
                version: this.styleProfile.version
            });
        }

        console.log(`🔍 Starting product analysis for ${this.detectedProducts.length} items...`);

        // Show analysis loading message
        this.loadingAnimations.showLoadingAnimation(loadingMessage);

        try {
            // Extract image elements from detected products
            const productImages = this.detectedProducts.map(product => product.element);
            console.log('📦 Product images to analyze:', productImages.length);

            // Initialize the analyzer
            await analyzer.initialize();

            // Analyze products in batches using the selected analyzer
            console.log('🚀 Starting batch analysis...');
            const analysisResults = await analyzer.analyzeBatch(
                productImages,
                analysisParam,
                {
                    batchSize: 3,
                    delayBetweenBatches: 500,
                    onProgress: (progress) => {
                        console.log(`📊 Analysis progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
                        this.loadingAnimations.updateLoadingMessage(
                            `Analyzing products: ${progress.completed}/${progress.total}`
                        );
                    }
                }
            );

            console.log('✅ Batch analysis complete, results:', analysisResults);

            // Keep results as-is without normalization
            // Prompt mode uses tier (1-3), Style mode uses score (1-10)
            const normalizedResults = analysisResults.map((result, idx) => {
                if (this.currentRankingMode === 'prompt') {
                    if (result.tier !== undefined) {
                        // For prompt mode: use tier directly (1-3 scale)
                        console.log(`   🔄 Normalizing product ${idx + 1}: tier ${result.tier} -> score ${result.tier}`);
                        return {
                            ...result,
                            score: result.tier // Use tier as score (1-3)
                        };
                    } else {
                        // ERROR: In prompt mode but no tier returned!
                        console.error(`   ❌ Product ${idx + 1}: Prompt mode but result has no tier!`, result);
                        console.error(`   This should not happen - prompt analysis should return tier (1-3)`);
                        // Fallback to tier 2 (maybe)
                        return {
                            ...result,
                            score: 2,
                            tier: 2,
                            reasoning: result.reasoning || 'Analysis error - neutral tier'
                        };
                    }
                }
                // For style mode: score is already set (1-10 scale)
                console.log(`   ✨ Style mode product ${idx + 1}: score ${result.score} (no normalization)`);
                return result;
            });

            // Store analysis results
            productImages.forEach((img, index) => {
                const result = normalizedResults[index];
                this.productAnalysisResults.set(img, result);

                // Log detailed score information with source
                const isFromAI = result.method === 'ai_analysis';
                const isDefault = result.method === 'fallback' || result.method === 'error_fallback';
                const scoreSource = isFromAI ? '🤖 AI' : (isDefault ? '⚠️ DEFAULT' : '❓ ' + result.method);

                console.log(`   📊 Product ${index + 1}:`, {
                    score: result.score,
                    source: scoreSource,
                    reasoning: result.reasoning,
                    method: result.method,
                    cached: result.cached || false,
                    success: result.success,
                    productAlt: img.alt || 'no alt text'
                });

                if (isDefault) {
                    console.warn(`   ⚠️ Product ${index + 1} using DEFAULT score - AI analysis failed or unavailable`);
                }
            });

            // Update visual indicators with scores
            console.log('🎨 Updating visual indicators with scores...');
            this.updateProductScores(normalizedResults);

            // Hide loading animation
            this.loadingAnimations.hideLoadingAnimation();

            // Show completion message
            const avgScore = this.calculateAverageScore(normalizedResults);
            const completionMessage = this.currentRankingMode === 'prompt'
                ? `Found matches for "${this.userPrompt}"!`
                : `Analysis complete! Average compatibility: ${avgScore.toFixed(1)}/10`;

            this.loadingAnimations.showSuccessMessage(completionMessage);

            // Count score sources
            const aiScores = normalizedResults.filter(r => r.method === 'ai_analysis' || r.method === 'prompt_analysis').length;
            const defaultScores = normalizedResults.filter(r => r.method === 'fallback' || r.method === 'error_fallback').length;
            const cachedScores = normalizedResults.filter(r => r.cached).length;

            console.log('✅ Product analysis complete:', {
                totalProducts: analysisResults.length,
                averageScore: avgScore.toFixed(1),
                scoreBreakdown: {
                    fromAI: aiScores,
                    fromDefault: defaultScores,
                    fromCache: cachedScores
                },
                cacheStats: this.productAnalyzer.getCacheStats()
            });

            if (defaultScores > 0) {
                console.warn(`⚠️ WARNING: ${defaultScores} products received DEFAULT scores instead of AI analysis!`);
                console.log('   This usually means AI analysis failed. Check logs above for errors.');
            }

        } catch (error) {
            console.error('❌ Product analysis failed:', error);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            this.loadingAnimations.hideLoadingAnimation();
            this.loadingAnimations.showErrorMessage('Analysis failed');
        }
    }

    /**
     * Update visual indicators with product scores
     * @param {Array<Object>} analysisResults - Analysis results
     * @private
     */
    updateProductScores(analysisResults) {
        console.log('🎨 updateProductScores called with', analysisResults.length, 'results');

        analysisResults.forEach((result, index) => {
            const product = this.detectedProducts[index];
            console.log(`   Product ${index + 1}:`, {
                hasProduct: !!product,
                hasElement: !!product?.element,
                score: result.score,
                reasoning: result.reasoning
            });

            if (product && product.element) {
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
                        mode: this.currentRankingMode,
                        tier: result.tier,
                        imgAlt: product.element.alt
                    });
                    // Add score overlay to product
                    this.visualIndicators.addScoreOverlay(
                        product.element,
                        result.score,
                        result.reasoning,
                        index,
                        this.currentRankingMode
                    );
                }
            } else {
                console.warn(`   ⚠️ Cannot add score overlay - missing product or element at index ${index}`);
            }
        });

        console.log('✅ Visual indicators updated with scores');
    }

    /**
     * Analyze all detected products with controlled concurrency
     * Uses maxConcurrentAnalyses to avoid overwhelming Chrome's AI API
     * Shows scores as they complete
     * @returns {Promise<void>}
     */
    async analyzeDetectedProductsInParallel() {
        console.log('🚀 analyzeDetectedProductsInParallel called');
        console.log('   Detected products:', this.detectedProducts.length);
        console.log('   Max concurrent analyses:', this.maxConcurrentAnalyses);

        if (!this.styleProfile || this.detectedProducts.length === 0) {
            return;
        }

        const productImages = this.detectedProducts.map(product => product.element);
        console.log(`⚡ Starting controlled parallel analysis of ${productImages.length} products...`);

        // Track active analyses
        let activeAnalyses = 0;
        let completedCount = 0;
        let currentIndex = 0;

        // Create a promise that resolves when all products are analyzed
        await new Promise((resolve) => {
            const startNextAnalysis = async () => {
                // Check if we're done
                if (currentIndex >= productImages.length && activeAnalyses === 0) {
                    resolve();
                    return;
                }

                // Start new analyses up to the concurrency limit
                while (currentIndex < productImages.length && activeAnalyses < this.maxConcurrentAnalyses) {
                    const index = currentIndex;
                    const img = productImages[index];
                    currentIndex++;
                    activeAnalyses++;

                    console.log(`🔄 Starting analysis ${index + 1}/${productImages.length} (${activeAnalyses} active)`);

                    // Analyze this product (don't await - let it run in background)
                    this.productAnalyzer.analyzeProduct(img, this.styleProfile)
                        .then((result) => {
                            // Store result
                            this.productAnalysisResults.set(img, result);

                            // Update visual indicator immediately (replace loading with score)
                            const product = this.detectedProducts[index];
                            if (product && product.element) {
                                // Only show badge if analysis was successful (not a fallback)
                                const isFallback = result.success === false ||
                                                  (result.method && result.method.includes('fallback'));

                                if (isFallback) {
                                    console.log(`   ⚠️ Product ${index + 1} returned fallback - keeping loading indicator`);
                                } else {
                                    this.visualIndicators.addScoreOverlay(
                                        product.element,
                                        result.score,
                                        result.reasoning,
                                        index,
                                        this.currentRankingMode
                                    );

                                    console.log(`✅ Product ${index + 1}/${productImages.length} score: ${result.score}/10 (${completedCount} completed)`);
                                }
                                completedCount++;
                            }
                        })
                        .catch((error) => {
                            console.error(`❌ Failed to analyze product ${index + 1}:`, error);
                            completedCount++;
                        })
                        .finally(() => {
                            // Analysis complete (success or failure)
                            activeAnalyses--;
                            console.log(`📊 Analysis complete. Active: ${activeAnalyses}, Completed: ${completedCount}/${productImages.length}`);

                            // Start next analysis
                            startNextAnalysis();
                        });
                }
            };

            // Start initial batch of analyses
            startNextAnalysis();
        });

        console.log(`✅ All ${productImages.length} product analyses complete!`);
    }

    /**
     * Calculate average score from analysis results
     * @param {Array<Object>} analysisResults - Analysis results
     * @returns {number} Average score
     * @private
     */
    calculateAverageScore(analysisResults) {
        if (analysisResults.length === 0) return 0;

        const totalScore = analysisResults.reduce((sum, result) => sum + result.score, 0);
        return totalScore / analysisResults.length;
    }


    /**
     * Get analysis result for a specific product image
     * @param {HTMLImageElement} img - Product image element
     * @returns {Object|null} Analysis result or null
     */
    getProductAnalysis(img) {
        return this.productAnalysisResults.get(img) || null;
    }

    /**
     * Clear all product analysis data
     */
    clearProductAnalysis() {
        this.productAnalysisResults.clear();
        this.productAnalyzer.clearCache();
        console.log('🧹 Product analysis data cleared');
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

    // Message handling moved to EventListeners.js for centralized management

    /**
     * Handle filter state changes from FilterStateManager
     * @param {Object} filterState - New filter state
     * @private
     */
    handleFilterStateChange(filterState) {
        console.log('🔄 Filter state changed:', filterState);
        this.applyFilterEffects(filterState);
    }

    /**
     * Handle filter changes from FilterControls UI
     * @param {Object} filterState - New filter state from UI
     * @private
     */
    handleFilterChange(filterState) {
        console.log('🎛️ Filter controls changed:', filterState);
        // Update the filter state manager (which will trigger handleFilterStateChange)
        this.filterStateManager.updateFilterState(filterState);
    }

    /**
     * Apply filter effects based on current state
     * @param {Object} filterState - Filter state to apply
     * @private
     */
    applyFilterEffects(filterState) {
        console.log('🎨 Applying filter effects to', this.detectedProducts.length, 'products');
        this.visualIndicators.applyFilterEffects(filterState);
    }

    /**
     * Toggle filter controls visibility
     */
    toggleFilterControls() {
        this.filterControls.toggleControls();
    }

    /**
     * Show filter controls
     */
    showFilterControls() {
        this.filterControls.showControls();
        // Sync FilterControls UI with FilterStateManager state
        const currentState = this.filterStateManager.getFilterState();
        this.filterControls.setFilterState(currentState);
    }

    /**
     * Hide filter controls
     */
    hideFilterControls() {
        this.filterControls.hideControls();
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
     * Handle applying a user prompt for product ranking
     * @param {string} prompt - User's search prompt
     * @returns {Promise<void>}
     */
    async handleApplyPrompt(prompt) {
        console.log('🔍 handleApplyPrompt called with:', prompt);

        // Update state FIRST before clearing anything
        this.currentRankingMode = 'prompt';
        this.userPrompt = prompt;

        // Replace score badges with loading indicators BEFORE clearing cache
        if (this.detectedProducts.length > 0) {
            console.log('🔄 Replacing score badges with loading indicators...');
            this.visualIndicators.replaceScoresWithLoadingIndicators();
        }

        // CRITICAL: Clear ALL analysis results to force fresh analysis
        // This prevents stale 1-10 scores from being treated as 1-3 tiers
        console.log('🧹 Clearing ALL analysis results for fresh prompt analysis...');
        this.productAnalysisResults.clear(); // Clear displayed results (CRITICAL!)
        this.promptRankingEngine.clearCache(); // Clear prompt cache
        this.productAnalyzer.clearCache(); // Clear style cache too (prevent stale scores)

        // Re-analyze all detected products with new prompt
        if (this.detectedProducts.length > 0) {
            console.log('🔄 Re-analyzing products with prompt...');
            await this.analyzeDetectedProducts();
        } else {
            console.log('ℹ️ No detected products to analyze');
        }
    }

    /**
     * Handle switching back to style mode
     * @returns {Promise<void>}
     */
    async handleSwitchToStyleMode() {
        console.log('✨ handleSwitchToStyleMode called');

        // Update state FIRST before clearing anything
        this.currentRankingMode = 'style';
        this.userPrompt = '';

        // Replace score badges with loading indicators BEFORE clearing cache
        if (this.detectedProducts.length > 0 && this.styleProfile) {
            console.log('🔄 Replacing score badges with loading indicators...');
            this.visualIndicators.replaceScoresWithLoadingIndicators();
        }

        // Clear prompt-related cache and displayed results
        console.log('🧹 Clearing prompt analysis cache...');
        this.promptRankingEngine.clearCache(); // Clear prompt cache
        this.productAnalysisResults.clear(); // Clear displayed results (forces fresh lookup from productAnalyzer cache)
        // NOTE: productAnalyzer cache is preserved - will use cached scores if available

        // Re-analyze with style profile if available
        if (this.styleProfile && this.detectedProducts.length > 0) {
            console.log('🔄 Re-analyzing products with style profile (using cache if available)...');
            await this.analyzeDetectedProducts();
        } else if (!this.styleProfile) {
            console.log('ℹ️ No style profile available for analysis');
        } else {
            console.log('ℹ️ No detected products to analyze');
        }
    }

    /**
     * Handle extension disable (turn off mode)
     * @returns {Promise<void>}
     */
    async handleDisableExtension() {
        console.log('⏸️ handleDisableExtension called');

        // Update state
        this.currentRankingMode = 'off';
        this.userPrompt = '';

        // Clear all caches
        console.log('🧹 Clearing all analysis caches...');
        this.productAnalysisResults.clear();
        this.promptRankingEngine.clearCache();
        this.productAnalyzer.clearCache();

        // Remove all visual indicators from page
        console.log('🧹 Removing visual indicators...');
        this.visualIndicators.clearAllIndicators();

        console.log('✅ Extension disabled - all filters removed');
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.ContentScriptManager = ContentScriptManager;
}