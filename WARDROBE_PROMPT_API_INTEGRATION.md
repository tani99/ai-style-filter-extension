# Wardrobe Outfit Suggestion - Prompt API Integration

## Overview
This document summarizes how the wardrobe outfit suggestion feature will use Chrome's Prompt API (same as style profile generation) instead of simpler rule-based matching.

## Key Design Decisions

### 1. Consistent AI Architecture
All AI analysis in the extension now flows through the **Prompt API** (ai.createTextSession):
- ✅ Style profile generation (existing)
- ✅ Wardrobe item analysis (new)
- ✅ Outfit matching (new)

### 2. Message Flow Pattern (Reusing Existing Infrastructure)

**Current Pattern (Style Profile):**
```javascript
// tab.js → background.js
const response = await chrome.runtime.sendMessage({
    action: 'aiPrompt',
    prompt: stylePrompt,
    options: { temperature: 0.7, maxRetries: 3 }
});

// background.js handles:
// - AI session creation
// - Error handling & retries
// - Response parsing
```

**New Patterns (Wardrobe):**

**Pattern A: Fetch Wardrobe from Firestore (Read-Only)**
```javascript
// WardrobeService.js → Firestore
const wardrobeItems = await getWardrobeFromFirestore(userId);

// If AI analysis not in Firestore, analyze on-demand:
const response = await chrome.runtime.sendMessage({
    action: 'analyzeWardrobeItem',
    imageUrl: item.imageUrl,
    category: item.category,
    options: { temperature: 0.7 }
});

// background.js:
// 1. Constructs wardrobe analysis prompt (using imageUrl)
// 2. Calls existing aiPrompt handler
// 3. Returns structured JSON with colors, style, pattern, etc.
// 4. Cache analysis result locally
```

**Pattern B: Outfit Matching**
```javascript
// content script (on hover) → background.js
const response = await chrome.runtime.sendMessage({
    action: 'matchOutfit',
    product: { category: 'top', aiAnalysis: {...} },
    wardrobeItems: [...],
    styleProfile: {...}
});

// background.js:
// 1. Constructs outfit matching prompt with rich context
// 2. Calls existing aiPrompt handler
// 3. Returns outfit suggestion with reasoning
```

## Prompt Engineering Strategy

### Wardrobe Item Analysis Prompt
```javascript
`You are a fashion expert analyzing a clothing item.

TASK: Analyze this ${category} item and provide detailed attributes.

RESPOND WITH ONLY valid JSON:
{
  "colors": ["primary color", "secondary color"],
  "style": ["casual", "formal", "sporty"],
  "pattern": "solid/striped/floral/plaid",
  "season": ["spring", "summer", "fall", "winter"],
  "formality": "casual/business casual/formal",
  "description": "Brief description",
  "versatility_score": 1-10
}`
```

### Outfit Matching Prompt
```javascript
`You are an expert fashion stylist. A user is browsing for ${productCategory} online.

USER'S STYLE PROFILE:
${JSON.stringify(userStyleProfile, null, 2)}

PRODUCT BEING CONSIDERED:
- Category: ${productCategory}
- Colors: ${productColors}
- Style: ${productStyle}

USER'S WARDROBE ITEMS:
${wardrobeItems.map(item => `
ID: ${item.id}
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
    "product": "how product fits in outfit",
    "top": "wardrobe item ID or null",
    "bottom": "wardrobe item ID or null",
    "dress": "wardrobe item ID or null",
    "shoes": "wardrobe item ID (required)",
    "accessories": ["item IDs"],
    "confidence_score": 85,
    "reasoning": "Why this outfit works",
    "occasion": "casual/business/formal"
  },
  "no_match_reason": "Why no good outfit exists (if has_match is false)",
  "missing_categories": ["What user should add to wardrobe"]
}`
```

## Why Prompt API Instead of Rule-Based Matching?

### Advantages of AI-Powered Analysis:
1. **Nuanced Understanding**: AI understands subtle style compatibility (e.g., "vintage denim pairs well with modern minimalist tops")
2. **Context-Aware**: Considers user's personal style profile for personalized suggestions
3. **Natural Reasoning**: Provides human-like explanations ("This works because the earth tones complement each other")
4. **Handles Edge Cases**: Gracefully handles unusual items or style combinations
5. **Evolving Intelligence**: Benefits from Chrome AI model improvements over time

### What We Avoid with AI:
- ❌ Hardcoded color harmony rules that miss nuance
- ❌ Rigid style category matching (formal with formal only)
- ❌ Complex pattern mixing algorithms
- ❌ Maintenance burden of rule updates

## Code Reuse from Style Profile Generation

### From tab.js (lines 211-407):
- ✅ **Prompt construction pattern**: Similar structure with clear instructions
- ✅ **JSON response parsing** (parseStyleAnalysisResponse): Strip markdown, extract JSON
- ✅ **Fallback handling** (createFallbackProfile): Graceful degradation when parsing fails
- ✅ **Error handling**: Retry logic, user-friendly error messages
- ✅ **Storage patterns**: Consistent schema design

### From background.js (existing aiPrompt handler):
- ✅ **AI session management**: createTextSession, prompt execution
- ✅ **Retry logic**: Automatic retries on failure
- ✅ **Error categorization**: Different errors get different handling
- ✅ **Performance optimization**: Session reuse, caching

## Implementation Checklist

### Step 1: Firestore Integration (Read-Only)
- [ ] Create `WardrobeService.js`
  - Implement Firestore authentication check
  - Implement `getAllItems()` - fetch wardrobe from Firestore
  - Implement `getItemsByCategory(category)` - filter by category
  - Add local caching (refresh every 5 minutes)
  - NO upload/delete/edit methods

- [ ] Add `analyzeWardrobeItem` handler in background.js
  - Constructs wardrobe analysis prompt (if Firestore lacks AI data)
  - Calls existing `aiPrompt` handler
  - Returns structured wardrobe item analysis
  - Cache analysis results locally

### Step 2: Outfit Matching
- [ ] Add `matchOutfit` handler in background.js
  - Constructs outfit matching prompt with context
  - Calls existing `aiPrompt` handler
  - Returns outfit suggestion with reasoning

### Step 3: OutfitMatcher.js Service
- [ ] Implement `matchOutfit()` method
  - Fetches wardrobe from WardrobeService
  - Gathers context: product, wardrobe, style profile
  - Sends message to background.js
  - Parses AI response
  - Validates outfit completeness

- [ ] Implement caching layer
  - Cache outfit suggestions per product
  - Invalidate cache when wardrobe refreshes from Firestore

- [ ] Handle edge cases
  - Empty wardrobe (no items in Firestore)
  - Incomplete wardrobe
  - No good matches
  - Firestore authentication errors

### Step 4: Integration with Content Script
- [ ] Add hover detection for products
- [ ] Trigger outfit matching on hover
- [ ] Display styleboard overlay with AI suggestions
- [ ] Show loading states during AI processing

## Performance Considerations

### AI Request Optimization:
1. **Fetch wardrobe from Firestore**: Load once, cache for 5 minutes, refresh in background
2. **Analyze wardrobe items on-demand**: Only analyze if Firestore lacks AI attributes
3. **Cache AI analysis**: Store wardrobe item analysis locally, persist across sessions
4. **Reuse product detection**: Don't re-analyze products already detected
5. **Session-based caching**: Cache outfit suggestions during browsing session
6. **Debounced hover**: Wait 300ms before triggering outfit matching
7. **Cancel in-flight requests**: Cancel if user hovers away

### Expected Timing:
- Firestore fetch: ~200-500ms (first load, then cached)
- Wardrobe item analysis: ~1-2 seconds (only if not in Firestore, then cached)
- Outfit matching: ~300-500ms (cached wardrobe + cached product = fast prompt)
- Overlay display: <100ms (instant once AI responds)

## Success Metrics

### Technical:
- ✅ Reuses existing AI infrastructure (no duplicate code)
- ✅ Consistent error handling across all AI features
- ✅ <500ms outfit suggestions (90th percentile)
- ✅ >80% cache hit rate for repeated products

### User Experience:
- ✅ Decisive feedback (clear yes/no on outfit match)
- ✅ Helpful reasoning (explains why outfit works)
- ✅ Personalized suggestions (considers user's style profile)
- ✅ Graceful failures (helpful messages when no matches)

## Next Steps

1. **Review and approve this plan** with user
2. **Implement Step 1**: Background.js message handlers
3. **Implement Step 2**: WardrobeManager service
4. **Implement Step 3**: OutfitMatcher service
5. **Implement Step 4**: Content script integration
6. **Test end-to-end** on live e-commerce sites
7. **Iterate based on** AI response quality and user feedback
