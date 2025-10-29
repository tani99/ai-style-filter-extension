import { GeometryUtils } from '../utils/GeometryUtils.js';

/**
 * TryOnOverlays manages virtual try-on related visual indicators and overlays
 * Handles eye icons, try-on generation, caching, and result displays
 */
export class TryOnOverlays {
    constructor(overlayMap, updateHandlers) {
        this.overlayMap = overlayMap;
        this.updateHandlers = updateHandlers;
    }

    /**
     * Create eye icon overlay for virtual try-on
     * @returns {HTMLElement} Eye icon element
     */
    createEyeIconOverlay() {
        const eyeIcon = document.createElement('div');
        eyeIcon.className = 'ai-style-eye-icon';
        eyeIcon.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5C7 5 2.73 8.11 1 12.5C2.73 16.89 7 20 12 20C17 20 21.27 16.89 23 12.5C21.27 8.11 17 5 12 5ZM12 17.5C9.24 17.5 7 15.26 7 12.5C7 9.74 9.24 7.5 12 7.5C14.76 7.5 17 9.74 17 12.5C17 15.26 14.76 17.5 12 17.5ZM12 9.5C10.34 9.5 9 10.84 9 12.5C9 14.16 10.34 15.5 12 15.5C13.66 15.5 15 14.16 15 12.5C15 10.84 13.66 9.5 12 9.5Z" fill="white"/>
            </svg>
        `;
        eyeIcon.style.cssText = `
            position: absolute;
            width: 40px;
            height: 40px;
            background: rgba(16, 185, 129, 0.9);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10000;
            pointer-events: auto;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease;
            opacity: 0;
        `;
        eyeIcon.dataset.aiStyleEyeIcon = 'true';
        eyeIcon.title = 'Click to generate virtual try-on';

        // Hover effects for animation
        eyeIcon.addEventListener('mouseenter', () => {
            eyeIcon.style.transform = 'scale(1.1)';
            eyeIcon.style.background = 'rgba(16, 185, 129, 1)';
        });

        eyeIcon.addEventListener('mouseleave', () => {
            eyeIcon.style.transform = 'scale(1)';
            eyeIcon.style.background = 'rgba(16, 185, 129, 0.9)';
        });

        return eyeIcon;
    }

    /**
     * Attach virtual try-on handler to eye icon
     * @param {HTMLElement} eyeIcon - Eye icon element
     * @param {HTMLImageElement} img - Product image element
     * @param {number} index - Image index
     */
    attachTryonHandler(eyeIcon, img, index) {
        let tryonResult = null;
        let hoverTimeout = null;

        eyeIcon.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log(`👁️ Eye icon clicked for image ${index + 1}`);

            // If already showing result, hide it and revert icon
            if (tryonResult) {
                this.hideTryonResult(tryonResult);
                tryonResult = null;

                // Revert icon back to cached or default state based on cache availability
                const hasCachedData = eyeIcon.dataset.tryonCached === 'true';
                this.updateEyeIconState(eyeIcon, hasCachedData ? 'cached' : 'default');
                return;
            }

            // Show loading state in the icon itself
            this.updateEyeIconState(eyeIcon, 'loading');

            // Generate or retrieve cached try-on
            tryonResult = await this.handleVirtualTryOn(img, index, eyeIcon);

            // Change icon to close (×) when try-on is visible
            if (tryonResult) {
                this.updateEyeIconState(eyeIcon, 'close');

                // Set up auto-close after 5 seconds
                const autoCloseTimeout = setTimeout(() => {
                    if (tryonResult && tryonResult.parentNode) {
                        this.hideTryonResult(tryonResult);
                        tryonResult = null;

                        // Revert icon back to cached or default state based on cache availability
                        const hasCachedData = eyeIcon.dataset.tryonCached === 'true';
                        this.updateEyeIconState(eyeIcon, hasCachedData ? 'cached' : 'default');
                    }
                }, 5000);

                // Store timeout so it can be cleared if manually closed
                tryonResult.dataset.autoCloseTimeout = autoCloseTimeout;
            } else {
                // If no result (error), revert to appropriate state
                const hasCachedData = eyeIcon.dataset.tryonCached === 'true';
                this.updateEyeIconState(eyeIcon, hasCachedData ? 'cached' : 'default');
            }
        });
    }

    /**
     * Handle virtual try-on generation with DOM-based caching
     * @param {HTMLImageElement} img - Product image element
     * @param {number} index - Image index
     * @param {HTMLElement} eyeIcon - Eye icon element for caching
     * @returns {Promise<HTMLElement>} Try-on result element
     */
    async handleVirtualTryOn(img, index, eyeIcon) {
        console.log(`🎨 Handling virtual try-on for image ${index + 1}`);

        // Check for cached try-on data in DOM
        const cachedData = this.getCachedTryonData(eyeIcon);

        if (cachedData) {
            console.log('📦 Using cached try-on data');
            // Create and display result overlay from cache
            const resultOverlay = this.createTryonResultOverlay(img, cachedData.imageUrl, true);
            document.body.appendChild(resultOverlay);
            return resultOverlay;
        }

        console.log('🔄 No valid cache found, generating new try-on');

        // Create loading overlay
        const loadingOverlay = this.createTryonLoadingOverlay(img);
        document.body.appendChild(loadingOverlay);

        try {
            // Get the try-on photo from storage
            const result = await chrome.storage.local.get(['tryonPhoto']);

            if (!result.tryonPhoto) {
                throw new Error('No try-on photo uploaded. Please upload a try-on photo in the extension settings.');
            }

            // Find the current image element by alt text (same pattern as background task)
            // This ensures we get the latest src from the live DOM element
            const altText = eyeIcon.dataset.imageAltText;
            let currentElement = null;
            let imageSrc = img.src; // Fallback to original img.src

            if (altText && altText !== '(no alt text)') {
                // Find the image by alt text (safer than querySelector with special characters)
                const allImages = document.querySelectorAll('img');
                currentElement = Array.from(allImages).find(img => img.alt === altText);

                if (currentElement) {
                    imageSrc = currentElement.src;
                    console.log(`📥 Found current image by alt text "${altText}":`, imageSrc);
                } else {
                    console.log(`⚠️ Could not find image with alt text "${altText}", using original img.src`);
                }
            } else {
                console.log('⚠️ No alt text available, using original img.src');
            }

            // Validate that the image src is a valid HTTP/HTTPS URL
            if (!imageSrc || !imageSrc.startsWith('http')) {
                throw new Error('IMAGE_LOADING|The image is still loading. Please wait a few seconds and try again.');
            }

            // Convert the clothing image URL to base64
            console.log('📥 Fetching clothing image from:', imageSrc);
            const clothingImageBase64 = await this.convertImageToBase64(imageSrc);
            console.log('✅ Clothing image converted to base64');

            // Send message to background script to generate try-on
            const response = await chrome.runtime.sendMessage({
                action: 'generateTryOn',
                userPhoto: result.tryonPhoto,
                clothingImage: clothingImageBase64,
                options: {
                    temperature: 0.7
                }
            });

            console.log('Try-on response:', response);

            if (response.success && response.imageUrl) {
                // Cache the result in DOM
                this.cacheTryonData(eyeIcon, response.imageUrl, response.imageBase64);

                // Create and display result overlay
                const resultOverlay = this.createTryonResultOverlay(img, response.imageUrl, false);
                document.body.appendChild(resultOverlay);

                // Remove loading overlay
                loadingOverlay.remove();

                return resultOverlay;
            } else {
                throw new Error(response.error || 'Failed to generate try-on');
            }

        } catch (error) {
            console.error('Virtual try-on error:', error);

            // Check if this is an IMAGE_LOADING error and show special retry message
            let errorMessage = error.message;
            let isRetryableError = false;

            if (error.message.startsWith('IMAGE_LOADING|')) {
                errorMessage = error.message.split('|')[1]; // Get the user-friendly message
                isRetryableError = true;
            }

            // Show error overlay
            const errorOverlay = this.createTryonErrorOverlay(img, errorMessage, isRetryableError);
            document.body.appendChild(errorOverlay);

            // Remove loading overlay
            loadingOverlay.remove();

            return errorOverlay;
        }
    }

    /**
     * Get cached try-on data from eye icon DOM attributes
     * @param {HTMLElement} eyeIcon - Eye icon element
     * @returns {Object|null} Cached data object or null if no valid cache
     */
    getCachedTryonData(eyeIcon) {
        const cached = eyeIcon.dataset.tryonCached;
        const timestamp = eyeIcon.dataset.tryonTimestamp;
        const imageUrl = eyeIcon.dataset.tryonImageUrl;
        const imageData = eyeIcon.dataset.tryonImageData;

        // Check if cache exists
        if (cached !== 'true' || !timestamp || !imageUrl) {
            return null;
        }

        // Check cache age (24 hours)
        const cacheAge = Date.now() - parseInt(timestamp);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (cacheAge >= maxAge) {
            console.log('🕒 Try-on cache expired, clearing');
            this.clearCachedTryonData(eyeIcon);
            return null;
        }

        return {
            imageUrl,
            imageData,
            timestamp: parseInt(timestamp)
        };
    }

    /**
     * Cache try-on data in eye icon DOM attributes
     * @param {HTMLElement} eyeIcon - Eye icon element
     * @param {string} imageUrl - Generated try-on image data URL
     * @param {string} imageData - Base64 image data
     */
    cacheTryonData(eyeIcon, imageUrl, imageData) {
        eyeIcon.dataset.tryonCached = 'true';
        eyeIcon.dataset.tryonImageUrl = imageUrl;
        eyeIcon.dataset.tryonImageData = imageData || '';
        eyeIcon.dataset.tryonTimestamp = Date.now().toString();

        console.log('💾 Try-on data cached in DOM');

        // Update icon visual state to show it's cached (sparkles)
        this.updateEyeIconState(eyeIcon, 'cached');
    }

    /**
     * Clear cached try-on data from eye icon
     * @param {HTMLElement} eyeIcon - Eye icon element
     */
    clearCachedTryonData(eyeIcon) {
        delete eyeIcon.dataset.tryonCached;
        delete eyeIcon.dataset.tryonImageUrl;
        delete eyeIcon.dataset.tryonImageData;
        delete eyeIcon.dataset.tryonTimestamp;

        // Revert icon to default state
        this.updateEyeIconState(eyeIcon, 'default');
    }

    /**
     * Update eye icon visual state
     * @param {HTMLElement} eyeIcon - Eye icon element
     * @param {string} state - State: 'default', 'cached', 'loading', 'close', 'error'
     */
    updateEyeIconState(eyeIcon, state) {
        switch (state) {
            case 'cached':
                eyeIcon.style.background = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
                eyeIcon.style.boxShadow = '0 2px 8px rgba(251, 191, 36, 0.5), 0 0 15px rgba(251, 191, 36, 0.3)';
                eyeIcon.title = 'Click to view cached virtual try-on';
                break;
            case 'loading':
                eyeIcon.style.background = 'rgba(59, 130, 246, 0.9)';
                eyeIcon.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.5)';
                eyeIcon.title = 'Generating virtual try-on...';
                this.ensureSpinnerAnimation();
                break;
            case 'close':
                eyeIcon.style.background = 'rgba(239, 68, 68, 0.9)';
                eyeIcon.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.5)';
                eyeIcon.title = 'Click to close virtual try-on';
                break;
            case 'error':
                eyeIcon.style.background = 'rgba(239, 68, 68, 0.9)';
                eyeIcon.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.5)';
                eyeIcon.title = 'Try-on generation failed';
                break;
            case 'default':
            default:
                eyeIcon.style.background = 'rgba(16, 185, 129, 0.9)';
                eyeIcon.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                eyeIcon.title = 'Click to generate virtual try-on';
                break;
        }
    }

    /**
     * Create loading overlay for try-on generation
     * @param {HTMLImageElement} img - Product image element
     * @returns {HTMLElement} Loading overlay element
     */
    createTryonLoadingOverlay(img) {
        const overlay = document.createElement('div');
        overlay.className = 'ai-style-tryon-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        overlay.innerHTML = `
            <div style="width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="color: #059669; font-weight: 600; font-size: 14px;">Generating try-on...</div>
        `;

        this.positionTryonOverlay(overlay, img);
        return overlay;
    }

    /**
     * Create result overlay for try-on
     * @param {HTMLImageElement} img - Product image element
     * @param {string} tryonImageUrl - Generated try-on image URL
     * @param {boolean} isCached - Whether result is from cache
     * @returns {HTMLElement} Result overlay element
     */
    createTryonResultOverlay(img, tryonImageUrl, isCached = false) {
        const overlay = document.createElement('div');
        overlay.className = 'ai-style-tryon-overlay';

        // Get the size of the original product image (same size, not scaled)
        const rect = img.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        overlay.style.cssText = `
            position: absolute;
            top: ${rect.top + scrollY}px;
            left: ${rect.left + scrollX}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        `;

        // Create try-on image with same dimensions as original
        const tryonImg = document.createElement('img');
        tryonImg.src = tryonImageUrl;
        tryonImg.alt = 'Virtual try-on result';
        tryonImg.setAttribute('data-ai-generated-tryon', 'true'); // Mark as AI-generated
        tryonImg.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 4px;
        `;

        // Add cache indicator if applicable
        if (isCached) {
            const cacheIndicator = document.createElement('div');
            cacheIndicator.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(251, 191, 36, 0.9);
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
            `;
            cacheIndicator.textContent = 'Cached';
            overlay.appendChild(cacheIndicator);
        }

        overlay.appendChild(tryonImg);
        return overlay;
    }

    /**
     * Create error overlay for try-on
     * @param {HTMLImageElement} img - Product image element
     * @param {string} errorMessage - Error message to display
     * @param {boolean} isRetryableError - Whether this error can be retried
     * @returns {HTMLElement} Error overlay element
     */
    createTryonErrorOverlay(img, errorMessage, isRetryableError = false) {
        const overlay = document.createElement('div');
        overlay.className = 'ai-style-tryon-overlay';

        // Use different background color for retryable errors (orange/warning vs red/error)
        const backgroundColor = isRetryableError ? 'rgba(249, 115, 22, 0.95)' : 'rgba(239, 68, 68, 0.9)';

        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${backgroundColor};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            padding: 20px;
        `;

        // Show different icon and title for retryable errors
        const icon = isRetryableError ? '⏳' : '⚠️';
        const title = isRetryableError ? 'Please Wait' : 'Try-on Failed';
        const retryHint = isRetryableError ? '<div style="font-size: 13px; opacity: 0.85; margin-top: 8px;">Click the eye icon again in a few seconds</div>' : '';

        overlay.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">${icon}</div>
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">${title}</div>
            <div style="font-size: 14px; opacity: 0.9;">${errorMessage}</div>
            ${retryHint}
        `;

        this.positionTryonOverlay(overlay, img);
        return overlay;
    }

    /**
     * Position try-on overlay relative to image
     * @param {HTMLElement} overlay - Overlay element
     * @param {HTMLImageElement} img - Image element
     */
    positionTryonOverlay(overlay, img) {
        const rect = img.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        overlay.style.top = `${rect.top + scrollY}px`;
        overlay.style.left = `${rect.left + scrollX}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
    }

    /**
     * Hide try-on result overlay
     * @param {HTMLElement} overlay - Overlay element to hide
     */
    hideTryonResult(overlay) {
        if (overlay && overlay.parentNode) {
            // Clear auto-close timeout if it exists
            if (overlay.dataset.autoCloseTimeout) {
                clearTimeout(parseInt(overlay.dataset.autoCloseTimeout));
            }
            overlay.remove();
        }
    }

    /**
     * Position eye icon relative to image
     * @param {HTMLElement} eyeIcon - Eye icon element
     * @param {HTMLImageElement} img - Image element
     */
    positionEyeIcon(eyeIcon, img) {
        // Position at bottom-right corner, slightly outside the image
        GeometryUtils.positionElementRelativeToImage(
            eyeIcon,
            img,
            'bottom-right',
            { x: 45, y: 5 }
        );

        // Fade in animation
        setTimeout(() => {
            eyeIcon.style.opacity = '1';
        }, 100);
    }

    /**
     * Ensure spinner animation CSS is available
     */
    ensureSpinnerAnimation() {
        if (document.getElementById('spinner-animation-styles')) return;

        const style = document.createElement('style');
        style.id = 'spinner-animation-styles';
        style.textContent = `
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes eyeIconHover {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Convert image URL to base64
     * @param {string} imageUrl - Image URL to convert
     * @returns {Promise<string>} Base64 encoded image data
     */
    async convertImageToBase64(imageUrl) {
        try {
            console.log('🔄 Requesting background script to fetch image (bypasses CORS)');

            // Use background script to fetch image (bypasses CORS restrictions)
            const response = await chrome.runtime.sendMessage({
                action: 'fetchImageAsBase64',
                imageUrl: imageUrl
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to fetch image via background script');
            }

            console.log('✅ Image fetched successfully via background script');
            return response.dataUrl;

        } catch (error) {
            console.error('Error converting image to base64:', error);
            throw error;
        }
    }
}
