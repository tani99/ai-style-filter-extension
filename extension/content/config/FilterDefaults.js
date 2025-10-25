/**
 * FilterDefaults - Single source of truth for filter default values
 * Used by both FilterStateManager and FilterControls
 */

export const FILTER_DEFAULTS = {
    mode: 'myStyle',        // 'all' or 'myStyle' - DEFAULT: myStyle ON
    scoreThreshold: 7,      // Minimum score to show (1-10) - FIXED: 7 (automatic UI editing)
    selectedCategories: []  // Filter by specific style categories
};

// Export individual constants for convenience
export const DEFAULT_MODE = FILTER_DEFAULTS.mode;
export const DEFAULT_SCORE_THRESHOLD = FILTER_DEFAULTS.scoreThreshold;
export const DEFAULT_CATEGORIES = FILTER_DEFAULTS.selectedCategories;
