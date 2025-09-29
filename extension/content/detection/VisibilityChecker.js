/**
 * VisibilityChecker handles image visibility validation and quality checks
 * to filter out hidden, low-quality, or inappropriate images
 */
export class VisibilityChecker {
    constructor() {}

    /**
     * Check the quality and dimensions of an image
     * @param {HTMLImageElement} img - The image element to check
     * @returns {Object} Quality check result with isValid flag and reason
     */
    checkImageQuality(img) {
        const rect = img.getBoundingClientRect();
        const naturalWidth = img.naturalWidth || 0;
        const naturalHeight = img.naturalHeight || 0;
        const displayWidth = rect.width;
        const displayHeight = rect.height;

        // Minimum size requirements
        const minDisplaySize = 50;
        const minNaturalSize = 100;
        const maxDisplaySize = 2000;

        // Check if image is too small
        if (displayWidth < minDisplaySize || displayHeight < minDisplaySize) {
            return {
                isValid: false,
                reason: `Too small (${Math.round(displayWidth)}x${Math.round(displayHeight)})`
            };
        }

        // Check if image is unreasonably large (likely banner/hero)
        if (displayWidth > maxDisplaySize || displayHeight > maxDisplaySize) {
            return {
                isValid: false,
                reason: `Too large (${Math.round(displayWidth)}x${Math.round(displayHeight)})`
            };
        }

        // Check natural dimensions if available
        if (naturalWidth > 0 && naturalHeight > 0) {
            if (naturalWidth < minNaturalSize || naturalHeight < minNaturalSize) {
                return {
                    isValid: false,
                    reason: `Natural size too small (${naturalWidth}x${naturalHeight})`
                };
            }
        }

        // Check aspect ratio (clothing images are typically portrait or square)
        const aspectRatio = displayWidth / displayHeight;
        if (aspectRatio > 3 || aspectRatio < 0.3) {
            return {
                isValid: false,
                reason: `Invalid aspect ratio (${aspectRatio.toFixed(2)})`
            };
        }

        // Check if image is visible (basic check)
        if (rect.width === 0 || rect.height === 0) {
            return {
                isValid: false,
                reason: 'Not visible (zero dimensions)'
            };
        }

        return {
            isValid: true,
            dimensions: {
                display: { width: displayWidth, height: displayHeight },
                natural: { width: naturalWidth, height: naturalHeight },
                aspectRatio: aspectRatio
            }
        };
    }

    /**
     * Comprehensive image visibility check including viewport, CSS, and parent clipping
     * @param {HTMLImageElement} img - The image element to check
     * @returns {Object} Visibility result with isVisible flag, reason, and debug info
     */
    isImageVisible(img) {
        const rect = img.getBoundingClientRect();
        const style = window.getComputedStyle(img);

        // Check basic CSS visibility
        if (style.display === 'none') {
            return { isVisible: false, reason: 'display: none' };
        }

        if (style.visibility === 'hidden') {
            return { isVisible: false, reason: 'visibility: hidden' };
        }

        if (parseFloat(style.opacity) === 0) {
            return { isVisible: false, reason: 'opacity: 0' };
        }

        // Check if image is outside the viewport
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        if (rect.right <= 0 || rect.left >= viewportWidth ||
            rect.bottom <= 0 || rect.top >= viewportHeight) {

            // Add detailed debugging for viewport rejection
            const debugInfo = {
                imageRect: {
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height
                },
                viewport: {
                    width: viewportWidth,
                    height: viewportHeight
                },
                checks: {
                    rightLeqZero: rect.right <= 0,
                    leftGeqViewportWidth: rect.left >= viewportWidth,
                    bottomLeqZero: rect.bottom <= 0,
                    topGeqViewportHeight: rect.top >= viewportHeight
                }
            };

            console.log('🐛 VIEWPORT DEBUG - Image rejected as outside viewport:', debugInfo);
            console.log('🐛 Image src:', img.src);
            console.log('🐛 Image alt:', img.alt);

            return {
                isVisible: false,
                reason: 'outside viewport',
                debugInfo: debugInfo
            };
        }

        // Check if image is clipped by parent containers (common in carousels)
        let parent = img.parentElement;
        let depth = 0;

        while (parent && depth < 5) {
            const parentRect = parent.getBoundingClientRect();
            const parentStyle = window.getComputedStyle(parent);

            // Check if parent has overflow hidden and image is outside its bounds
            if (parentStyle.overflow === 'hidden' || parentStyle.overflowX === 'hidden') {
                // Check if image is clipped horizontally (common in image carousels)
                if (rect.left >= parentRect.right || rect.right <= parentRect.left) {
                    return { isVisible: false, reason: 'clipped by parent container' };
                }

                // For carousel detection, check if image is significantly outside parent bounds
                const imageCenter = rect.left + rect.width / 2;
                const parentCenter = parentRect.left + parentRect.width / 2;
                const maxDistance = parentRect.width * 0.6; // Allow some tolerance

                if (Math.abs(imageCenter - parentCenter) > maxDistance) {
                    return { isVisible: false, reason: 'carousel image not active' };
                }
            }

            if (parentStyle.overflow === 'hidden' || parentStyle.overflowY === 'hidden') {
                // Check if image is clipped vertically
                if (rect.top >= parentRect.bottom || rect.bottom <= parentRect.top) {
                    return { isVisible: false, reason: 'clipped by parent container' };
                }
            }

            parent = parent.parentElement;
            depth++;
        }

        // Check intersection with viewport (more precise than basic bounds check)
        const viewportIntersection = {
            left: Math.max(rect.left, 0),
            top: Math.max(rect.top, 0),
            right: Math.min(rect.right, viewportWidth),
            bottom: Math.min(rect.bottom, viewportHeight)
        };

        const intersectionWidth = Math.max(0, viewportIntersection.right - viewportIntersection.left);
        const intersectionHeight = Math.max(0, viewportIntersection.bottom - viewportIntersection.top);
        const intersectionArea = intersectionWidth * intersectionHeight;
        const imageArea = rect.width * rect.height;

        // Require at least 25% of the image to be visible (lowered from 50% for sites like H&M)
        const visibilityRatio = imageArea > 0 ? intersectionArea / imageArea : 0;
        if (visibilityRatio < 0.25) {
            // Add detailed debugging for visibility rejection
            const debugInfo = {
                imageRect: {
                    left: Math.round(rect.left),
                    right: Math.round(rect.right),
                    top: Math.round(rect.top),
                    bottom: Math.round(rect.bottom),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                },
                viewport: {
                    width: viewportWidth,
                    height: viewportHeight
                },
                intersection: {
                    left: Math.round(viewportIntersection.left),
                    right: Math.round(viewportIntersection.right),
                    top: Math.round(viewportIntersection.top),
                    bottom: Math.round(viewportIntersection.bottom),
                    width: Math.round(intersectionWidth),
                    height: Math.round(intersectionHeight)
                },
                areas: {
                    imageArea: Math.round(imageArea),
                    intersectionArea: Math.round(intersectionArea),
                    visibilityRatio: Math.round(visibilityRatio * 100) / 100
                }
            };

            console.log('🐛 VISIBILITY DEBUG - Image rejected for low visibility:', debugInfo);
            console.log('🐛 Image src:', img.src);
            console.log('🐛 Image alt:', img.alt);

            return {
                isVisible: false,
                reason: `only ${Math.round(visibilityRatio * 100)}% visible (need 25%+)`,
                debugInfo: debugInfo
            };
        }

        return {
            isVisible: true,
            reason: `${Math.round(visibilityRatio * 100)}% visible`,
            visibilityRatio: visibilityRatio
        };
    }

    /**
     * Debug method to analyze a specific image's visibility in detail
     * @param {HTMLImageElement} img - The image element to debug
     * @returns {Object} Visibility analysis result
     */
    debugImageVisibility(img) {
        console.log('🔍 DETAILED IMAGE VISIBILITY DEBUG');
        console.log('📸 Image:', img);
        console.log('🔗 Src:', img.src);
        console.log('📝 Alt:', img.alt);
        console.log('🏷️ Class:', img.className);

        const rect = img.getBoundingClientRect();
        const style = window.getComputedStyle(img);
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        console.log('📐 Bounding Rect:', {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        });

        console.log('🖥️ Viewport:', {
            width: viewportWidth,
            height: viewportHeight
        });

        console.log('🎨 Computed Style:', {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            position: style.position,
            transform: style.transform
        });

        // Check each visibility condition
        console.log('✅ Visibility Checks:');
        console.log('  Display !== none:', style.display !== 'none');
        console.log('  Visibility !== hidden:', style.visibility !== 'hidden');
        console.log('  Opacity > 0:', parseFloat(style.opacity) > 0);
        console.log('  Right > 0:', rect.right > 0);
        console.log('  Left < viewport width:', rect.left < viewportWidth);
        console.log('  Bottom > 0:', rect.bottom > 0);
        console.log('  Top < viewport height:', rect.top < viewportHeight);

        // Check parent containers
        console.log('📦 Parent Container Analysis:');
        let parent = img.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
            const parentRect = parent.getBoundingClientRect();
            const parentStyle = window.getComputedStyle(parent);

            console.log(`  Level ${depth + 1}:`, {
                tagName: parent.tagName,
                className: parent.className,
                overflow: parentStyle.overflow,
                overflowX: parentStyle.overflowX,
                overflowY: parentStyle.overflowY,
                rect: {
                    left: parentRect.left,
                    right: parentRect.right,
                    top: parentRect.top,
                    bottom: parentRect.bottom
                }
            });

            parent = parent.parentElement;
            depth++;
        }

        // Run actual visibility check
        const result = this.isImageVisible(img);
        console.log('🎯 Final Result:', result);

        return result;
    }

    /**
     * Debug method to analyze visibility issues across multiple images
     * @param {Function} findCandidateImages - Function to find candidate images
     * @returns {Object} Comprehensive visibility analysis report
     */
    debugVisibilityIssues(findCandidateImages) {
        console.log('🐛 === VISIBILITY DEBUG ANALYSIS ===');

        const candidates = findCandidateImages();
        console.log(`📸 Found ${candidates.length} candidate images total`);

        const visibilityResults = {
            passed: [],
            failed: []
        };

        candidates.forEach((img, index) => {
            const result = this.isImageVisible(img);
            const imageInfo = {
                index: index + 1,
                src: img.src?.substring(0, 100) + '...' || 'no src',
                alt: img.alt || 'no alt',
                width: Math.round(img.getBoundingClientRect().width),
                height: Math.round(img.getBoundingClientRect().height),
                result: result
            };

            if (result.isVisible) {
                visibilityResults.passed.push(imageInfo);
            } else {
                visibilityResults.failed.push(imageInfo);
            }

            console.log(`Image ${index + 1}: ${result.isVisible ? '✅' : '❌'} ${result.reason}`);
            console.log(`  📐 Size: ${imageInfo.width}x${imageInfo.height}`);
            console.log(`  🔗 Src: ${imageInfo.src}`);
            if (result.debugInfo) {
                console.log(`  🐛 Debug:`, result.debugInfo);
            }
        });

        console.log(`\n📊 SUMMARY:`);
        console.log(`✅ Passed visibility check: ${visibilityResults.passed.length}`);
        console.log(`❌ Failed visibility check: ${visibilityResults.failed.length}`);

        // Show common failure reasons
        const failureReasons = {};
        visibilityResults.failed.forEach(item => {
            const reason = item.result.reason;
            failureReasons[reason] = (failureReasons[reason] || 0) + 1;
        });

        console.log(`\n🔍 Failure reasons:`);
        Object.entries(failureReasons).forEach(([reason, count]) => {
            console.log(`  ${reason}: ${count} images`);
        });

        console.log('🐛 === END VISIBILITY DEBUG ===\n');

        return {
            total: candidates.length,
            passed: visibilityResults.passed.length,
            failed: visibilityResults.failed.length,
            failureReasons: failureReasons,
            details: visibilityResults
        };
    }
}