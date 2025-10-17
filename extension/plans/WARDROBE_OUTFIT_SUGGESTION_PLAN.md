# Wardrobe Outfit Suggestion Implementation Plan

## Overview
Implement a hover-based outfit suggestion system that displays a styleboard overlay showing how a product from an e-commerce site would pair with items from the user's existing wardrobe.

## Feature Requirements

### Core Functionality
- **Hover Detection**: Detect when user hovers over a product image on supported sites
- **Wardrobe Matching**: AI-powered analysis to find compatible items from user's wardrobe
- **Outfit Completeness**: Ensure minimum outfit requirements (top + bottom + shoes OR dress + shoes)
- **Decisive Feedback**: Provide clear "no good matches" message when wardrobe lacks compatible items
- **Accessory Suggestions**: Include accessories only when they complement the outfit

### Visual Design
- **Styleboard Overlay**: Pinterest/Polyvore-style outfit board positioned near hovered product
- **Product Integration**: Show the hovered product image within the outfit composition
- **Responsive Positioning**: Overlay appears next to product without blocking it
- **Loading States**: Show loading indicator while AI analyzes compatibility

## Implementation Steps

### Step 1: Leverage Existing Firestore Wardrobe Integration

**Files to Use (Already Implemented):**
- ✅ `extension/services/FirestoreWardrobeManager.js` - Already handles Firestore read operations
- ✅ Firebase libraries in `extension/lib/firebase/` - Already configured
- ✅ Real-time sync with local caching - Already implemented

**Existing Firestore Schema (Confirmed):**
```javascript
// Collection: 'wardrobeItems' (flat structure with userId field)
{
  id: string,              // Firestore document ID
  userId: string,          // User ID for filtering
  imageUrl: string,        // URL to wardrobe item image
  category: string,        // Category (e.g., 'top', 'bottom', 'dress', 'shoes', 'accessory')
  name: string,            // Item name
  tags: string[],          // User-defined tags
  style: string[],         // Style attributes (may exist)
  // Additional fields as stored in Firestore
}

// Collection: 'looks' (saved outfit combinations)
{
  id: string,
  userId: string,
  items: string[],         // Array of wardrobe item IDs
  // Other look metadata
}
```

**Tasks:**
1. **Use existing FirestoreWardrobeManager**:
   - ✅ Already caches items in `chrome.storage.local` under `wardrobeItems`
   - ✅ Already has real-time sync via Firestore listeners
   - ✅ Already filters by category via `getItems(userId, { category: 'top' })`
   - ✅ Already provides `getCachedData()` for fast access

2. **Add AI analysis for wardrobe items** (only if Firestore lacks attributes):
   - Create prompt template for analyzing wardrobe item images
   - Store AI analysis results locally (in cache, not back to Firestore - read-only)
   - Use cached AI analysis for outfit matching

3. **AI Prompt Template for Wardrobe Item Analysis**:
```javascript
const wardrobeItemPrompt = `You are a fashion expert analyzing a clothing item from an image URL.

IMAGE URL: ${imageUrl}
CATEGORY: ${category}

TASK: Analyze this item and provide detailed attributes for outfit matching.

RESPOND WITH ONLY valid JSON:
{
  "colors": ["primary color", "secondary color"],
  "style": ["casual", "formal", "sporty"],
  "pattern": "solid/striped/floral/plaid",
  "season": ["spring", "summer", "fall", "winter"],
  "formality": "casual/business casual/formal",
  "description": "Brief description",
  "versatility_score": 1-10
}`;
```

4. **Add background message handler**:
   - Add `analyzeWardrobeItem` handler (if AI attributes missing from Firestore)
   - Add `matchOutfit` handler for outfit suggestions
   - NO wardrobe CRUD handlers (FirestoreWardrobeManager already handles reads)

### Step 2: AI-Powered Outfit Matching Engine (Using Prompt API)

**Files to Create:**
- `extension/services/OutfitMatcher.js` (new)

**Tasks:**
1. Design Prompt API-based outfit analysis system (similar to style profile generation):
   - Use Chrome's Prompt API (ai.createTextSession) for outfit compatibility reasoning
   - Leverage same AI infrastructure as existing style profile generation
   - Provide rich context to AI: product details, wardrobe item descriptions, user's style profile
   - Request structured JSON responses with outfit combinations and reasoning

2. Create AI prompt template for outfit matching:
```javascript
const outfitPrompt = `You are an expert fashion stylist. A user is browsing for [PRODUCT_CATEGORY] online.

USER'S STYLE PROFILE:
${JSON.stringify(userStyleProfile, null, 2)}

PRODUCT BEING CONSIDERED:
- Category: ${productCategory}
- Image analysis: ${productAIAnalysis}

USER'S WARDROBE ITEMS:
${wardrobeItems.map(item => `
- Category: ${item.category}
- Colors: ${item.aiAnalysis.colors.join(', ')}
- Style: ${item.aiAnalysis.style.join(', ')}
- Pattern: ${item.aiAnalysis.pattern}
- Formality: ${item.aiAnalysis.formality}
`).join('\n')}

TASK: Create a complete outfit using this product + items from the wardrobe.

RULES:
1. Outfit must include: top + bottom + shoes OR dress + shoes
2. Accessories only if they genuinely enhance the outfit
3. Consider color harmony, style consistency, formality matching
4. Be decisive - if no good combinations exist, say so clearly

RESPOND WITH ONLY valid JSON:
{
  "has_match": true/false,
  "outfit": {
    "product": "[how product fits in outfit]",
    "top": "[wardrobe item ID or null]",
    "bottom": "[wardrobe item ID or null]",
    "dress": "[wardrobe item ID or null]",
    "shoes": "[wardrobe item ID]",
    "accessories": ["item IDs"],
    "confidence_score": 85,
    "reasoning": "Why this outfit works - color harmony, style coherence",
    "occasion": "casual daytime/business casual/evening/etc"
  },
  "no_match_reason": "Why no good outfit exists (if has_match is false)",
  "missing_categories": ["What user should add to wardrobe"]
}`;
```

3. Implement outfit composition algorithm using AI responses:
   - Send product + wardrobe to Prompt API
   - Parse AI's structured JSON response
   - Validate outfit completeness (minimum requirements met)
   - Map wardrobe item IDs back to actual items
   - Handle AI parsing errors with fallback logic

4. Add caching for AI outfit suggestions:
   - Cache AI responses per product (avoid re-analyzing same product)
   - Invalidate cache when wardrobe changes
   - Session-based caching (clear on page reload)

5. Handle edge cases with AI assistance:
   - Empty wardrobe → Prompt AI: "What type of item would pair well with this [product]?"
   - Incomplete wardrobe → AI suggests missing categories
   - No good matches → AI provides decisive feedback: "Your current wardrobe has [style], but this product is [different_style]"
   - Multiple good matches → AI ranks by confidence score, show best option

### Step 3: Hover Detection System

**Files to Modify:**
- `extension/content/ui/HoverDetector.js` (new)
- `extension/content/content-consolidated.js`

**Tasks:**
1. Implement smart hover detection:
   - Debounce hover events (300ms delay to avoid flickering)
   - Track mouse position relative to product images
   - Cancel pending requests if user moves to different product
   - Handle rapid hover movements gracefully

2. Integrate with existing product detection system:
   - Only enable hover on detected product images (reuse existing detection logic)
   - Ignore non-product images
   - Site-specific hover boundaries using existing SiteConfigurations

3. Trigger outfit matching on hover:
   - Extract product image data
   - Send to AI for quick product analysis
   - Query OutfitMatcher for wardrobe suggestions
   - Display overlay with results

### Step 4: Styleboard Overlay UI

**Files to Create:**
- `extension/content/ui/StyleboardOverlay.js` (new)
- `extension/content/ui/styleboard-overlay.css` (new)

**Tasks:**
1. Design overlay layout:
   ```
   ┌─────────────────────────┐
   │  Outfit Suggestion      │
   ├─────────────────────────┤
   │  ┌─────┐  ┌─────┐       │
   │  │ Top │  │Hovered      │
   │  │     │  │Product│     │
   │  └─────┘  └─────┘       │
   │  ┌─────┐  ┌─────┐       │
   │  │Bottom  │Shoes│       │
   │  └─────┘  └─────┘       │
   │  ┌─────┐                │
   │  │Access│                │
   │  └─────┘                │
   │                         │
   │  Match Score: 85%       │
   └─────────────────────────┘
   ```

2. Implement overlay component:
   - Floating card with shadow and border
   - Grid layout for outfit items
   - Responsive sizing based on viewport
   - Smooth fade-in animation
   - Auto-positioning to avoid going off-screen

3. Handle different states:
   - Loading state: Skeleton/shimmer animation
   - Success state: Show outfit with items
   - No matches state: "No compatible items in your wardrobe. This [product] would pair well with [description]. Consider adding these to your wardrobe!"
   - Empty wardrobe state: "Build your wardrobe to get outfit suggestions"

4. Add interactive elements:
   - Hover over wardrobe items to see details
   - Click wardrobe items to view in extension tab
   - "Save Outfit" button to bookmark combinations
   - "Shop Missing Items" suggestion

### Step 5: Overlay Positioning Logic

**Files to Modify:**
- `extension/content/utils/OverlayPositioner.js` (new)

**Tasks:**
1. Implement smart positioning algorithm:
   - Calculate available space around hovered product
   - Prefer right side placement (left for RTL languages)
   - Fall back to left, bottom, top if no space
   - Keep overlay fully visible in viewport
   - Account for scroll position

2. Handle viewport boundaries:
   - Detect screen edges
   - Reposition overlay to stay on screen
   - Adjust arrow/pointer direction based on position

3. Responsive behavior:
   - Smaller overlay on mobile viewports
   - Simplified layout for narrow screens
   - Touch-friendly close button on mobile

### Step 6: Performance Optimizations

**Files to Modify:**
- `extension/content/ai/AnalysisCache.js` (extend existing)
- `extension/services/OutfitMatcher.js`

**Tasks:**
1. Implement multi-level caching:
   - Cache product AI analysis (already being hovered on)
   - Cache outfit combinations for same product
   - Cache wardrobe item compatibility scores
   - Cache duration: 24 hours for product analysis, session-based for outfits

2. Optimize AI requests:
   - Cache wardrobe data fetched from Firestore (refresh periodically, e.g., every 5 minutes)
   - Analyze wardrobe items once (cache AI analysis results)
   - Reuse existing product detection AI results
   - Lazy load overlay images
   - Cancel in-flight requests when hover ends

3. Debounce and throttle:
   - Debounce hover trigger (300ms)
   - Throttle overlay repositioning on scroll (100ms)
   - Rate limit AI analysis requests

### Step 7: User Preferences & Settings

**Files to Modify:**
- `extension/popup/popup.html`
- `extension/popup/popup.js`
- Storage schema

**Tasks:**
1. Add outfit suggestion settings:
   - Enable/disable outfit suggestions toggle
   - Hover delay adjustment (100ms - 1000ms)
   - Minimum match score threshold (50-90)
   - Preferred overlay position (right/left/auto)
   - Show/hide match score in overlay

2. Add to storage schema:
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

### Step 8: Analytics & Insights

**Files to Create:**
- `extension/services/OutfitAnalytics.js` (new)

**Tasks:**
1. Track outfit suggestion metrics (local only, no external tracking):
   - Number of outfit suggestions shown
   - User interactions (clicks, saves)
   - Match score distribution
   - Most used wardrobe items
   - Gap analysis (missing categories)

2. Provide insights in extension tab:
   - "Your most versatile item: [item]"
   - "Add [category] items to unlock more outfit suggestions"
   - "Your wardrobe works best for [style] looks"

### Step 9: Testing & Refinement

**Test Cases:**
1. **Wardrobe Integration:**
   - Verify Firestore connection and authentication
   - Confirm wardrobe data fetching works correctly
   - Test with empty wardrobe (no items in Firestore)
   - Test with populated wardrobe (various categories)

2. **Hover Behavior:**
   - Hover on different product types (tops, bottoms, dresses, shoes)
   - Test rapid hover movements
   - Verify debounce and cancellation

3. **Outfit Matching:**
   - Complete wardrobe → should always suggest outfits
   - Incomplete wardrobe → should provide helpful feedback
   - Empty wardrobe → should guide user to add items
   - Edge cases: only accessories, only shoes, only tops

4. **Overlay Positioning:**
   - Test on different screen sizes
   - Verify positioning near viewport edges
   - Test on all supported sites (Zara, H&M, Nike)
   - Mobile responsiveness

5. **Performance:**
   - Test with large wardrobe (50+ items)
   - Verify caching effectiveness
   - Monitor memory usage
   - Check animation smoothness

6. **User Experience:**
   - Clarity of "no matches" messages
   - Helpfulness of suggestions
   - Loading state visibility
   - Overlay dismiss behavior

## Integration with Existing Systems

### Leveraging Current AI Infrastructure
This feature builds directly on the existing AI architecture:

1. **Reuse Prompt API Pattern** (from tab.js style profile generation):
   - Send messages to background.js via `chrome.runtime.sendMessage({ action: 'aiPrompt', prompt, options })`
   - Background.js handles AI session creation and response parsing
   - Same error handling, retry logic, and fallback mechanisms
   - Consistent structured JSON response format

2. **Reuse Product Detection Results**:
   - Content script already analyzes product images for style matching
   - Wardrobe outfit matcher can access these cached AI analyses
   - No need to re-analyze product images when hovering

3. **Integrate with Style Profile**:
   - User's style profile (already stored in chrome.storage.local) provides context
   - AI uses style profile to make personalized outfit suggestions
   - Wardrobe items can be matched against user's preferred colors, styles, patterns

4. **Message Flow**:
```
Content Script (hover)
  → Extract product image + cached AI analysis
  → Send to background: chrome.runtime.sendMessage({
      action: 'matchOutfit',
      product: {...},
      wardrobeItems: [...],
      styleProfile: {...}
    })

Background Script
  → Construct outfit matching prompt
  → Call aiPrompt handler (existing infrastructure)
  → Return structured outfit suggestion

Content Script
  → Display styleboard overlay with outfit
```

## Technical Considerations

### AI Model Usage (Consistent with Existing Architecture)
- **Wardrobe Analysis**: Use Chrome's **Prompt API** (ai.createTextSession) to analyze uploaded items - same as style profile generation
- **Product Analysis**: Reuse existing product detection AI results from content script
- **Outfit Matching**: Use **Prompt API** to evaluate compatibility with rich reasoning and structured JSON output
- **User Style Integration**: Pass user's existing style profile to outfit matching AI for personalized suggestions
- **Consistent AI Infrastructure**: All AI analysis flows through background.js's `aiPrompt` message handler (same pattern as style profile generation)

### Code Reuse Opportunities
- **JSON Parsing**: Reuse `parseStyleAnalysisResponse()` pattern from tab.js (lines 317-355) for parsing outfit AI responses
- **Fallback Profiles**: Similar fallback logic when AI returns malformed JSON
- **Storage Patterns**: Follow same storage schema patterns as `userPhotos` and `styleProfile`
- **Error Handling**: Reuse error states and retry mechanisms from style analysis
- **Prompt Engineering**: Apply same "RESPOND WITH ONLY valid JSON" instruction pattern

### Performance Targets
- Hover-to-overlay: < 500ms (including AI analysis)
- Overlay rendering: < 100ms
- Maximum memory usage: < 50MB additional for wardrobe data
- Cache hit rate: > 80% for repeated products

### Privacy & Security
- All data stored locally in chrome.storage.local
- No external API calls
- No tracking or analytics sent externally
- User controls all wardrobe data

### Accessibility
- Keyboard navigation support for overlay
- ARIA labels for screen readers
- High contrast mode compatibility
- Focus management when overlay appears

## File Structure After Implementation

```
/extension/
├── services/
│   ├── WardrobeService.js          # Read-only Firestore wardrobe access
│   ├── OutfitMatcher.js            # AI outfit matching logic
│   └── OutfitAnalytics.js          # Local analytics tracking
├── content/
│   └── ui/
│       ├── HoverDetector.js        # Hover event management
│       ├── StyleboardOverlay.js    # Overlay component
│       └── styleboard-overlay.css  # Overlay styling
│   └── utils/
│       └── OverlayPositioner.js    # Smart positioning logic
└── (existing structure)
```

**Note**: No wardrobe management UI is added to the extension tab. The wardrobe is managed externally and the extension only reads from Firestore.

## Implementation Timeline Estimate

- **Step 1** (Firestore Integration): 2-3 hours
- **Step 2** (AI Matching Engine): 3-4 hours
- **Step 3-5** (Hover & Overlay UI): 4-5 hours
- **Step 6** (Performance): 1-2 hours
- **Step 7** (Settings): 1 hour
- **Step 8** (Analytics): 1-2 hours
- **Step 9** (Testing): 2-3 hours

**Total**: 14-20 hours of development time

**Time Saved**: ~2 hours (no wardrobe upload/management UI needed)

## Success Criteria

✅ Extension successfully fetches wardrobe items from Firestore (read-only)
✅ Hovering on a product triggers outfit suggestion within 500ms
✅ AI accurately matches compatible wardrobe items (>80% user satisfaction)
✅ Overlay displays complete outfits with proper item coverage
✅ System provides decisive feedback when no matches exist
✅ Performance remains smooth with 50+ wardrobe items
✅ Works seamlessly across all supported e-commerce sites
✅ Graceful handling when user has no wardrobe items in Firestore
