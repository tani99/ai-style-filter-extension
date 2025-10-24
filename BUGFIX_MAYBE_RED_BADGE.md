# Bug Fix: "Maybe" Badge Showing Red Color

## Problem Description
When using the search/prompt feature, products correctly categorized as tier 1 ("No") in the logs were displaying as "Maybe" with a red background instead of the correct "No" text with red background.

## Root Cause
**Stale cached data from mode switching.**

When switching from Style Mode (1-10 scores) to Prompt Mode (1-3 tiers), old score values (like 7) were being reused instead of generating fresh tier values (1-3). This caused:

1. Score value = 7 (from previous style mode analysis)
2. isTierSystem = true (current mode is prompt)
3. Badge text = "Maybe" (because `tierLabels[7]` is undefined → fallback)
4. Badge color = Red (because 7 !== 3 and 7 !== 2 → else block for tier 1)

### Example from logs:
```javascript
score: 7  // ← Should be 1-3 for tier system!
mode: 'prompt'  // ← Tier system active
badgeText: 'Maybe'  // ← Wrong text
backgroundColor: 'rgb(239, 68, 68)'  // ← Red color
dataset: 'no'  // ← Wrong classification
```

## Fixes Applied

### 1. Clear ALL Caches When Switching Modes (ContentScriptManager.js)
**`handleApplyPrompt()`**
- Now clears `productAnalyzer.clearCache()` in addition to prompt cache
- Prevents stale 1-10 scores from being treated as 1-3 tiers
- Added comment explaining why this is CRITICAL

**`handleSwitchToStyleMode()`**
- Ensures `productAnalysisResults.clear()` forces fresh lookup
- Maintains style cache for performance but ensures fresh display

### 2. Safety Check for Invalid Tier Scores (VisualIndicators.js)
**`createScoreBadge()`**
- Added validation: if score < 1 or score > 3 when isTierSystem=true
- Logs error and falls back to tier 2 (neutral "Maybe" with orange)
- Prevents mismatched text/color combinations

### 3. Error Detection in Normalization (ContentScriptManager.js)
**`analyzeDetectedProducts()`**
- Added check for missing tier in prompt mode results
- Logs error if tier is undefined in prompt mode
- Falls back to tier 2 with error message

### 4. Enhanced Logging
Added detailed logging throughout the flow:
- Badge creation shows score, type, and tier determination
- Normalization shows tier → score conversion
- Visual indicators log all badge properties

## Testing
After reload:
1. Switch to prompt mode and enter a search query
2. Check console for logs showing:
   - `🔄 Normalizing product X: tier 1 -> score 1` (correct)
   - `❌ Creating TIER 1 (NO) badge - Red color` (correct)
   - `📛 Badge created: {text: "No", ...}` (correct)
3. Badge should now correctly show "No" in red (not "Maybe" in red)

## Files Modified
- `/extension/content/core/ContentScriptManager.js`
- `/extension/content/ui/VisualIndicators.js`
