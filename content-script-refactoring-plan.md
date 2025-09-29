# Content Script Refactoring - Step-by-Step Implementation Plan

## Overview
Refactor the monolithic 3,123-line `content.js` file into a modular architecture with clear separation of concerns.

## Phase 1: Setup and Foundation (Steps 1-4)

### Step 1: Create Directory Structure
```bash
mkdir -p extension/content/{core,ai,detection,ui,config,utils}
```

**Create directories:**
- `content/core/` - Core orchestration classes
- `content/ai/` - AI analysis modules
- `content/detection/` - Image detection logic
- `content/ui/` - UI management and indicators
- `content/config/` - Configuration files
- `content/utils/` - Utility functions

### Step 2: Extract Site Configuration
**Create:** `content/config/SiteConfigurations.js`

**Extract from current file:**
- Lines 10-88: `supportedSites` object
- Move entire site configuration object to new module
- Export as `SUPPORTED_SITES` constant

**Responsibilities:**
- Site-specific selectors and rules
- Product page patterns
- Category page patterns

### Step 3: Create Core Site Detection
**Create:** `content/core/SiteDetector.js`

**Extract methods:**
- `detectCurrentSite()` (line 107)
- Site hostname matching logic
- Import `SUPPORTED_SITES` from config

**Dependencies:** `SiteConfigurations.js`

### Step 4: Create Page Type Detector
**Create:** `content/core/PageTypeDetector.js`

**Extract methods:**
- `detectPageType()` (line 116)
- Page classification logic (product vs category vs general)

**Dependencies:** `SiteDetector.js`

## Phase 2: Utility Modules (Steps 5-8)

### Step 5: Extract DOM Utilities
**Create:** `content/utils/DOMUtils.js`

**Extract methods:**
- `getImageKey()` (line 261)
- `getImageInfo()` (line 2016)
- `getImageSource()` (line 2007)
- `getParentClasses()` (line 1965)
- `isElementInViewport()` (line 430)

### Step 6: Extract Geometry Utilities
**Create:** `content/utils/GeometryUtils.js`

**Extract methods:**
- `positionOverlay()` (line 2042)
- `positionScoreBadge()` (line 2066)
- All positioning and layout calculation logic

### Step 7: Extract Event Management
**Create:** `content/utils/EventListeners.js`

**Extract methods:**
- `setupMessageListeners()` (line 2812)
- `setupNavigationListener()` (line 2968)
- `setupLazyLoadingDetection()` (line 3029)
- All event handling logic

### Step 8: Create Analysis Cache
**Create:** `content/ai/AnalysisCache.js`

**Extract methods:**
- `generateProductCacheKey()` (line 816)
- `getCacheStatusForImage()` (line 933)
- `clearAnalysisCache()` (line 956)
- `debugCache()` (line 908)
- All caching logic and Map management

## Phase 3: Detection Modules (Steps 9-12)

### Step 9: Create Visibility Checker
**Create:** `content/detection/VisibilityChecker.js`

**Extract methods:**
- `isImageVisible()` (line 1544)
- `checkImageQuality()` (line 1479)
- `debugImageVisibility()` (line 2481)
- `debugVisibilityIssues()` (line 2578)

### Step 10: Create Quick Exclusion
**Create:** `content/detection/QuickExclusion.js`

**Extract methods:**
- `quickExclusionCheck()` (line 1742)
- Fast rejection rules for UI elements

### Step 11: Create Candidate Finder
**Create:** `content/detection/CandidateFinder.js`

**Extract methods:**
- `findCandidateImages()` (line 1378)
- `testSelectors()` (line 1017)
- Selector-based image finding logic

**Dependencies:** `SiteConfigurations.js`, `QuickExclusion.js`

### Step 12: Create Image Detector
**Create:** `content/detection/ImageDetector.js`

**Extract methods:**
- `detectProductImages()` (line 1064)
- `detectNewImages()` (line 1247)
- `analyzeImageContext()` (line 1908)
- `isInProductArea()` (line 1981)
- `isInGridLayout()` (line 1937)

**Dependencies:** `CandidateFinder.js`, `VisibilityChecker.js`

## Phase 4: AI Analysis Modules (Steps 13-17)

### Step 13: Create Alt Text Analyzer
**Create:** `content/ai/AltTextAnalyzer.js`

**Extract methods:**
- `analyzeAltTextWithAI()` (line ~1780)
- Alt text analysis logic using Chrome AI

### Step 14: Create Image Classifier
**Create:** `content/ai/ImageClassifier.js`

**Extract methods:**
- `classifyImageWithAI()` (line 1839)
- `isClothingImage()` (line 1703)
- Chrome's image classification API usage

### Step 15: Create Style Matcher
**Create:** `content/ai/StyleMatcher.js`

**Extract methods:**
- `createProductAnalysisPrompt()` (line 705)
- `parseProductAnalysisResponse()` (line 747)
- `fallbackProductAnalysis()` (line 776)
- Style profile matching logic

### Step 16: Create AI Analysis Engine
**Create:** `content/ai/AIAnalysisEngine.js`

**Extract methods:**
- `analyzeProduct()` (line ~550)
- `analyzeMultipleProducts()` (line 836)
- `queueProductAnalysis()` (line ~570)
- `processAnalysisQueue()` (line ~690)
- Circuit breaker logic

**Dependencies:** All AI modules, `AnalysisCache.js`

### Step 17: Extract Analysis Statistics
**Add to:** `content/ai/AIAnalysisEngine.js`

**Extract methods:**
- `logAnalysisStatistics()` (line 884)
- `debugAnalysisQueue()` (line 460)
- `resetAnalysisState()` (line 485)

## Phase 5: UI Management (Steps 18-20)

### Step 18: Create Loading Animations
**Create:** `content/ui/LoadingAnimations.js`

**Extract methods:**
- `showLoadingAnimation()` (line 2294)
- `hideLoadingAnimation()` (line 2373)
- All loading overlay logic

### Step 19: Create Visual Indicators
**Create:** `content/ui/VisualIndicators.js`

**Extract methods:**
- `addVisualIndicators()` (line 2082)
- `addSingleImageIndicator()` (line 323)
- `updateSingleImageIndicators()` (line 311)
- `clearProductDetection()` (line 2255)
- All overlay and badge management

**Dependencies:** `GeometryUtils.js`

### Step 20: Create Debug Interface
**Create:** `content/ui/DebugInterface.js`

**Extract methods:**
- `enableDebugMode()` (line 2464)
- `getDetectionStats()` (line 2476)
- `debugPageStructure()` (line 2710)
- `logDetectionResults()` (line 2386)
- All debug-related UI logic

## Phase 6: Core Orchestration (Steps 21-22)

### Step 21: Create Content Script Manager
**Create:** `content/core/ContentScriptManager.js`

**Extract core logic:**
- Constructor initialization
- `initialize()` (line 144)
- `initializeForPageType()` (line 967)
- `initializeStyleAnalysis()` (line 171)
- `setupViewportAnalysis()` (line 227)
- Main orchestration logic

**Dependencies:** All other modules

### Step 22: Refactor Main Entry Point
**Modify:** `content/content.js`

**New structure:**
```javascript
import { ContentScriptManager } from './core/ContentScriptManager.js';

console.log('AI Style Filter content script loaded');

// Initialize the content script manager
const styleFilter = new ContentScriptManager();
window.styleFilter = styleFilter; // For debugging
```

## Phase 7: Integration and Testing (Steps 23-25)

### Step 23: Update Manifest
**Modify:** `manifest.json`

**Update content_scripts:**
- Add all new JavaScript files to content script array
- Maintain proper loading order
- Update file paths if needed

### Step 24: Add Import/Export Statements
**For each module:**
- Add proper ES6 import statements
- Export classes and functions appropriately
- Resolve all dependencies between modules

### Step 25: Testing and Validation
**Test each phase:**
1. Test site detection works correctly
2. Verify image detection still functions
3. Confirm AI analysis is working
4. Check visual indicators appear properly
5. Test debug modes and logging
6. Verify extension loads without errors

## Phase 8: Cleanup and Optimization (Steps 26-27)

### Step 26: Remove Original File
**After successful testing:**
- Delete the original `content/content.js` (backup first)
- Clean up any unused code
- Optimize imports

### Step 27: Documentation and Final Testing
- Update CLAUDE.md with new architecture
- Add JSDoc comments to public methods
- Perform full end-to-end testing on all supported sites
- Verify all functionality works as before

## Success Criteria
- ✅ All original functionality preserved
- ✅ Extension loads and works on supported sites (Zara, H&M, Nike)
- ✅ AI analysis and visual indicators function correctly
- ✅ Debug modes work as expected
- ✅ No console errors or broken functionality
- ✅ Code is more maintainable and testable