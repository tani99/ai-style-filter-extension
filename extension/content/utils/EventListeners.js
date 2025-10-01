/**
 * EventListeners manages all event handling for the content script including
 * Chrome extension messages, navigation detection, and lazy loading detection
 */
export class EventListeners {
    constructor(contentScriptManager) {
        this.contentScript = contentScriptManager;
    }

    /**
     * Set up Chrome extension message listeners
     */
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('Content script received message:', request);

            switch (request.action) {
                case 'filterProducts':
                    console.log('Received filter products request');
                    sendResponse({
                        status: 'ready',
                        site: this.contentScript.currentSite?.name,
                        pageType: this.contentScript.pageType
                    });
                    break;

                case 'getPageInfo':
                    sendResponse({
                        host: this.contentScript.currentHost,
                        site: this.contentScript.currentSite,
                        pageType: this.contentScript.pageType,
                        url: this.contentScript.currentUrl
                    });
                    break;

                case 'detectProducts':
                    this.contentScript.detectProductImages().then(() => {
                        sendResponse({
                            status: 'detection_complete',
                            results: this.contentScript.getDetectionStats()
                        });
                    });
                    return true; // Keep message channel open for async response

                case 'getDetectionStats':
                    sendResponse({
                        status: 'success',
                        stats: this.contentScript.getDetectionStats()
                    });
                    break;

                case 'enableDebugMode':
                    this.contentScript.enableDebugMode();
                    sendResponse({status: 'debug_enabled'});
                    break;

                case 'clearDetection':
                    this.contentScript.clearProductDetection();
                    sendResponse({status: 'detection_cleared'});
                    break;

                case 'debugPageStructure':
                    const debugInfo = this.contentScript.debugPageStructure();
                    sendResponse({status: 'debug_complete', data: debugInfo});
                    break;

                case 'analyzeProducts':
                    if (this.contentScript.detectedProducts && this.contentScript.detectedProducts.length > 0) {
                        const productElements = this.contentScript.detectedProducts.map(item => item.element);
                        this.contentScript.analyzeMultipleProducts(productElements).then(results => {
                            sendResponse({
                                status: 'analysis_complete',
                                results: results,
                                stats: this.contentScript.analysisStats
                            });
                        });
                        return true; // Keep message channel open for async response
                    } else {
                        sendResponse({
                            status: 'no_products',
                            message: 'No detected products to analyze'
                        });
                    }
                    break;

                case 'getAnalysisStats':
                    sendResponse({
                        status: 'success',
                        stats: this.contentScript.analysisStats,
                        cacheSize: this.contentScript.analysisCache?.size || 0,
                        profileLoaded: !!this.contentScript.userStyleProfile
                    });
                    break;

                case 'clearAnalysisCache':
                    this.contentScript.clearAnalysisCache();
                    sendResponse({status: 'cache_cleared'});
                    break;

                case 'reloadStyleProfile':
                    this.contentScript.loadUserStyleProfile().then(() => {
                        sendResponse({
                            status: 'profile_reloaded',
                            hasProfile: !!this.contentScript.userStyleProfile
                        });
                    });
                    return true; // Keep message channel open for async response

                case 'debugAnalysisQueue':
                    const queueInfo = this.contentScript.debugAnalysisQueue();
                    sendResponse({
                        status: 'debug_complete',
                        queueInfo: queueInfo
                    });
                    break;

                case 'resetAnalysisState':
                    this.contentScript.resetAnalysisState();
                    sendResponse({status: 'state_reset'});
                    break;

                case 'enableViewportAnalysis':
                    this.contentScript.enableViewportAnalysis();
                    sendResponse({status: 'viewport_analysis_enabled'});
                    break;

                case 'disableViewportAnalysis':
                    this.contentScript.disableViewportAnalysis();
                    sendResponse({status: 'viewport_analysis_disabled'});
                    break;

                case 'debugCache':
                    const cacheInfo = this.contentScript.debugCache();
                    sendResponse({
                        status: 'debug_complete',
                        cacheInfo: cacheInfo
                    });
                    break;

                case 'getCacheStatusForImage':
                    if (request.imageSrc) {
                        const img = document.querySelector(`img[src="${request.imageSrc}"]`);
                        if (img) {
                            const status = this.contentScript.getCacheStatusForImage(img);
                            sendResponse({
                                status: 'cache_status_complete',
                                imageStatus: status
                            });
                        } else {
                            sendResponse({
                                status: 'image_not_found',
                                message: 'Image with specified src not found'
                            });
                        }
                    } else {
                        sendResponse({
                            status: 'missing_parameter',
                            message: 'imageSrc parameter required'
                        });
                    }
                    break;

                case 'updateFilterState':
                    // Handle filter state updates from popup
                    if (request.filterState) {
                        console.log('📩 Received filter state from popup:', request.filterState);
                        this.contentScript.filterStateManager.updateFilterState(request.filterState);
                        sendResponse({status: 'filter_state_updated'});
                    } else {
                        sendResponse({
                            status: 'missing_parameter',
                            message: 'filterState parameter required'
                        });
                    }
                    break;

                default:
                    sendResponse({status: 'unknown_action'});
            }
        });
    }

    /**
     * Set up navigation detection for SPA (Single Page Applications)
     */
    setupNavigationListener() {
        // Handle SPA navigation for dynamic content loading
        let lastUrl = this.contentScript.currentUrl;

        // Use MutationObserver to detect URL changes
        const observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                this.contentScript.currentUrl = lastUrl;

                console.log('🔄 Navigation detected, reinitializing...', lastUrl);

                // Update page type detection
                this.contentScript.pageType = this.contentScript.pageTypeDetector.detectPageType();

                // Clear and reinitialize for new page
                this.contentScript.clearProductDetection();
                this.contentScript.initializeForPageType();

                // Re-run product detection after navigation
                setTimeout(async () => {
                    await this.contentScript.detectProductImages();
                }, 2000);

                // Notify background script
                this.contentScript.notifyBackgroundScript();
            }
        });

        // Start observing
        observer.observe(document, {
            childList: true,
            subtree: true
        });

        // Also listen for popstate events (back/forward navigation)
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                if (window.location.href !== lastUrl) {
                    lastUrl = window.location.href;
                    this.contentScript.currentUrl = lastUrl;

                    console.log('🔄 Popstate navigation detected, reinitializing...', lastUrl);

                    this.contentScript.pageType = this.contentScript.pageTypeDetector.detectPageType();
                    this.contentScript.clearProductDetection();
                    this.contentScript.initializeForPageType();

                    // Re-run product detection after popstate navigation
                    setTimeout(async () => {
                        await this.contentScript.detectProductImages();
                    }, 2000);

                    this.contentScript.notifyBackgroundScript();
                }
            }, 100);
        });
    }

    /**
     * Set up detection for lazy-loaded images and dynamic content
     */
    setupLazyLoadingDetection() {
        // Observe for new images being added to the DOM (lazy loading)
        const imageObserver = new MutationObserver((mutations) => {
            let hasNewImages = false;

            mutations.forEach((mutation) => {
                // Check for new img elements
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'IMG') {
                            hasNewImages = true;
                        } else if (node.querySelectorAll) {
                            const images = node.querySelectorAll('img');
                            if (images.length > 0) {
                                hasNewImages = true;
                            }
                        }
                    }
                });

                // Check for src attribute changes (lazy loading)
                if (mutation.type === 'attributes' &&
                    mutation.attributeName === 'src' &&
                    mutation.target.tagName === 'IMG') {
                    hasNewImages = true;
                }
            });

            // Re-run detection if new images found
            if (hasNewImages) {
                console.log('🖼️ New images detected, checking for new products...');
                setTimeout(async () => {
                    await this.contentScript.detectNewImages();
                }, 500);
            }
        });

        // Start observing
        imageObserver.observe(document, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'data-src']
        });

        // Also set up intersection observer for scroll-triggered detection
        if ('IntersectionObserver' in window) {
            const scrollObserver = new IntersectionObserver((entries) => {
                const hasNewVisibleImages = entries.some(entry =>
                    entry.isIntersecting &&
                    entry.target.tagName === 'IMG' &&
                    !entry.target.dataset.aiStyleDetected
                );

                if (hasNewVisibleImages) {
                    console.log('👁️ New images scrolled into view, checking for products...');
                    setTimeout(async () => {
                        await this.contentScript.detectNewImages();
                    }, 1000);
                }
            });

            // Observe all images
            setTimeout(() => {
                const allImages = document.querySelectorAll('img');
                allImages.forEach(img => {
                    scrollObserver.observe(img);
                });
            }, 2000);
        }
    }

    /**
     * Initialize all event listeners
     */
    initializeAll() {
        this.setupMessageListeners();
        this.setupNavigationListener();
        this.setupLazyLoadingDetection();
    }
}
// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.EventListeners = EventListeners;
}
