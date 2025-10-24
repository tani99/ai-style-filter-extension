# Analyzer Refactoring Plan: BaseAnalyzer Parent Class

## Overview
Extract shared functionality from ProductAnalyzer and PromptRankingEngine into a BaseAnalyzer parent class to eliminate duplicate code and improve maintainability.

## Shared Methods & Properties (Move to Parent)

### Properties:
- `analysisCache` - Map for caching results
- `maxCacheSize` - Cache size limit (100)
- `isInitialized` - Initialization flag
- `pendingAnalyses` - Map for tracking concurrent analyses

### Methods:

1. **`initialize()`** - 95% identical
   - Check LanguageModel availability
   - Test session creation
   - Set initialization flag
   - Include image classifier check (needed for both)

2. **`extractImageContext(img)`** - 100% identical
   - Extracts product context from parent elements
   - Looks for price/title indicators

3. **`cacheResult(cacheKey, result)`** - 100% identical
   - LRU cache implementation

4. **`clearCache()`** - 99% identical (different log message)
   - Keep log message in shared version

5. **`getCacheStats()`** - 100% identical
   - Returns cache statistics

6. **`delay(ms)`** - 100% identical
   - Utility delay function

7. **`destroy()`** - 99% identical (different log message)
   - Keep log message in shared version

8. **`analyzeBatch()`** - 90% similar structure
   - Needs abstraction - calls different analyze methods
   - Use abstract method pattern

## Child-Specific Methods (Stay in Children)

### ProductAnalyzer:
- `analyzeProduct(productImage, styleProfile)` - Specific to style profile
- `_performAnalysis()` - Style-specific analysis logic
- `buildAnalysisPrompt()` - Style prompt building
- `parseAnalysisResponse()` - Parses SCORE format (1-10)
- `getCacheKey()` - Uses profile version/timestamp

### PromptRankingEngine:
- `analyzeProductWithPrompt(productImage, userPrompt)` - Specific to text prompts
- `_performPromptAnalysis()` - Prompt-specific analysis logic
- `buildPromptAnalysisPrompt()` - Prompt building
- `parseAnalysisResponse()` - Parses TIER format (1-3)
- `classifyImage()` - Image classification (unique to PromptRankingEngine)
- `getCacheKey()` - Uses prompt hash

## Proposed Structure

```
BaseAnalyzer (abstract parent)
├── Shared properties (cache, initialization state)
├── initialize() - with image classifier check
├── extractImageContext()
├── Cache management (cacheResult, clearCache, getCacheStats)
├── Utilities (delay, destroy)
└── analyzeBatch() - calls abstract analyze() method

ProductAnalyzer extends BaseAnalyzer
├── analyzeProduct() - implements abstract analyze()
├── _performAnalysis()
├── buildAnalysisPrompt()
├── parseAnalysisResponse() - SCORE format
└── getCacheKey() - profile-based

PromptRankingEngine extends BaseAnalyzer
├── analyzeProductWithPrompt() - implements abstract analyze()
├── _performPromptAnalysis()
├── buildPromptAnalysisPrompt()
├── classifyImage()
├── parseAnalysisResponse() - TIER format
└── getCacheKey() - prompt-based
```

## Implementation Steps

1. **Create `BaseAnalyzer.js`** in `/extension/content/ai/`
   - Define shared properties in constructor
   - Move all identical methods
   - Include image classifier check in initialize()
   - Make `analyzeBatch()` generic using abstract method pattern

2. **Refactor `ProductAnalyzer.js`**
   - Import and extend `BaseAnalyzer`
   - Remove duplicate methods
   - Keep only style-specific methods

3. **Refactor `PromptRankingEngine.js`**
   - Import and extend `BaseAnalyzer`
   - Remove duplicate methods
   - Keep only prompt-specific methods

4. **Test both analyzers** to ensure functionality unchanged

## Benefits

✅ ~200 lines of duplicate code eliminated
✅ Single source of truth for cache management
✅ Easier to add new analyzer types in future
✅ Bug fixes in shared logic only need one change
✅ Clearer separation between shared infrastructure and specific analysis logic
