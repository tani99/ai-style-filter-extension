# Lazy Loading & Score Badge Issues - Analysis & Implementation Plan

## Problem Summary

### Issue 1: Images loaded after scrolling are not analyzed
- **Current behavior**: Only images visible when the page first loads (within 500ms) are detected and analyzed
- **Root cause**: Lazy loading detection is **DISABLED** in `ContentScriptManager.js:180-184`
- **Why disabled**: Original implementation caused issues with image hover swaps (when hovering over products triggers image changes)
- **User impact**: As user scrolls down product listing pages, newly visible products don't get analyzed or show score badges

### Issue 2: Some analyzed images don't show score badges
- **Current behavior**: Logs show analysis completing and scores being stored, but badges don't appear in UI
- **Root cause**:
  - Analysis runs on **placeholder images** (1x1 transparent GIF: `data:image/gif;base64,R0lGODlhAQABAIAAA...`)
  - E-commerce sites use lazy loading: placeholder → actual image (different src)
  - Score is stored on placeholder element which may become invisible or change position
  - Badge is positioned based on placeholder dimensions (tiny 1x1 pixel)
- **User impact**: Incomplete/missing visual feedback for analyzed products

---
 i think it might help if each image on the page 
  stores it's own state as well of whether it has yet
   to be analysed, anslysis in progress versus 
  analysis complete and then we have a listener that 
  constantly makes sure that any image which hasn't 
  been analysed or currently inst in analysing state 
  is then analysed. 
## Technical Root Causes

### 1. Lazy Loading Detection Disabled
```javascript
// From ContentScriptManager.js:180-184
// DISABLED: Lazy loading detection causes issues with image hover swaps
// Only detect initial images on page load, not dynamic changes
// this.eventListeners.setupLazyLoadingDetection(() => {
//     this.handleNewImagesDetected();
// });
```

### 2. Analysis Timing Issues
- `runInitialDetection()` triggers after 500ms delay
- `CandidateFinder.findCandidateImages()` uses `document.querySelectorAll('img')` - snapshot in time
- Images that load later (lazy loading, infinite scroll) are never queried again

### 3. Placeholder Image Problem
```javascript
// User's log shows:
src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALA..."
```
- This is a common lazy loading pattern (blank 1x1 GIF placeholder)
- Analysis happens on placeholder before actual image loads
- Score stored in `img.dataset.aiStyleScore` on placeholder element
- When real image loads (via `src` change), the badge position is wrong or badge is orphaned

### 4. Badge Positioning Based on Current State
```javascript
// From ScoreBadgeManager.js:223-230
positionBadge(badge, img) {
    const rect = img.getBoundingClientRect();
    badge.style.top = `${rect.top + window.scrollY + 8}px`;
    badge.style.left = `${rect.left + window.scrollX + rect.width - 8}px`;
    // ...
}
```
- Position calculated once at render time
- If image is 1x1 placeholder, badge position will be wrong
- No mechanism to detect when image src changes and reposition

---

## Solution Alternatives

### Alternative A: Intersection Observer for Progressive Detection ⭐ RECOMMENDED
**Approach**: Use Intersection Observer API to detect when new images enter the viewport, then analyze them progressively.

**Pros**:
- Native browser API, highly performant
- Only analyzes images when they become visible (optimal resource usage)
- Handles infinite scroll, lazy loading, and dynamic content automatically
- Can be throttled/debounced to prevent excessive analysis
- Doesn't conflict with hover swaps (only triggers on new elements entering viewport)

**Cons**:
- Slightly more complex implementation
- Need to handle observer cleanup

**Implementation complexity**: Medium

---

### Alternative B: MutationObserver for DOM Changes
**Approach**: Use MutationObserver to watch for new `<img>` elements added to the DOM or src attribute changes.

**Pros**:
- Catches all DOM changes including lazy loading
- Can detect src attribute changes (placeholder → real image)
- Native browser API

**Cons**:
- Can be noisy (many mutations on modern web apps)
- May trigger on hover swaps (the original problem)
- Harder to filter out irrelevant changes
- More aggressive CPU usage

**Implementation complexity**: Medium-High

---

### Alternative C: Periodic Re-scanning with Smart Debouncing
**Approach**: Periodically re-run `findCandidateImages()` but only analyze images that don't have `data-clothing-item-detected` attribute.

**Pros**:
- Simple implementation
- Uses existing detection infrastructure
- Can be tuned with interval timing

**Cons**:
- Wasteful (scans entire DOM repeatedly)
- Fixed intervals may miss content or waste resources
- Doesn't scale well with large pages
- Still has placeholder image problem

**Implementation complexity**: Low

---

### Alternative D: Combination Approach: Intersection Observer + Src Change Detection ⭐⭐ BEST SOLUTION
**Approach**:
1. Use Intersection Observer to detect new images entering viewport
2. Use MutationObserver (limited to `src` attribute changes) to detect lazy load completion
3. Re-analyze and reposition badges when src changes from placeholder to real image

**Pros**:
- Handles both lazy loading and placeholder swaps
- Most robust solution
- Efficient resource usage
- Solves both Issue #1 and Issue #2

**Cons**:
- Most complex to implement
- Requires careful coordination between observers

**Implementation complexity**: High

---

## Recommended Implementation Plan

### Phase 1: Intersection Observer for Progressive Detection
**Goal**: Detect and analyze images as user scrolls

#### Step 1.1: Create IntersectionObserverManager
- **File**: `/extension/content/detection/IntersectionObserverManager.js`
- **Responsibilities**:
  - Set up Intersection Observer for `<img>` elements
  - Trigger analysis when images enter viewport (with threshold, e.g., 50% visible)
  - Debounce analysis triggers to batch nearby images
  - Track observed images to avoid duplicate analysis

#### Step 1.2: Integrate with ContentScriptManager
- **File**: `/extension/content/core/ContentScriptManager.js`
- **Changes**:
  - Initialize `IntersectionObserverManager` in constructor
  - Start observing after initial detection completes
  - Provide callback to analyze newly visible images
  - Ensure `detectNewImages()` is called when new images are detected

#### Step 1.3: Handle Image Hover Swaps (Prevent False Positives)
- **Strategy**:
  - Only analyze images that don't have `data-clothing-item-detected` attribute
  - Add small delay (200-300ms) before analysis to filter out brief hover swaps
  - Use `data-ai-observed="true"` attribute to mark images we're already tracking

**Estimated effort**: 4-6 hours

---

### Phase 2: Src Change Detection for Placeholder Handling
**Goal**: Re-analyze and reposition badges when placeholder images load actual content

#### Step 2.1: Create SrcChangeObserver
- **File**: `/extension/content/detection/SrcChangeObserver.js`
- **Responsibilities**:
  - Use MutationObserver with `attributeFilter: ['src']`
  - Detect when `src` changes from placeholder pattern (data:image/gif, 1x1.gif, etc.) to real URL
  - Trigger badge repositioning for images with stored scores
  - Optionally re-analyze if image dimensions change significantly

#### Step 2.2: Enhance ScoreBadgeManager
- **File**: `/extension/content/ui/ScoreBadgeManager.js`
- **Changes**:
  - Add `repositionBadge(img)` method that can be called externally
  - Add `updateBadgeForSrcChange(img, newSrc)` method
  - Store image-to-badge mapping with src tracking
  - Re-render badge if image dimensions change significantly

#### Step 2.3: Integrate Observers
- **File**: `/extension/content/core/ContentScriptManager.js`
- **Changes**:
  - Initialize `SrcChangeObserver` after initial detection
  - Connect src change events to badge repositioning
  - Log src changes for debugging

**Estimated effort**: 3-4 hours

---

### Phase 3: Testing & Refinement
**Goal**: Ensure solution works across different lazy loading patterns

#### Test Cases:
1. **Standard lazy loading** (Zara, H&M): Scroll down, verify all products get analyzed
2. **Infinite scroll** (continuous loading): Verify analysis continues as new products appear
3. **Placeholder images**: Verify badges appear correctly after real images load
4. **Image hover swaps**: Verify hover effects don't trigger duplicate analysis
5. **Performance**: Verify no significant performance degradation on pages with 100+ products

#### Monitoring:
- Add debug logs for observer triggers
- Track analysis queue length
- Monitor badge render/reposition frequency

**Estimated effort**: 2-3 hours

---

## Implementation Details

### File Structure
```
/extension/content/detection/
├── ImageDetector.js                    (existing)
├── CandidateFinder.js                  (existing)
├── IntersectionObserverManager.js      (NEW)
└── SrcChangeObserver.js                (NEW)

/extension/content/ui/
├── ScoreBadgeManager.js                (modify)
└── ...

/extension/content/core/
└── ContentScriptManager.js             (modify)
```

### Key API Usage

#### Intersection Observer
```javascript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Image entered viewport
        this.handleNewImage(entry.target);
      }
    });
  },
  {
    root: null,           // viewport
    threshold: 0.5,       // 50% visible
    rootMargin: '100px'   // start observing 100px before visible
  }
);
```

#### Mutation Observer (for src changes)
```javascript
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
      const img = mutation.target;
      const oldSrc = mutation.oldValue;
      const newSrc = img.src;

      if (isPlaceholder(oldSrc) && !isPlaceholder(newSrc)) {
        // Placeholder → real image
        this.handleSrcChange(img, oldSrc, newSrc);
      }
    }
  });
});

observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['src'],
  attributeOldValue: true,
  subtree: true,
  childList: false
});
```

---

## Configuration & Tuning

### Performance Tuning Options
```javascript
const CONFIG = {
  // Intersection Observer
  intersectionThreshold: 0.5,        // 50% visible before analyzing
  intersectionRootMargin: '100px',   // Pre-load 100px ahead

  // Debouncing
  analysisDebounceDelay: 300,        // Wait 300ms before analyzing batch

  // Batch processing
  maxConcurrentAnalysis: 5,          // Max 5 images analyzed at once

  // Placeholder detection
  placeholderPatterns: [
    /data:image\/gif/,
    /1x1\.gif/,
    /placeholder\./,
    /lazy\./
  ]
};
```

---

## Migration Strategy

### Step 1: Feature Flag
- Add `enableLazyLoadingDetection: true/false` to storage
- Allow users to toggle via popup
- Default to `false` initially for testing

### Step 2: Gradual Rollout
- Enable for testing on single site (e.g., H&M)
- Monitor performance and accuracy
- Expand to all sites once stable

### Step 3: Remove Old Code
- Once stable, remove commented lazy loading code
- Clean up unused event listeners

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Performance degradation | High | Medium | Throttle/debounce observers, batch analysis |
| False positives (hover swaps) | Medium | Medium | Add delay, check for existing attributes |
| Badge positioning issues | Medium | Low | Test across sites, add repositioning logic |
| Memory leaks | High | Low | Proper cleanup in observer disconnect |

---

## Success Metrics

1. **Coverage**: 95%+ of products analyzed after scrolling through full page
2. **Accuracy**: Badge position correct within 5px for all visible products
3. **Performance**: No noticeable lag when scrolling
4. **Stability**: No duplicate analysis for hover swaps

---

## Timeline Estimate

- **Phase 1 (Intersection Observer)**: 1-2 days
- **Phase 2 (Src Change Detection)**: 1 day
- **Phase 3 (Testing & Refinement)**: 1 day
- **Total**: 3-4 days

---

## Next Steps

1. Review and approve this plan
2. Implement Phase 1 (Intersection Observer)
3. Test on H&M with feature flag
4. Implement Phase 2 if needed
5. Full testing across all supported sites
6. Deploy with feature flag enabled
