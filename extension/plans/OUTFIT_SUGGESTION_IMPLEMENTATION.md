# Outfit Suggestion Feature - Implementation Guide

## 📋 Overview

Build a hover-based outfit suggestion system that shows how products from e-commerce sites pair with items from the user's existing wardrobe.

**Key Principle:** This feature is **read-only** for wardrobe items. The extension only reads wardrobe items from Firestore - no upload, edit, or delete functionality. However, AI analysis attributes are written back to Firestore for permanent storage and reuse.

---

## 🎯 What We're Building

When a user hovers over a product image on a shopping site:
1. System fetches their wardrobe from Firestore (already cached locally)
2. AI analyzes compatibility in two stages:
   - **Stage 1:** Fast attribute filtering (category, color, style)
   - **Stage 2:** Visual image analysis for final outfit
3. Styleboard overlay appears showing complete outfit composition

---

## 🏗️ Architecture

### Background Preprocessing (Runs Automatically)

Wardrobe items are preprocessed in the background so outfit matching is instant:

```
LOGIN / EXTENSION START
        ↓
[Fetch all wardrobe items from Firestore]
        ↓
[Check: Does item have aiAnalysis?]
   ↓ NO              ↓ YES
[Analyze via         [Skip, already
 Prompt API]          analyzed]
   ↓
[Store in Firestore permanently]
        ↓
[Real-time listener active]
        ↓
[New item added? Auto-analyze it]
```

**Result:** By the time user hovers on a product, all wardrobe items are already analyzed and ready to use.

### Two-Stage AI Matching Pipeline

```
Product Hover → [Product: Red Shirt]
                       ↓
┌─────────────────────────────────────────────────────────┐
│  STAGE 1: ATTRIBUTE FILTERING (~150ms)                  │
│  • Input: 50 wardrobe items                             │
│  • Category filter: Product is TOP → exclude all TOPS   │
│  • Color filter: Eliminate clashing colors              │
│  • Style filter: Eliminate severe mismatches            │
│  • Output: Shortlist of 5-10 compatible items           │
└─────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│  STAGE 2: VISUAL IMAGE MATCHING (~300ms)                │
│  • Input: Product image + shortlisted item images       │
│  • Pattern mixing compatibility                         │
│  • Color harmony assessment                             │
│  • Silhouette & proportion balance                      │
│  • Output: Best outfit with visual scores               │
└─────────────────────────────────────────────────────────┘
                       ↓
                  Final Outfit
         (Total time: ~450ms vs 5000ms)
```

### Data Sources

1. **Wardrobe Items (Read-Only):** Firestore → `chrome.storage.local.wardrobeItems` (managed by existing `FirestoreWardrobeManager.js`)
2. **Wardrobe AI Analysis (Read/Write):** Stored in Firestore under each item's `aiAnalysis` field, queried first before calculating
3. **Style Profile (Read-Only):** `chrome.storage.local.styleProfile` (existing)
4. **Product Analysis (Read-Only):** Cached from existing product detection system

---

## 📝 Implementation Steps

### Step 1: Automatic Background Wardrobe Analysis

**Goal:** Automatically analyze all wardrobe items in the background, triggered on login and when new items are added

**Files:** 
- `extension/background/background.js`
- `extension/services/FirestoreWardrobeManager.js`

**Tasks:**

#### 1.1: Set Up Firestore Listener for New Items

Add to `FirestoreWardrobeManager.js`:
```javascript
class FirestoreWardrobeManager {
  setupRealtimeAnalysisListener(userId) {
    // Listen for wardrobe changes in real-time
    this.wardrobeListener = db.collection('wardrobe')
      .where('userId', '==', userId)
      .onSnapshot(async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const item = change.doc.data();
            
            // Check if this item needs AI analysis
            if (!item.aiAnalysis) {
              console.log(`[Background] New item detected, analyzing: ${item.id}`);
              await this.analyzeItemInBackground(item);
            }
          }
        });
      });
  }

  async analyzeItemInBackground(item) {
    // Send to background script for AI analysis
    const analysis = await chrome.runtime.sendMessage({
      action: 'analyzeWardrobeItem',
      itemId: item.id,
      imageUrl: item.imageUrl,
      category: item.category
    });
    
    console.log(`[Background] Analysis complete for ${item.id}`);
  }
}
```

#### 1.2: Trigger Analysis on Login

Add to `background.js`:
```javascript
// Listen for authentication changes
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'userLoggedIn') {
    console.log('[Background] User logged in, starting wardrobe analysis...');
    await analyzeAllWardrobeItems(message.userId);
  }
});

async function analyzeAllWardrobeItems(userId) {
  // Get all wardrobe items from Firestore
  const wardrobeSnapshot = await db.collection('wardrobe')
    .where('userId', '==', userId)
    .get();
  
  const itemsNeedingAnalysis = [];
  wardrobeSnapshot.forEach(doc => {
    const item = doc.data();
    if (!item.aiAnalysis) {
      itemsNeedingAnalysis.push(item);
    }
  });

  console.log(`[Background] Found ${itemsNeedingAnalysis.length} items needing analysis`);

  // Analyze items one by one (rate limiting built in)
  for (const item of itemsNeedingAnalysis) {
    await analyzeWardrobeItem(item.id, item.imageUrl, item.category);
  }

  console.log('[Background] All wardrobe items analyzed');
}
```

#### 1.3: Add AI Analysis Handler

Add to `background.js`:
```javascript
case 'analyzeWardrobeItem':
  await analyzeWardrobeItem(message.itemId, message.imageUrl, message.category);
  return { success: true };

async function analyzeWardrobeItem(itemId, imageUrl, category) {
  // STEP 1: Check if analysis already exists in Firestore
  const itemDoc = await db.collection('wardrobe').doc(itemId).get();
  const existingData = itemDoc.data();
  
  if (existingData?.aiAnalysis) {
    console.log(`[Background] Item ${itemId} already has analysis, skipping`);
    return existingData.aiAnalysis;
  }

  // STEP 2: No analysis found, make AI call
  console.log(`[Background] Analyzing item ${itemId}...`);
  const prompt = `You are a fashion expert analyzing a clothing item.

IMAGE URL: ${imageUrl}
CATEGORY: ${category}

TASK: Analyze this item and provide attributes for outfit matching.

RESPOND WITH ONLY valid JSON:
{
  "colors": ["primary color", "secondary color"],
  "style": ["casual", "formal", "sporty"],
  "pattern": "solid/striped/floral/plaid",
  "formality": "casual/business casual/formal",
  "season": ["spring", "summer", "fall", "winter"],
  "versatility_score": 1-10,
  "description": "Brief description"
}`;

  const analysis = await handleAIPrompt({ action: 'aiPrompt', prompt });
  
  // STEP 3: Store analysis in Firestore for permanent reuse
  await db.collection('wardrobe').doc(itemId).update({
    aiAnalysis: analysis,
    aiAnalyzedAt: new Date().toISOString()
  });
  
  console.log(`[Background] Analysis saved for item ${itemId}`);
  return analysis;
}
```

#### 1.4: Initialize on Extension Load

Add to `background.js` initialization:
```javascript
// Run on extension startup (even if popup not opened)
chrome.runtime.onStartup.addListener(async () => {
  const { userId } = await chrome.storage.local.get('userId');
  if (userId) {
    console.log('[Background] Extension started, checking wardrobe...');
    await analyzeAllWardrobeItems(userId);
  }
});

// Also run when extension installed/updated
chrome.runtime.onInstalled.addListener(async () => {
  const { userId } = await chrome.storage.local.get('userId');
  if (userId) {
    await analyzeAllWardrobeItems(userId);
  }
});
```

**Key Benefits:**
- ✅ Runs automatically in background without user interaction
- ✅ Analyzes wardrobe on login
- ✅ Listens for new items and analyzes them immediately
- ✅ Works even if extension popup is never opened
- ✅ By the time user hovers on a product, wardrobe is ready

**Estimated Time:** 2-3 hours

---

### Step 2: Build Attribute Filter Service

**Goal:** Fast filtering to create shortlist (Stage 1)

**File:** `extension/services/AttributeFilter.js` (new)

**Tasks:**
1. Create category filtering logic:
```javascript
class AttributeFilter {
  determineNeededCategories(productCategory) {
    const rules = {
      'top': { needs: ['bottom', 'shoes'], optional: ['accessories'] },
      'bottom': { needs: ['top', 'shoes'], optional: ['accessories'] },
      'dress': { needs: ['shoes'], optional: ['accessories'] },
      'shoes': { needs: ['top', 'bottom'], alternative: ['dress'] }
    };
    return rules[productCategory];
  }

  async filterByAttributes(product, wardrobeItems) {
    // Send to background.js for AI filtering
    const response = await chrome.runtime.sendMessage({
      action: 'filterWardrobeItems',
      product: product.aiAnalysis,
      wardrobeItems: wardrobeItems.map(i => i.aiAnalysis)
    });

    return response.shortlist; // Returns indices
  }
}
```

2. Add `filterWardrobeItems` handler to background.js:
```javascript
case 'filterWardrobeItems':
  const filterPrompt = `You are a fashion expert performing initial outfit compatibility screening.

PRODUCT BEING CONSIDERED:
- Category: ${product.category}
- Colors: ${product.colors.join(', ')}
- Style: ${product.style.join(', ')}
- Pattern: ${product.pattern}

USER'S WARDROBE ITEMS:
${wardrobeItems.map((item, idx) => `
[${idx}] ${item.category.toUpperCase()}:
- Colors: ${item.colors.join(', ')}
- Style: ${item.style.join(', ')}
- Pattern: ${item.pattern}
`).join('\n')}

FILTERING TASK:
1. Apply category rules (product is ${product.category})
2. Eliminate clashing colors
3. Eliminate severe style mismatches
4. Keep complementary items

RESPOND WITH ONLY valid JSON:
{
  "shortlist": [0, 2, 5, 7],
  "eliminated": {
    "1": "Color clash reason",
    "3": "Style mismatch reason"
  }
}`;

  return await handleAIPrompt({ action: 'aiPrompt', prompt: filterPrompt });
```

3. Cache filtering results per product

**Estimated Time:** 2-3 hours

---

### Step 3: Build Visual Outfit Analyzer

**Goal:** Image-based matching for final outfit (Stage 2)

**File:** `extension/services/VisualOutfitAnalyzer.js` (new)

**Tasks:**
1. Use Chrome's Image Classifier API:
```javascript
class VisualOutfitAnalyzer {
  async analyzeVisualCompatibility(productImageUrl, shortlistedItems) {
    // Analyze product image
    const imageClassifier = await ai.imageClassifier.create();
    const productVisuals = await imageClassifier.classify(productImageUrl);

    // Analyze shortlisted wardrobe item images
    const itemVisuals = await Promise.all(
      shortlistedItems.map(item => imageClassifier.classify(item.imageUrl))
    );

    // Send visual data to Prompt API for outfit composition
    const response = await chrome.runtime.sendMessage({
      action: 'composeOutfitVisual',
      productVisuals,
      itemVisuals,
      shortlistedItems
    });

    return response;
  }
}
```

2. Add `composeOutfitVisual` handler to background.js:
```javascript
case 'composeOutfitVisual':
  const visualPrompt = `You are a professional stylist analyzing outfit visual compatibility.

PRODUCT:
- Category: ${product.category}
- Visual analysis: ${productVisuals}

SHORTLISTED WARDROBE ITEMS:
${shortlistedItems.map(item => `
ID: ${item.id}
- Category: ${item.category}
- Visual analysis: ${item.visuals}
`).join('\n')}

VISUAL CRITERIA:
1. Pattern mixing: Do patterns complement?
2. Color harmony: Cohesive palette?
3. Proportions: Balanced silhouettes?
4. Visual weight: Balanced composition?

RESPOND WITH ONLY valid JSON:
{
  "best_outfit": {
    "items": [
      { "id": "item_id", "category": "bottom", "visual_score": 92, "reasoning": "..." }
    ],
    "overall_confidence": 88,
    "visual_harmony_score": 90,
    "occasion": "weekend brunch, casual office",
    "why_it_works": "...",
    "composition_notes": "Try tucking the top"
  },
  "alternatives": []
}`;

  return await handleAIPrompt({ action: 'aiPrompt', prompt: visualPrompt });
```

**Estimated Time:** 3-4 hours

---

### Step 4: Create Outfit Matcher Service (Main Coordinator)

**Goal:** Orchestrate two-stage matching process

**File:** `extension/services/OutfitMatcher.js` (new)

**Tasks:**
1. Implement main matching function:
```javascript
class OutfitMatcher {
  async matchOutfit(product, styleProfile) {
    // Get cached wardrobe (already populated by FirestoreWardrobeManager)
    const { wardrobeItems } = await chrome.storage.local.get('wardrobeItems');

    if (!wardrobeItems || wardrobeItems.length === 0) {
      return {
        has_match: false,
        reason: "Build your wardrobe to get outfit suggestions"
      };
    }

    // STAGE 1: Attribute filtering
    const attributeFilter = new AttributeFilter();
    const shortlist = await attributeFilter.filterByAttributes(product, wardrobeItems);

    if (shortlist.length === 0) {
      return {
        has_match: false,
        reason: "No compatible items in your wardrobe",
        suggestion: "This product would pair well with [suggestion]"
      };
    }

    // STAGE 2: Visual matching
    const visualAnalyzer = new VisualOutfitAnalyzer();
    const outfit = await visualAnalyzer.analyzeVisualCompatibility(
      product.imageUrl,
      shortlist.map(idx => wardrobeItems[idx])
    );

    return {
      has_match: true,
      outfit: outfit.best_outfit,
      alternatives: outfit.alternatives
    };
  }
}
```

2. Add caching:
   - Cache outfit results per product (session-based)
   - Invalidate when wardrobe changes
   - Reuse product AI analysis from existing detection

3. Handle edge cases:
   - Empty wardrobe
   - Low visual scores
   - Multiple high-scoring outfits

**Estimated Time:** 2-3 hours

---

### Step 5: Add Hover Detection System

**Goal:** Trigger outfit matching on product hover

**File:** `extension/content/ui/HoverDetector.js` (new)

**Tasks:**
1. Implement smart hover detection:
```javascript
class HoverDetector {
  constructor() {
    this.hoverTimeout = null;
    this.currentProduct = null;
  }

  attachToProductImages(productImages) {
    productImages.forEach(img => {
      img.addEventListener('mouseenter', (e) => {
        this.hoverTimeout = setTimeout(async () => {
          const product = this.extractProductData(img);
          const outfitMatcher = new OutfitMatcher();
          const result = await outfitMatcher.matchOutfit(product);

          if (result.has_match) {
            this.showOverlay(result.outfit, img);
          } else {
            this.showNoMatchMessage(result.reason, img);
          }
        }, 300); // 300ms debounce
      });

      img.addEventListener('mouseleave', () => {
        clearTimeout(this.hoverTimeout);
        this.hideOverlay();
      });
    });
  }
}
```

2. Integrate with existing product detection:
   - Only enable on detected product images
   - Reuse product AI analysis (already cached)
   - Cancel pending requests on hover end

**Estimated Time:** 2 hours

---

### Step 6: Build Styleboard Overlay UI

**Goal:** Display outfit suggestions visually

**Files:**
- `extension/content/ui/StyleboardOverlay.js` (new)
- `extension/content/ui/styleboard-overlay.css` (new)

**Tasks:**
1. Create overlay component:
```javascript
class StyleboardOverlay {
  show(outfit, productElement) {
    const overlay = document.createElement('div');
    overlay.className = 'outfit-styleboard-overlay';
    overlay.innerHTML = `
      <div class="outfit-header">Outfit Suggestion</div>
      <div class="outfit-grid">
        ${outfit.items.map(item => `
          <div class="outfit-item">
            <img src="${item.imageUrl}" alt="${item.category}">
            <span>${item.category}</span>
            <span class="score">${item.visual_score}%</span>
          </div>
        `).join('')}
      </div>
      <div class="outfit-score">Match: ${outfit.overall_confidence}%</div>
      <div class="outfit-notes">${outfit.composition_notes}</div>
    `;

    // Position near product
    this.positionOverlay(overlay, productElement);
    document.body.appendChild(overlay);
  }
}
```

2. Design overlay layout:
   - Pinterest/Polyvore style grid
   - Product + wardrobe items
   - Visual scores and styling notes
   - Smooth fade-in animation

3. Handle different states:
   - Loading: Skeleton/shimmer animation
   - Success: Show outfit
   - No matches: Helpful message
   - Empty wardrobe: Guide to add items

4. Implement smart positioning:
   - Prefer right side placement
   - Fall back to left/top/bottom
   - Keep fully visible in viewport
   - Responsive on mobile

**Estimated Time:** 3-4 hours

---

### Step 7: Add User Settings

**Goal:** Let users control outfit suggestion behavior

**Files:**
- `extension/popup/popup.html`
- `extension/popup/popup.js`

**Tasks:**
1. Add settings UI in popup:
```html
<div class="settings-section">
  <h3>Outfit Suggestions</h3>
  <label>
    <input type="checkbox" id="outfitEnabled" checked>
    Enable outfit suggestions on hover
  </label>
  <label>
    Hover delay: <input type="range" id="hoverDelay" min="100" max="1000" value="300">
    <span id="delayValue">300ms</span>
  </label>
  <label>
    Minimum match score: <input type="range" id="minScore" min="50" max="90" value="70">
    <span id="scoreValue">70%</span>
  </label>
</div>
```

2. Update storage schema:
```javascript
{
  outfitSettings: {
    enabled: true,
    hoverDelay: 300,
    minMatchScore: 70,
    overlayPosition: 'auto',
    showMatchScore: true
  }
}
```

**Estimated Time:** 1-2 hours

---

### Step 8: Testing & Refinement

**Goal:** Ensure quality across scenarios

**Test Cases:**

1. **Background Analysis System:**
   - ✅ Analysis runs automatically on login
   - ✅ Analysis runs on extension startup (even without popup)
   - ✅ Firestore listener detects new items in real-time
   - ✅ Only analyzes items missing `aiAnalysis` field
   - ✅ AI analysis stored in Firestore permanently
   - ✅ Multiple items analyzed sequentially (rate limiting)
   - ✅ Console logs show progress

2. **Wardrobe Integration:**
   - ✅ Firestore connection works
   - ✅ Wardrobe data syncs correctly
   - ✅ Empty wardrobe handled gracefully
   - ✅ Works across devices (analysis stored in Firestore)

3. **Two-Stage Matching:**
   - ✅ Stage 1 filters correctly by category/color/style
   - ✅ Stage 2 provides visual analysis
   - ✅ Complete outfits suggested (top+bottom+shoes OR dress+shoes)
   - ✅ "No match" feedback is decisive and helpful

4. **Hover & Overlay:**
   - ✅ Debounce works (300ms delay)
   - ✅ Overlay positions correctly on all screen sizes
   - ✅ Works on Zara, H&M, Nike
   - ✅ Cancels on hover end

5. **Performance:**
   - ✅ Hover-to-overlay < 500ms
   - ✅ Handles 50+ wardrobe items smoothly
   - ✅ Cache hit rate > 80%
   - ✅ Memory usage < 50MB

6. **Edge Cases:**
   - ✅ Only accessories in wardrobe
   - ✅ Only shoes in wardrobe
   - ✅ All items same color
   - ✅ Firestore authentication errors

**Estimated Time:** 2-3 hours

---

## 🔧 Key Technical Details

### AI Infrastructure (Reusing Existing)
- **Prompt API:** Same pattern as style profile generation (background.js)
- **Image Classifier API:** `ai.imageClassifier.create()` for visual analysis
- **JSON Parsing:** Reuse `parseStyleAnalysisResponse()` pattern
- **Error Handling:** Reuse retry logic and fallback mechanisms

### Data Flow

**Background Analysis (Automatic):**
```
User logs in / Extension starts
  → FirestoreWardrobeManager fetches all wardrobe items
  → Check each item for aiAnalysis field
  → If missing: analyzeWardrobeItem() via Prompt API
  → Store result in Firestore permanently
  → Real-time listener detects new items
  → Auto-analyze new items as they're added
```

**Outfit Matching (On Hover):**
```
User hovers product
  → HoverDetector (content script)
  → Get wardrobeItems from chrome.storage.local (with aiAnalysis already populated)
  → OutfitMatcher.matchOutfit()
  → Stage 1: AttributeFilter (background.js Prompt API)
  → Stage 2: VisualOutfitAnalyzer (Image Classifier + Prompt API)
  → StyleboardOverlay.show()
```

### Firestore Integration
- ✅ Use existing `FirestoreWardrobeManager.js`
- ✅ Items already cached in `chrome.storage.local.wardrobeItems`
- ✅ Real-time sync already implemented
- ✅ **WRITE** AI analysis results back to Firestore (permanent storage)
- ✅ **QUERY** AI analysis from Firestore first before making new AI calls
- ❌ **NO** wardrobe item upload/edit/delete functionality
- ❌ **NO** wardrobe management UI in extension

### Performance Optimizations
- Store wardrobe item AI analysis in Firestore (permanent, never recalculate)
- Query Firestore first, only make AI calls if analysis missing
- Cache outfit suggestions (session-based)
- Reuse product detection results
- Debounce hover (300ms)
- Cancel in-flight requests
- Lazy load overlay images

---

## 📊 Timeline

| Step | Description | Time |
|------|-------------|------|
| 1 | Automatic background wardrobe analysis | 2-3 hours |
| 2 | Attribute filter service | 2-3 hours |
| 3 | Visual outfit analyzer | 3-4 hours |
| 4 | Outfit matcher service | 2-3 hours |
| 5 | Hover detection | 2 hours |
| 6 | Styleboard overlay UI | 3-4 hours |
| 7 | User settings | 1-2 hours |
| 8 | Testing & refinement | 2-3 hours |

**Total:** 17-24 hours

---

## ✅ Success Criteria

- [x] Extension reads wardrobe from Firestore (read-only)
- [x] Wardrobe AI analysis runs automatically in background on login
- [x] Firestore listener detects and analyzes new items in real-time
- [x] Analysis works even if extension popup never opened
- [x] Hover triggers outfit suggestion within 500ms
- [x] Two-stage matching provides accurate suggestions
- [x] Visual AI analyzes image compatibility
- [x] Overlay displays complete outfit with scores
- [x] Decisive feedback when no matches exist
- [x] Works seamlessly on all supported sites
- [x] Performance smooth with 50+ wardrobe items

---

## 🚀 Getting Started

**Step 1:** Verify `FirestoreWardrobeManager.js` is working and fetching wardrobe items
**Step 2:** Set up automatic background analysis (runs on login, listens for new items)
**Step 3:** Test that wardrobe items are being analyzed and stored in Firestore automatically
**Step 4:** Build two-stage matching pipeline (attribute filter + visual analyzer)
**Step 5:** Create hover detection and overlay UI
**Step 6:** Test end-to-end on live sites

---

## 📌 Critical Rules

1. **WARDROBE ITEMS ARE READ-ONLY** - Never create/modify/delete wardrobe items from extension
2. **AI ANALYSIS IS WRITTEN TO FIRESTORE** - Store analysis permanently, query first before calculating
3. **Use existing infrastructure** - Reuse Prompt API, Image Classifier, caching patterns
4. **Two-stage matching** - Attribute filter first, then visual analysis
5. **Performance matters** - Target < 500ms hover-to-overlay
6. **Be decisive** - Clear "no match" messages, no wishy-washy suggestions
