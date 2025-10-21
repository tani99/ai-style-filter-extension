/**
 * VisualOutfitAnalyzer.js
 *
 * Visual image-based outfit analysis service (Stage 2)
 * Analyzes actual product and wardrobe item images to determine
 * visual compatibility for outfit composition
 */

class VisualOutfitAnalyzer {
  constructor() {
    this.analysisCache = new Map(); // Cache visual analysis results
  }

  /**
   * Analyze visual compatibility between product and shortlisted wardrobe items
   * @param {string} productImageUrl - URL of the product image
   * @param {Object} productAnalysis - Product's AI analysis attributes
   * @param {Array} shortlistedItems - Wardrobe items that passed attribute filtering
   * @returns {Promise<Object>} Best outfit with visual scores
   */
  async analyzeVisualCompatibility(productImageUrl, productAnalysis, shortlistedItems) {
    console.log('[VisualOutfitAnalyzer] Starting visual analysis...');
    console.log('[VisualOutfitAnalyzer] Product:', productAnalysis.category);
    console.log('[VisualOutfitAnalyzer] Shortlisted items:', shortlistedItems.length);

    // Check cache first
    const cacheKey = this._generateCacheKey(productImageUrl, shortlistedItems);
    if (this.analysisCache.has(cacheKey)) {
      console.log('[VisualOutfitAnalyzer] Cache hit');
      return this.analysisCache.get(cacheKey);
    }

    // Prepare item data for AI visual analysis
    const itemsForAnalysis = shortlistedItems.map((item, idx) => ({
      index: idx,
      id: item.id,
      category: item.aiAnalysis.category,
      colors: item.aiAnalysis.colors,
      style: item.aiAnalysis.style,
      pattern: item.aiAnalysis.pattern,
      formality: item.aiAnalysis.formality,
      imageUrl: item.imageUrl,
      description: item.aiAnalysis.description || 'No description'
    }));

    // Send to background script for visual AI analysis
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'composeOutfitVisual',
        product: {
          category: productAnalysis.category,
          colors: productAnalysis.colors,
          style: productAnalysis.style,
          pattern: productAnalysis.pattern,
          formality: productAnalysis.formality,
          imageUrl: productImageUrl
        },
        shortlistedItems: itemsForAnalysis
      });

      if (!response || response.error) {
        throw new Error(response?.error || 'Visual analysis failed');
      }

      console.log('[VisualOutfitAnalyzer] Visual analysis complete');
      console.log('[VisualOutfitAnalyzer] Best outfit confidence:', response.best_outfit?.overall_confidence || 0);

      // Cache the result
      this.analysisCache.set(cacheKey, response);

      // Clean cache if it gets too large (keep last 10 results)
      if (this.analysisCache.size > 10) {
        const firstKey = this.analysisCache.keys().next().value;
        this.analysisCache.delete(firstKey);
      }

      return response;

    } catch (error) {
      console.error('[VisualOutfitAnalyzer] Error during visual analysis:', error);
      throw error;
    }
  }

  /**
   * Generate cache key for visual analysis results
   * @private
   */
  _generateCacheKey(productImageUrl, shortlistedItems) {
    const productKey = productImageUrl.substring(0, 50); // Use part of URL
    const itemsKey = shortlistedItems.map(i => i.id).sort().join(',');
    return `${productKey}_${itemsKey}`;
  }

  /**
   * Clear the analysis cache (call when wardrobe changes)
   */
  clearCache() {
    console.log('[VisualOutfitAnalyzer] Clearing cache');
    this.analysisCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.analysisCache.size,
      maxSize: 10
    };
  }

  /**
   * Validate outfit completeness
   * Ensures outfit has required categories
   * @param {Array} outfitItems - Items in the outfit
   * @param {string} productCategory - Category of the product
   * @returns {Object} Validation result
   */
  validateOutfitCompleteness(outfitItems, productCategory) {
    const categories = outfitItems.map(item => item.category.toLowerCase());

    // Define outfit completion rules
    const rules = {
      'top': {
        required: ['bottom', 'shoes'],
        optional: ['accessories', 'outerwear']
      },
      'bottom': {
        required: ['top', 'shoes'],
        optional: ['accessories', 'outerwear']
      },
      'dress': {
        required: ['shoes'],
        optional: ['accessories', 'outerwear']
      },
      'shoes': {
        required: ['top', 'bottom'],
        alternative: [['dress']],
        optional: ['accessories', 'outerwear']
      },
      'outerwear': {
        required: ['top', 'bottom', 'shoes'],
        alternative: [['dress', 'shoes']],
        optional: ['accessories']
      },
      'accessories': {
        required: ['top', 'bottom', 'shoes'],
        alternative: [['dress', 'shoes']],
        optional: ['outerwear']
      }
    };

    const rule = rules[productCategory.toLowerCase()];
    if (!rule) {
      return { complete: false, missing: ['Unknown product category'] };
    }

    // Check required categories
    const missing = [];
    let hasAlternative = false;

    // Check if all required items are present
    for (const reqCat of rule.required) {
      if (!categories.includes(reqCat)) {
        missing.push(reqCat);
      }
    }

    // Check alternatives (if required items missing)
    if (missing.length > 0 && rule.alternative) {
      for (const altSet of rule.alternative) {
        if (altSet.every(alt => categories.includes(alt))) {
          hasAlternative = true;
          break;
        }
      }
    }

    const complete = missing.length === 0 || hasAlternative;

    return {
      complete,
      missing: complete ? [] : missing,
      hasAlternative,
      categories: categories
    };
  }
}

// Export for use in content scripts and services
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VisualOutfitAnalyzer;
}
