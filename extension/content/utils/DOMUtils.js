/**
 * DOMUtils provides utility functions for DOM manipulation and element analysis
 */
export class DOMUtils {
    /**
     * Generate a unique key for an image element based on src, alt, and className
     * @param {HTMLImageElement} img - The image element
     * @returns {string} Unique key string
     */
    static getImageKey(img) {
        return `${img.src || ''}|${img.alt || ''}|${img.className || ''}`;
    }

    /**
     * Check if an element is currently visible in the viewport
     * @param {HTMLElement} element - The element to check
     * @returns {boolean} True if element is in viewport
     */
    static isElementInViewport(element) {
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;

        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= windowHeight &&
            rect.right <= windowWidth &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    /**
     * Get class names from parent elements up to 5 levels deep
     * @param {HTMLElement} element - The element to get parent classes for
     * @returns {string} Space-separated string of parent class names
     */
    static getParentClasses(element) {
        const classes = [];
        let parent = element.parentElement;
        let depth = 0;

        while (parent && depth < 5) {
            if (parent.className) {
                classes.push(parent.className);
            }
            parent = parent.parentElement;
            depth++;
        }

        return classes.join(' ');
    }

    /**
     * Extract source information from an image element
     * @param {HTMLImageElement} img - The image element
     * @returns {Object} Object containing src, dataSrc, alt, and title
     */
    static getImageSource(img) {
        return {
            src: img.dataset.src || img.src || '',
            dataSrc: img.dataset.src || '',
            alt: img.alt || '',
            title: img.title || ''
        };
    }

    /**
     * Get comprehensive information about an image element
     * @param {HTMLImageElement} img - The image element
     * @returns {Object} Object containing image dimensions, attributes, and shortened src
     */
    static getImageInfo(img) {
        const rect = img.getBoundingClientRect();
        const src = img.dataset.src || img.src || '';

        // Create a short version of the src for logging
        let srcShort = src;
        if (src.length > 60) {
            const parts = src.split('/');
            srcShort = '.../' + parts[parts.length - 1];
            if (srcShort.length > 60) {
                srcShort = srcShort.substring(0, 57) + '...';
            }
        }

        return {
            alt: img.alt || '(no alt text)',
            title: img.title || '(no title)',
            src: src,
            srcShort: srcShort,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            className: img.className || '(no class)',
            id: img.id || '(no id)'
        };
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.DOMUtils = DOMUtils;
}