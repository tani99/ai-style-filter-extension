/**
 * PositionCalculator.js
 *
 * Utility for calculating optimal positioning of generated try-on images
 * to prevent viewport overflow and ensure best user experience.
 *
 * Positioning priority: right → left → below → overlay
 *
 * @example
 * // Basic usage with default singleton instance
 * import { positionCalculator } from './utils/PositionCalculator.js';
 *
 * const triggerImage = document.querySelector('.product-image');
 * const imageRect = triggerImage.getBoundingClientRect();
 * const position = positionCalculator.calculateOptimalPosition(imageRect);
 *
 * console.log(position);
 * // Output: { type: 'right', x: 450, y: 120, width: 300, height: 400 }
 *
 * // Apply position to generated image
 * const generatedImage = document.createElement('img');
 * const styles = positionCalculator.getPositionStyles(position);
 * Object.assign(generatedImage.style, styles);
 *
 * @example
 * // Custom dimensions for different image sizes
 * import { PositionCalculator } from './utils/PositionCalculator.js';
 *
 * const calculator = new PositionCalculator();
 * calculator.setGeneratedImageDimensions(400, 500); // width, height
 * const position = calculator.calculateOptimalPosition(imageRect);
 *
 * @example
 * // Handle scroll and positioning
 * const position = positionCalculator.calculatePositionWithScroll(imageRect, false);
 * // Use false for absolute positioning (accounts for scroll)
 * // Use true for fixed positioning (relative to viewport)
 */

class PositionCalculator {
    constructor() {
        // Default dimensions for generated images
        this.REQUIRED_WIDTH = 300;  // Generated image width
        this.REQUIRED_HEIGHT = 400; // Generated image height
        this.PADDING = 20;          // Minimum padding from viewport edges
    }

    /**
     * Calculate optimal position for generated image relative to trigger image
     * @param {DOMRect} imageRect - Bounding rectangle of trigger image
     * @param {number} viewportWidth - Viewport width (optional, defaults to window.innerWidth)
     * @param {number} viewportHeight - Viewport height (optional, defaults to window.innerHeight)
     * @returns {Object} Position configuration with type and coordinates
     */
    calculateOptimalPosition(imageRect, viewportWidth = null, viewportHeight = null) {
        const viewport = this.getViewportDimensions(viewportWidth, viewportHeight);

        // Calculate available space in each direction
        const spaceRight = viewport.width - imageRect.right;
        const spaceLeft = imageRect.left;
        const spaceBelow = viewport.height - imageRect.bottom;

        // Priority 1: Position to the right
        if (spaceRight >= this.REQUIRED_WIDTH + this.PADDING) {
            return {
                type: 'right',
                x: imageRect.right + this.PADDING,
                y: this.calculateVerticalAlignment(imageRect, viewport.height),
                width: this.REQUIRED_WIDTH,
                height: this.REQUIRED_HEIGHT
            };
        }

        // Priority 2: Position to the left
        if (spaceLeft >= this.REQUIRED_WIDTH + this.PADDING) {
            return {
                type: 'left',
                x: imageRect.left - this.REQUIRED_WIDTH - this.PADDING,
                y: this.calculateVerticalAlignment(imageRect, viewport.height),
                width: this.REQUIRED_WIDTH,
                height: this.REQUIRED_HEIGHT
            };
        }

        // Priority 3: Position below
        if (spaceBelow >= this.REQUIRED_HEIGHT + this.PADDING) {
            return {
                type: 'below',
                x: this.calculateHorizontalCenter(imageRect, viewport.width),
                y: imageRect.bottom + this.PADDING,
                width: this.REQUIRED_WIDTH,
                height: this.REQUIRED_HEIGHT
            };
        }

        // Priority 4: Overlay on center of image (fallback)
        return {
            type: 'overlay',
            x: this.calculateHorizontalCenter(imageRect, viewport.width),
            y: this.calculateVerticalCenter(imageRect, viewport.height),
            width: this.REQUIRED_WIDTH,
            height: this.REQUIRED_HEIGHT
        };
    }

    /**
     * Calculate vertical alignment for side-positioned images
     * Tries to align with trigger image top, but respects viewport bounds
     * @param {DOMRect} imageRect - Trigger image rectangle
     * @param {number} viewportHeight - Viewport height
     * @returns {number} Y coordinate
     */
    calculateVerticalAlignment(imageRect, viewportHeight) {
        // Try to align with top of trigger image
        let y = imageRect.top;

        // Ensure image doesn't overflow bottom
        if (y + this.REQUIRED_HEIGHT > viewportHeight - this.PADDING) {
            y = viewportHeight - this.REQUIRED_HEIGHT - this.PADDING;
        }

        // Ensure image doesn't overflow top
        if (y < this.PADDING) {
            y = this.PADDING;
        }

        return Math.max(y, 0);
    }

    /**
     * Calculate horizontal center position for below/overlay modes
     * Centers on trigger image but keeps within viewport bounds
     * @param {DOMRect} imageRect - Trigger image rectangle
     * @param {number} viewportWidth - Viewport width
     * @returns {number} X coordinate
     */
    calculateHorizontalCenter(imageRect, viewportWidth) {
        // Center on trigger image
        const centerX = imageRect.left + (imageRect.width / 2) - (this.REQUIRED_WIDTH / 2);

        // Ensure doesn't overflow right edge
        if (centerX + this.REQUIRED_WIDTH > viewportWidth - this.PADDING) {
            return viewportWidth - this.REQUIRED_WIDTH - this.PADDING;
        }

        // Ensure doesn't overflow left edge
        if (centerX < this.PADDING) {
            return this.PADDING;
        }

        return Math.max(centerX, 0);
    }

    /**
     * Calculate vertical center position for overlay mode
     * Centers on trigger image but keeps within viewport bounds
     * @param {DOMRect} imageRect - Trigger image rectangle
     * @param {number} viewportHeight - Viewport height
     * @returns {number} Y coordinate
     */
    calculateVerticalCenter(imageRect, viewportHeight) {
        // Center on trigger image
        const centerY = imageRect.top + (imageRect.height / 2) - (this.REQUIRED_HEIGHT / 2);

        // Ensure doesn't overflow bottom edge
        if (centerY + this.REQUIRED_HEIGHT > viewportHeight - this.PADDING) {
            return viewportHeight - this.REQUIRED_HEIGHT - this.PADDING;
        }

        // Ensure doesn't overflow top edge
        if (centerY < this.PADDING) {
            return this.PADDING;
        }

        return Math.max(centerY, 0);
    }

    /**
     * Get current viewport dimensions
     * @param {number} width - Override width (optional)
     * @param {number} height - Override height (optional)
     * @returns {Object} Viewport dimensions
     */
    getViewportDimensions(width = null, height = null) {
        return {
            width: width !== null ? width : window.innerWidth,
            height: height !== null ? height : window.innerHeight
        };
    }

    /**
     * Check if position would cause viewport overflow
     * @param {Object} position - Position object from calculateOptimalPosition
     * @param {number} viewportWidth - Viewport width
     * @param {number} viewportHeight - Viewport height
     * @returns {boolean} True if position is valid
     */
    isPositionValid(position, viewportWidth = null, viewportHeight = null) {
        const viewport = this.getViewportDimensions(viewportWidth, viewportHeight);

        const overflowsRight = position.x + position.width > viewport.width;
        const overflowsBottom = position.y + position.height > viewport.height;
        const overflowsLeft = position.x < 0;
        const overflowsTop = position.y < 0;

        return !(overflowsRight || overflowsBottom || overflowsLeft || overflowsTop);
    }

    /**
     * Update position configuration for different generated image dimensions
     * @param {number} width - Generated image width
     * @param {number} height - Generated image height
     */
    setGeneratedImageDimensions(width, height) {
        this.REQUIRED_WIDTH = width;
        this.REQUIRED_HEIGHT = height;
    }

    /**
     * Get CSS positioning styles for the calculated position
     * @param {Object} position - Position object from calculateOptimalPosition
     * @param {boolean} useFixed - Use fixed positioning instead of absolute
     * @returns {Object} CSS style object
     */
    getPositionStyles(position, useFixed = false) {
        return {
            position: useFixed ? 'fixed' : 'absolute',
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${position.width}px`,
            height: `${position.height}px`,
            zIndex: '10000'
        };
    }

    /**
     * Calculate position accounting for page scroll
     * @param {DOMRect} imageRect - Trigger image rectangle
     * @param {boolean} useFixed - If false, adds scroll offset for absolute positioning
     * @returns {Object} Position configuration
     */
    calculatePositionWithScroll(imageRect, useFixed = false) {
        const position = this.calculateOptimalPosition(imageRect);

        if (!useFixed) {
            // For absolute positioning, add scroll offset
            position.x += window.scrollX;
            position.y += window.scrollY;
        }

        return position;
    }
}

// Export the class
export { PositionCalculator };

// Create singleton instance for direct use
export const positionCalculator = new PositionCalculator();
