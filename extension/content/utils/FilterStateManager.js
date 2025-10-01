import { FILTER_DEFAULTS } from '../config/FilterDefaults.js';

/**
 * FilterStateManager handles persistence and state management for filtering
 * Coordinates between FilterControls and VisualIndicators
 */
export class FilterStateManager {
    constructor() {
        // Use shared defaults as single source of truth
        this.filterState = { ...FILTER_DEFAULTS };

        this.listeners = new Set(); // Callbacks for state changes
    }

    /**
     * Initialize filter state from storage
     */
    async initialize() {
        console.log('🔄 Initializing FilterStateManager...');

        try {
            // Load saved filter state from chrome.storage.local
            const result = await chrome.storage.local.get('filterState');

            if (result.filterState) {
                this.filterState = { ...this.filterState, ...result.filterState };
                console.log('✅ Loaded filter state from storage:', this.filterState);
            } else {
                console.log('ℹ️ No saved filter state, using defaults');
            }

            // Notify listeners
            this.notifyListeners();
        } catch (error) {
            console.error('❌ Error loading filter state:', error);
        }
    }

    /**
     * Get current filter state
     * @returns {Object} Current filter state
     */
    getFilterState() {
        return { ...this.filterState };
    }

    /**
     * Update filter state
     * @param {Object} newState - New filter state (partial update supported)
     */
    async updateFilterState(newState) {
        console.log('🔄 Updating filter state:', newState);

        // Merge with existing state
        this.filterState = { ...this.filterState, ...newState };

        // Save to storage
        await this.saveToStorage();

        // Notify listeners
        this.notifyListeners();

        console.log('✅ Filter state updated:', this.filterState);
    }

    /**
     * Save filter state to chrome.storage.local
     * @private
     */
    async saveToStorage() {
        try {
            await chrome.storage.local.set({ filterState: this.filterState });
            console.log('💾 Filter state saved to storage');
        } catch (error) {
            console.error('❌ Error saving filter state:', error);
        }
    }

    /**
     * Register a listener for filter state changes
     * @param {Function} callback - Callback function (receives filterState)
     */
    addListener(callback) {
        this.listeners.add(callback);
        console.log('👂 Filter state listener added. Total listeners:', this.listeners.size);
    }

    /**
     * Unregister a listener
     * @param {Function} callback - Callback function to remove
     */
    removeListener(callback) {
        this.listeners.delete(callback);
        console.log('👋 Filter state listener removed. Total listeners:', this.listeners.size);
    }

    /**
     * Notify all listeners of state change
     * @private
     */
    notifyListeners() {
        console.log('📢 Notifying filter state listeners...');
        this.listeners.forEach(callback => {
            try {
                callback(this.getFilterState());
            } catch (error) {
                console.error('❌ Error in filter state listener:', error);
            }
        });
    }

    /**
     * Reset filter state to defaults
     */
    async resetToDefaults() {
        console.log('🔄 Resetting filter state to defaults...');

        // Use shared defaults as single source of truth
        this.filterState = { ...FILTER_DEFAULTS };

        await this.saveToStorage();
        this.notifyListeners();

        console.log('✅ Filter state reset to defaults');
    }

    /**
     * Set filter mode (all or myStyle)
     * @param {string} mode - Filter mode ('all' or 'myStyle')
     */
    async setMode(mode) {
        if (mode !== 'all' && mode !== 'myStyle') {
            console.error('❌ Invalid filter mode:', mode);
            return;
        }

        await this.updateFilterState({ mode });
    }

    /**
     * Set score threshold
     * @param {number} threshold - Score threshold (1-10)
     */
    async setScoreThreshold(threshold) {
        const clampedThreshold = Math.max(1, Math.min(10, threshold));
        await this.updateFilterState({ scoreThreshold: clampedThreshold });
    }

    /**
     * Set selected style categories
     * @param {Array<string>} categories - Array of category names
     */
    async setSelectedCategories(categories) {
        await this.updateFilterState({ selectedCategories: categories });
    }

    /**
     * Toggle filter mode between 'all' and 'myStyle'
     */
    async toggleMode() {
        const newMode = this.filterState.mode === 'all' ? 'myStyle' : 'all';
        await this.setMode(newMode);
    }

    /**
     * Check if filtering is active
     * @returns {boolean} True if in 'myStyle' mode
     */
    isFilteringActive() {
        return this.filterState.mode === 'myStyle';
    }

    /**
     * Get filter statistics
     * @returns {Object} Statistics about current filter state
     */
    getStatistics() {
        return {
            mode: this.filterState.mode,
            scoreThreshold: this.filterState.scoreThreshold,
            categoryCount: this.filterState.selectedCategories.length,
            isActive: this.isFilteringActive(),
            listenerCount: this.listeners.size
        };
    }
}

// Expose on window for debugging
if (typeof window !== 'undefined') {
    window.FilterStateManager = FilterStateManager;
}
