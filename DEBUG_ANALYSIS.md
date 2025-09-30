# Debug Guide: Product Analysis & Score Overlays

## Overview
Added extensive logging to trace the entire analysis pipeline from style profile loading through score display.

## How to Debug

### Step 1: Reload the Extension
1. Go to `chrome://extensions/`
2. Find "AI Style-Based Shopping Filter"
3. Click the reload icon 🔄
4. The extension has been rebuilt with detailed logging

### Step 2: Ensure You Have a Style Profile
1. Click the extension icon in toolbar
2. Click "Open Style Dashboard"
3. Upload 3-5 photos of yourself
4. Click "Analyze My Style"
5. Wait for AI to generate your profile
6. Verify you see your style profile displayed

### Step 3: Open Console and Visit Shopping Site
1. Open a new tab
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Visit a shopping site:
   - https://www.zara.com/us/en/woman-dresses-l1066.html
   - https://www2.hm.com/en_us/women/products/dresses.html
   - https://www.nike.com/w/mens-shoes-nik1zy7ok

### Step 4: Watch Console Logs

You should see these logs in order:

#### 1. Initialization
```
✅ AI Style Filter initializing on [Site Name]
📄 Page Type: category
```

#### 2. Style Profile Loading
```
✅ Style profile loaded: {version: "1.0", generatedAt: "...", categories: "..."}
```
**OR if no profile:**
```
ℹ️ No style profile found in storage
```

#### 3. Product Detection
```
🎨 Adding visual indicators...
✅ Added indicator for detected image 1
✅ Added indicator for detected image 2
...
```

#### 4. Product Analysis Start
```
🎯 analyzeDetectedProducts called
   Style profile: PRESENT
   Detected products: 12
🔍 Starting product analysis for 12 items...
   Style profile details: {colors: Array(5), styles: Array(3), version: "1.0"}
```

#### 5. ProductAnalyzer Initialization
```
🔧 Initializing ProductAnalyzer...
✅ Chrome AI API detected
🔍 AI Availability: {available: "readily"}
🔧 Creating AI session for product analysis...
✅ ProductAnalyzer initialized successfully
   AI Session: [Object]
```

#### 6. Individual Product Analysis
```
🔍 analyzeProduct called for: {alt: "...", src: "..."}
🚀 Starting new analysis for product
📝 _performAnalysis started
🔨 Building analysis prompt...
📄 Prompt built (length: 450 chars)
📄 Full prompt:
[Shows the actual prompt sent to AI]

🤖 Sending prompt to AI...
🤖 AI response received: SCORE: 8
REASON: Navy dress matches classic style perfectly

🔍 Parsing AI response...
✅ Parsed result: {success: true, score: 8, reasoning: "...", method: "ai_analysis"}
✅ Product analyzed: Score 8/10 - Navy dress matches classic style perfectly
```

#### 7. Batch Progress
```
📊 Analysis progress: 3/12 (25%)
📊 Analysis progress: 6/12 (50%)
📊 Analysis progress: 9/12 (75%)
📊 Analysis progress: 12/12 (100%)
```

#### 8. Results Storage
```
✅ Batch analysis complete, results: [{score: 8, ...}, {score: 6, ...}, ...]
   Product 1 score: 8/10
   Product 2 score: 6/10
   Product 3 score: 9/10
   ...
```

#### 9. Visual Overlay Creation
```
🎨 Updating visual indicators with scores...
🎨 updateProductScores called with 12 results
   Product 1: {hasProduct: true, hasElement: true, score: 8, reasoning: "..."}
   Adding score overlay for product 1

🏷️ addScoreOverlay called for image 1: {score: 8, reasoning: "...", imgAlt: "...", imgSrc: "..."}
   Overlay data: FOUND
   Creating score badge...
   Score badge created: <div class="ai-style-score-badge" ...>
   Positioning score badge...
   Badge position: {top: "150px", left: "420px"}
   Appending badge to document.body
   Badge appended, parent: HTMLBodyElement
   Image data attributes updated
   Event handlers added
✅ Added score overlay 8/10 for image 1
```

#### 10. Completion
```
✅ Visual indicators updated with scores
✅ Product analysis complete: {totalProducts: 12, averageScore: "7.3", cacheStats: {...}}
```

## Common Issues & Solutions

### Issue 1: "No style profile found in storage"
**Symptom:**
```
ℹ️ No style profile found in storage
⚠️ No style profile available for analysis
```

**Solution:**
- Go to extension tab
- Upload photos and generate style profile first
- Refresh the shopping page

### Issue 2: "Chrome AI not available for product analysis"
**Symptom:**
```
❌ Chrome AI not available for product analysis
   window.ai: undefined
```

**Solution:**
- Check Chrome version (need 128+)
- Enable Chrome AI flags:
  - chrome://flags/#prompt-api-for-gemini-nano → Enabled
  - chrome://flags/#optimization-guide-on-device-model → Enabled BypassPerfRequirement
- Restart Chrome

### Issue 3: "AI model not readily available"
**Symptom:**
```
⚠️ AI model not readily available: after-download
```

**Solution:**
- AI model is downloading in background
- Wait 5-10 minutes
- Try again

### Issue 4: No overlays visible but analysis succeeds
**Symptom:**
```
✅ Added score overlay 8/10 for image 1
✅ Added score overlay 7/10 for image 2
```
But nothing visible on page.

**Debugging:**
1. Check if badges were created:
```javascript
document.querySelectorAll('[data-ai-style-score-badge]').length
// Should return number of products
```

2. Check badge styles:
```javascript
const badges = document.querySelectorAll('[data-ai-style-score-badge]');
badges.forEach((badge, i) => {
    console.log(`Badge ${i+1}:`, {
        display: badge.style.display,
        visibility: badge.style.visibility,
        zIndex: badge.style.zIndex,
        position: badge.style.position,
        top: badge.style.top,
        left: badge.style.left
    });
});
```

3. Check if badges are positioned correctly:
```javascript
const badges = document.querySelectorAll('[data-ai-style-score-badge]');
badges.forEach((badge, i) => {
    const rect = badge.getBoundingClientRect();
    console.log(`Badge ${i+1} position:`, {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        visible: rect.top >= 0 && rect.left >= 0
    });
});
```

### Issue 5: Analysis fails silently
**Symptom:**
```
🎯 analyzeDetectedProducts called
   Style profile: PRESENT
   Detected products: 12
```
Then nothing else.

**Debugging:**
1. Check for JavaScript errors in console (red text)
2. Look for specific error messages:
```
❌ Product analysis failed: [Error message]
   Error message: [Details]
   Error stack: [Stack trace]
```

3. Verify ProductAnalyzer is instantiated:
```javascript
window.styleFilter.productAnalyzer
// Should show ProductAnalyzer object
```

## Manual Testing Commands

Once on a shopping site, you can manually trigger analysis:

```javascript
// Check if style profile is loaded
console.log('Style Profile:', window.styleFilter.styleProfile);

// Check detected products
console.log('Detected Products:', window.styleFilter.detectedProducts.length);

// Manually trigger analysis
window.styleFilter.analyzeDetectedProducts();

// Check analysis results
console.log('Analysis Results:', window.styleFilter.productAnalysisResults);

// Check if badges exist in DOM
console.log('Score Badges:', document.querySelectorAll('[data-ai-style-score-badge]').length);

// Get cache stats
console.log('Cache Stats:', window.styleFilter.productAnalyzer.getCacheStats());
```

## Expected Timeline

For a page with 20 products:
- Detection: ~2-3 seconds
- Analysis: ~8-10 seconds total
  - Batch 1 (3 products): ~2 seconds
  - 500ms delay
  - Batch 2 (3 products): ~2 seconds
  - 500ms delay
  - ... (continues)
- Visual overlay creation: <1 second

**Total: ~12-15 seconds from page load to scores visible**

## Next Steps After Verification

Once we confirm scores are being generated correctly (logs show analysis succeeding), we can debug why overlays aren't visible. Possible issues:

1. **CSS positioning** - badges might be off-screen
2. **Z-index conflict** - site CSS might be covering badges
3. **Display/visibility** - badges might be hidden
4. **Parent element** - badges might be in wrong container

The detailed logs will tell us exactly where the process succeeds or fails!