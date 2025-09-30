/**
 * GeometryUtils provides utility functions for positioning and layout calculations
 */
export class GeometryUtils {
    /**
     * Position an overlay element to exactly cover an image element
     * @param {HTMLElement} overlay - The overlay element to position
     * @param {HTMLImageElement} img - The image element to cover
     */
    static positionOverlay(overlay, img) {
        // Get the image's position and dimensions
        const rect = img.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Calculate absolute position
        const top = rect.top + scrollTop;
        const left = rect.left + scrollLeft;
        const width = rect.width;
        const height = rect.height;

        // Position the overlay to exactly cover the image
        overlay.style.position = 'absolute';
        overlay.style.top = `${top}px`;
        overlay.style.left = `${left}px`;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;

        // Remove the relative positioning properties that were causing issues
        overlay.style.removeProperty('right');
        overlay.style.removeProperty('bottom');
    }

    /**
     * Position a score badge in the top-right corner of an image
     * @param {HTMLElement} badge - The badge element to position
     * @param {HTMLImageElement} img - The image element to position relative to
     */
    static positionScoreBadge(badge, img) {
        // Get the image's position and dimensions
        const rect = img.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Calculate absolute position for top-right corner of image (smaller badge)
        const top = rect.top + scrollTop + 5; // 5px margin from top
        const left = rect.left + scrollLeft + rect.width - 25; // Position from right edge (smaller offset for 20px badge)

        // Position the badge
        badge.style.position = 'absolute';
        badge.style.top = `${top}px`;
        badge.style.left = `${left}px`;
    }

    /**
     * Get scroll position values
     * @returns {Object} Object containing scrollTop and scrollLeft values
     */
    static getScrollPosition() {
        return {
            scrollTop: window.pageYOffset || document.documentElement.scrollTop,
            scrollLeft: window.pageXOffset || document.documentElement.scrollLeft
        };
    }

    /**
     * Get viewport dimensions
     * @returns {Object} Object containing viewport width and height
     */
    static getViewportDimensions() {
        return {
            width: window.innerWidth || document.documentElement.clientWidth,
            height: window.innerHeight || document.documentElement.clientHeight
        };
    }

    /**
     * Calculate absolute position from element's bounding rect
     * @param {HTMLElement} element - The element to calculate position for
     * @returns {Object} Object containing top, left, width, height in absolute coordinates
     */
    static getAbsolutePosition(element) {
        const rect = element.getBoundingClientRect();
        const scroll = GeometryUtils.getScrollPosition();

        return {
            top: rect.top + scroll.scrollTop,
            left: rect.left + scroll.scrollLeft,
            width: rect.width,
            height: rect.height,
            bottom: rect.bottom + scroll.scrollTop,
            right: rect.right + scroll.scrollLeft
        };
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.GeometryUtils = GeometryUtils;
}
