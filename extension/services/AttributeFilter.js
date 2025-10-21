/**
 * AttributeFilter.js
 *
 * Fast attribute-based filtering service for outfit matching (Stage 1)
 * Filters wardrobe items by category, color, style, and formality
 * to create a shortlist before visual analysis
 */

class AttributeFilter {
  constructor() {
    this.filterCache = new Map(); // Cache filtering results
  }

  /**
   * Determine which categories are needed to complete an outfit
   * @param {string} productCategory - Category of the product being considered
   * @returns {Object} Categories needed and optional for the outfit
   */
  determineNeededCategories(productCategory) {
    const rules = {
      'top': {
        needs: ['bottom', 'shoes'],
        optional: ['accessories', 'outerwear']
      },
      'bottom': {
        needs: ['top', 'shoes'],
        optional: ['accessories', 'outerwear']
      },
      'dress': {
        needs: ['shoes'],
        optional: ['accessories', 'outerwear']
      },
      'shoes': {
        needs: ['top', 'bottom'],
        alternative: ['dress'],
        optional: ['accessories', 'outerwear']
      },
      'outerwear': {
        needs: ['top', 'bottom', 'shoes'],
        alternative: ['dress', 'shoes'],
        optional: ['accessories']
      },
      'accessories': {
        needs: ['top', 'bottom', 'shoes'],
        alternative: ['dress', 'shoes'],
        optional: []
      }
    };

    return rules[productCategory.toLowerCase()] || {
      needs: [],
      optional: [],
      alternative: []
    };
  }

  /**
   * Filter wardrobe items by attributes to create shortlist
   * @param {Object} product - Product with aiAnalysis attributes
   * @param {Array} wardrobeItems - All wardrobe items with aiAnalysis
   * @returns {Promise<Array>} Shortlisted wardrobe items
   */
  async filterByAttributes(product, wardrobeItems) {
    // Check cache first
    const cacheKey = this._generateCacheKey(product, wardrobeItems);
    if (this.filterCache.has(cacheKey)) {
      console.log('[AttributeFilter] Cache hit for product:', product.id);
      return this.filterCache.get(cacheKey);
    }

    console.log('[AttributeFilter] Starting attribute filtering...');
    console.log('[AttributeFilter] Product category:', product.aiAnalysis.category);
    console.log('[AttributeFilter] Wardrobe items count:', wardrobeItems.length);

    // Send to background.js for AI filtering
    const response = await chrome.runtime.sendMessage({
      action: 'filterWardrobeItems',
      product: product.aiAnalysis,
      wardrobeItems: wardrobeItems.map((item, idx) => ({
        ...item.aiAnalysis,
        originalIndex: idx,
        id: item.id
      }))
    });

    if (!response || !response.shortlist) {
      console.error('[AttributeFilter] Invalid response from background script');
      return [];
    }

    // Map indices back to actual wardrobe items
    const shortlist = response.shortlist.map(idx => wardrobeItems[idx]);

    console.log('[AttributeFilter] Shortlist created:', shortlist.length, 'items');
    console.log('[AttributeFilter] Eliminated items:', Object.keys(response.eliminated || {}).length);

    // Cache the result
    this.filterCache.set(cacheKey, shortlist);

    // Clean cache if it gets too large (keep last 20 results)
    if (this.filterCache.size > 20) {
      const firstKey = this.filterCache.keys().next().value;
      this.filterCache.delete(firstKey);
    }

    return shortlist;
  }

  /**
   * Generate cache key for filtering results
   * @private
   */
  _generateCacheKey(product, wardrobeItems) {
    const productKey = `${product.id}_${product.aiAnalysis.category}`;
    const wardrobeKey = wardrobeItems.map(i => i.id).sort().join(',');
    return `${productKey}_${wardrobeKey}`;
  }

  /**
   * Clear the filter cache (call when wardrobe changes)
   */
  clearCache() {
    console.log('[AttributeFilter] Clearing cache');
    this.filterCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.filterCache.size,
      maxSize: 20
    };
  }
}

// Export for use in content scripts and services
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AttributeFilter;
}
