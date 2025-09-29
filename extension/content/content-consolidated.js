// Content script for AI Style-Based Shopping Filter + Virtual Try-On
console.log('AI Style Filter content script loaded');

// Site Configurations
const SUPPORTED_SITES = {
    'zara.com': {
        name: 'Zara',
        productPagePatterns: ['/product/', '/p/', '/item/'],
        categoryPagePatterns: ['/category/', '/c/', '/shop/'],
        isClothingSite: true,
        selectors: {
            productImages: [
                '.media-image img',
                '.product-media img',
                '.product__media img',
                '.product-image img',
                '.media img',
                '.product-detail__media img'
            ],
            productCards: [
                '.product-item',
                '.product-card',
                '.product',
                '.product-grid-product',
                'article[data-productid]'
            ],
            productLinks: [
                'a[href*="/product/"]',
                'a[href*="/p/"]',
                'a[href*="/item/"]'
            ]
        }
    },
    'hm.com': {
        name: 'H&M',
        productPagePatterns: ['/productpage.', '/product/', '/p/'],
        categoryPagePatterns: ['/ladies/', '/men/', '/kids/', '/home/', '/shop/'],
        isClothingSite: true,
        selectors: {
            productImages: [
                '.product-detail-main-image-container img',
                '.product-images img',
                '.pdp-image img',
                '.product-image img',
                '.image-container img'
            ],
            productCards: [
                '.product-item',
                '.hm-product-item',
                '.product-tile',
                '.product-card',
                'article.hm-product-item'
            ],
            productLinks: [
                'a[href*="/productpage"]',
                'a[href*="/product/"]',
                'a[href*="/p/"]'
            ]
        }
    },
    'nike.com': {
        name: 'Nike',
        productPagePatterns: ['/t/', '/product/', '/p/'],
        categoryPagePatterns: ['/w/', '/men/', '/women/', '/kids/', '/shop/'],
        isClothingSite: true,
        selectors: {
            productImages: [
                '.product-carousel img',
                '.carousel-slide img',
                '.product-image img',
                '.image-component img',
                '.media img'
            ],
            productCards: [
                '.product-card',
                '.product-tile',
                '.product-grid-item',
                '.product',
                '.grid-product-card'
            ],
            productLinks: [
                'a[href*="/t/"]',
                'a[href*="/product/"]',
                'a[href*="/p/"]'
            ]
        }
    }
};

// Main StyleFilter ContentScript Class
class StyleFilterContentScript {
    constructor() {
        this.currentHost = window.location.hostname;
        this.currentUrl = window.location.href;

        // Site detection
        this.currentSite = this.detectCurrentSite();
        this.pageType = this.detectPageType();

        // State tracking
        this.detectedProducts = [];
        this.processedImages = new Set();
        this.debugMode = false;
        this.lastDetectionResults = null;

        // Initialize if supported site
        if (this.currentSite) {
            this.initialize();
        } else {
            console.log('❌ Unsupported site:', this.currentHost);
        }
    }

    // Site Detection
    detectCurrentSite() {
        for (const [domain, config] of Object.entries(SUPPORTED_SITES)) {
            if (this.currentHost.includes(domain)) {
                return { domain, ...config };
            }
        }
        return null;
    }

    // Page Type Detection
    detectPageType() {
        if (!this.currentSite) return 'other';

        const url = this.currentUrl.toLowerCase();

        // Check for product pages
        for (const pattern of this.currentSite.productPagePatterns) {
            if (url.includes(pattern.toLowerCase())) {
                return 'product';
            }
        }

        // Check for category pages
        for (const pattern of this.currentSite.categoryPagePatterns) {
            if (url.includes(pattern.toLowerCase())) {
                return 'category';
            }
        }

        // Check for search pages
        if (url.includes('/search') || url.includes('?q=') || url.includes('&q=') || url.includes('/q/')) {
            return 'search';
        }

        return 'other';
    }

    // Initialize the extension
    initialize() {
        console.log(`✅ AI Style Filter initializing on ${this.currentSite.name}`);
        console.log(`📄 Page Type: ${this.pageType}`);

        // Set up message listeners for communication with popup/background
        this.setupMessageListeners();

        // Initialize based on page type with delays for content loading
        setTimeout(() => {
            this.initializeForPageType();
        }, 1500);
    }

    initializeForPageType() {
        switch (this.pageType) {
            case 'product':
                console.log('🛍️ Initializing for product page');
                setTimeout(() => this.detectProductImages(), 1000);
                break;
            case 'category':
            case 'search':
                console.log('📋 Initializing for listing page');
                setTimeout(() => this.detectProductImages(), 1500);
                break;
            default:
                console.log('🏠 Initializing for general page');
                setTimeout(() => this.detectProductImages(), 2000);
        }
    }

    // Message listeners for communication with extension components
    setupMessageListeners() {
        if (chrome?.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                try {
                    switch (request.action) {
                        case 'detectProducts':
                            this.detectProductImages().then(results => {
                                sendResponse({ success: true, results });
                            });
                            return true; // Will respond asynchronously

                        case 'clearDetection':
                            this.clearProductDetection();
                            sendResponse({ success: true });
                            break;

                        case 'enableDebugMode':
                            this.enableDebugMode();
                            sendResponse({ success: true });
                            break;

                        case 'getDetectionStats':
                            sendResponse({
                                success: true,
                                stats: this.getDetectionStats()
                            });
                            break;

                        default:
                            sendResponse({ success: false, error: 'Unknown action' });
                    }
                } catch (error) {
                    console.error('Message handler error:', error);
                    sendResponse({ success: false, error: error.message });
                }
            });
        }
    }

    // Main product detection method
    async detectProductImages() {
        if (!this.currentSite) {
            console.log('❌ No supported site detected');
            return { detectedImages: [], rejectedImages: [] };
        }

        console.log('🔍 Starting product image detection...');
        this.showLoadingAnimation();

        const detectedImages = [];
        const rejectedImages = [];

        try {
            // Find candidate images
            const candidateImages = this.findCandidateImages();

            if (candidateImages.length === 0) {
                console.log('⚠️ No candidate images found');
                this.hideLoadingAnimation();
                return { detectedImages, rejectedImages };
            }

            console.log(`📸 Processing ${candidateImages.length} candidate images...`);

            // Process images
            for (let i = 0; i < candidateImages.length; i++) {
                const img = candidateImages[i];
                const imageInfo = this.getImageInfo(img);

                // Quick exclusion check
                const quickCheck = this.quickExclusionCheck(img);
                if (!quickCheck.passed) {
                    rejectedImages.push({
                        element: img,
                        imageInfo,
                        reason: quickCheck.reason,
                        method: 'quick_exclusion',
                        confidence: 0.9
                    });
                    continue;
                }

                // Visibility check
                const visibilityCheck = this.isImageVisible(img);
                if (!visibilityCheck.isVisible) {
                    rejectedImages.push({
                        element: img,
                        imageInfo,
                        reason: visibilityCheck.reason,
                        method: 'visibility_check',
                        confidence: 0.9
                    });
                    continue;
                }

                // If it passes all checks, consider it detected
                detectedImages.push({
                    element: img,
                    imageInfo,
                    reason: 'Passed all validation checks',
                    method: 'validation_check',
                    confidence: 0.8
                });

                // Mark as detected
                img.dataset.aiStyleDetected = 'true';
                img.dataset.aiStyleIndex = detectedImages.length - 1;
            }

            // Add visual indicators
            this.addVisualIndicators(detectedImages, rejectedImages);

            // Log results
            this.logDetectionResults(detectedImages, rejectedImages);

            // Store results
            this.detectedProducts = detectedImages;
            this.lastDetectionResults = {
                detected: detectedImages.length,
                rejected: rejectedImages.length,
                timestamp: Date.now(),
                pageType: this.pageType,
                site: this.currentSite.name
            };

            this.hideLoadingAnimation();

            console.log(`✅ Detection complete: ${detectedImages.length} detected, ${rejectedImages.length} rejected`);

            return { detectedImages, rejectedImages };

        } catch (error) {
            console.error('Product detection failed:', error);
            this.hideLoadingAnimation();
            return { detectedImages: [], rejectedImages: [] };
        }
    }

    // Find candidate images using selectors
    findCandidateImages() {
        const candidates = new Set();

        // Strategy 1: Site-specific selectors
        if (this.currentSite.selectors?.productImages) {
            for (const selector of this.currentSite.selectors.productImages) {
                try {
                    const images = document.querySelectorAll(selector);
                    images.forEach(img => candidates.add(img));
                } catch (e) {
                    console.warn(`Invalid selector: ${selector}`);
                }
            }
        }

        // Strategy 2: Product cards
        if (this.currentSite.selectors?.productCards) {
            for (const selector of this.currentSite.selectors.productCards) {
                try {
                    const cards = document.querySelectorAll(selector);
                    cards.forEach(card => {
                        const images = card.querySelectorAll('img');
                        images.forEach(img => candidates.add(img));
                    });
                } catch (e) {
                    console.warn(`Invalid card selector: ${selector}`);
                }
            }
        }

        // Strategy 3: General fallback
        if (candidates.size < 5) {
            const generalSelectors = [
                'img[src*="product"]',
                'img[alt*="product"]',
                '.product img',
                '.item img'
            ];

            for (const selector of generalSelectors) {
                try {
                    const images = document.querySelectorAll(selector);
                    images.forEach(img => candidates.add(img));
                } catch (e) {
                    // Skip invalid selectors
                }
            }
        }

        return Array.from(candidates);
    }

    // Quick exclusion check
    quickExclusionCheck(img) {
        const src = (img.src || '').toLowerCase();
        const alt = (img.alt || '').toLowerCase();
        const className = (img.className || '').toLowerCase();

        const uiPatterns = ['logo', 'icon', 'sprite', 'arrow', 'close', 'menu', 'nav'];
        const srcAndClass = `${src} ${className}`;

        for (const pattern of uiPatterns) {
            if (srcAndClass.includes(pattern)) {
                return {
                    passed: false,
                    reason: `UI element detected: contains '${pattern}'`
                };
            }
        }

        // Check size
        const rect = img.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 30) {
            return {
                passed: false,
                reason: 'Too small - likely icon or thumbnail'
            };
        }

        return { passed: true };
    }

    // Image visibility check
    isImageVisible(img) {
        const rect = img.getBoundingClientRect();
        const style = window.getComputedStyle(img);

        if (style.display === 'none' || style.visibility === 'hidden') {
            return {
                isVisible: false,
                reason: 'Hidden by CSS'
            };
        }

        if (rect.width === 0 || rect.height === 0) {
            return {
                isVisible: false,
                reason: 'Zero dimensions'
            };
        }

        if (parseFloat(style.opacity) === 0) {
            return {
                isVisible: false,
                reason: 'Transparent (opacity: 0)'
            };
        }

        return { isVisible: true };
    }

    // Get image information
    getImageInfo(img) {
        const rect = img.getBoundingClientRect();
        const src = img.src || '';

        return {
            src: src,
            srcShort: src.split('/').pop() || src.slice(-30),
            alt: img.alt || '',
            className: img.className || '',
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            naturalWidth: img.naturalWidth || 0,
            naturalHeight: img.naturalHeight || 0
        };
    }

    // Add visual indicators
    addVisualIndicators(detectedImages, rejectedImages) {
        detectedImages.forEach((item, index) => {
            const img = item.element;

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'ai-style-detected-overlay';
            overlay.style.cssText = `
                position: absolute;
                pointer-events: none;
                border: 3px solid #10b981;
                border-radius: 6px;
                box-shadow: 0 0 15px rgba(16, 185, 129, 0.6);
                z-index: 10000;
            `;

            // Position overlay
            this.positionOverlay(overlay, img);

            // Add tooltip
            img.title = `AI Style Filter: Detected clothing image (${item.method})`;

            // Add to DOM
            document.body.appendChild(overlay);
            overlay.dataset.aiStyleOverlay = 'detected';
            overlay.dataset.aiStyleTargetIndex = index;

            // Update position on scroll/resize
            const updatePosition = () => this.positionOverlay(overlay, img);
            window.addEventListener('scroll', updatePosition);
            window.addEventListener('resize', updatePosition);
        });

        // Add red borders for rejected images in debug mode
        if (this.debugMode && rejectedImages.length > 0) {
            rejectedImages.forEach((item, index) => {
                const img = item.element;

                const overlay = document.createElement('div');
                overlay.className = 'ai-style-rejected-overlay';
                overlay.style.cssText = `
                    position: absolute;
                    pointer-events: none;
                    border: 2px solid #ef4444;
                    border-radius: 4px;
                    box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
                    z-index: 9999;
                `;

                this.positionOverlay(overlay, img);
                img.title = `AI Style Filter: Rejected (${item.method}) - ${item.reason}`;

                document.body.appendChild(overlay);
                overlay.dataset.aiStyleOverlay = 'rejected';

                const updatePosition = () => this.positionOverlay(overlay, img);
                window.addEventListener('scroll', updatePosition);
                window.addEventListener('resize', updatePosition);
            });
        }
    }

    // Position overlay on image
    positionOverlay(overlay, img) {
        const rect = img.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        overlay.style.position = 'absolute';
        overlay.style.top = (rect.top + scrollTop - 3) + 'px';
        overlay.style.left = (rect.left + scrollLeft - 3) + 'px';
        overlay.style.width = (rect.width + 6) + 'px';
        overlay.style.height = (rect.height + 6) + 'px';
    }

    // Show loading animation
    showLoadingAnimation(message = 'AI Stylist is analyzing products...') {
        this.hideLoadingAnimation();

        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'ai-style-loading-overlay';
        loadingOverlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 999999;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideInFade 0.3s ease-out;
        `;

        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s linear infinite;
        `;

        // Add keyframes
        if (!document.querySelector('#ai-style-keyframes')) {
            const style = document.createElement('style');
            style.id = 'ai-style-keyframes';
            style.textContent = `
                @keyframes slideInFade {
                    from { opacity: 0; transform: translateX(100px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        const messageElement = document.createElement('span');
        messageElement.textContent = message;

        loadingOverlay.appendChild(spinner);
        loadingOverlay.appendChild(messageElement);
        document.body.appendChild(loadingOverlay);
    }

    // Hide loading animation
    hideLoadingAnimation() {
        const overlay = document.getElementById('ai-style-loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // Log detection results
    logDetectionResults(detectedImages, rejectedImages) {
        console.log('📊 Product Detection Results:');
        console.log(`  ✅ Detected clothing images: ${detectedImages.length}`);
        console.log(`  ❌ Rejected images: ${rejectedImages.length}`);

        if (detectedImages.length > 0) {
            console.log('\n✅ DETECTED IMAGES:');
            detectedImages.slice(0, 10).forEach((item, index) => {
                const info = item.imageInfo;
                console.log(`  ${index + 1}. "${info.alt}" - ${info.srcShort} (${info.width}x${info.height})`);
            });
        }

        if (rejectedImages.length > 0 && this.debugMode) {
            console.log('\n❌ REJECTED IMAGES (first 5):');
            rejectedImages.slice(0, 5).forEach((item, index) => {
                const info = item.imageInfo;
                console.log(`  ${index + 1}. "${info.alt}" - ${item.reason}`);
            });
        }
    }

    // Clear all detection
    clearProductDetection() {
        const overlays = document.querySelectorAll('[data-ai-style-overlay]');
        overlays.forEach(overlay => overlay.remove());

        const detectedImages = document.querySelectorAll('[data-ai-style-detected]');
        detectedImages.forEach(img => {
            delete img.dataset.aiStyleDetected;
            delete img.dataset.aiStyleIndex;
            if (img.title && img.title.includes('AI Style Filter')) {
                img.title = '';
            }
        });

        this.detectedProducts = [];
        this.processedImages.clear();
        console.log('🧹 All product detection cleared');
    }

    // Enable debug mode
    enableDebugMode() {
        this.debugMode = true;
        console.log('🐛 Debug mode enabled - rejected images will be highlighted');
    }

    // Get detection statistics
    getDetectionStats() {
        return this.lastDetectionResults || {
            detected: 0,
            rejected: 0,
            timestamp: Date.now(),
            pageType: this.pageType,
            site: this.currentSite?.name || 'unknown'
        };
    }
}

// Initialize the extension
const styleFilter = new StyleFilterContentScript();

// Expose for debugging
window.styleFilter = styleFilter;