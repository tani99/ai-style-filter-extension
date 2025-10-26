# Visual Overlay System Requirements

## Overview
The visual overlay system provides visual feedback on e-commerce product images to indicate:
1. Which items have been detected as clothing
2. Style compatibility scores for each item
3. Virtual try-on functionality

## Core Requirements

### 1. Green Border Overlays (Detection Indicators)

**Purpose**: Show users which product images have been detected as clothing items

**Visual Appearance**:
- 3px solid green border (#10b981)
- Subtle box shadow for visibility: `0 0 10px rgba(16, 185, 129, 0.6)`
- 4px border radius for rounded corners
- No background color (or very subtle transparent green)
- Must NOT block interaction with the product image or links

**Positioning**:
- Must exactly match the product image boundaries
- Should overlay on top of the image (z-index: 9998)
- Must update position on scroll and resize events
- Should work with images of any size or aspect ratio

**Lifecycle**:
- Added immediately after clothing detection is confirmed
- Should appear for ALL detected images on the page (not just visible ones)
- Should persist until:
  - User navigates away
  - Extension is disabled
  - Detection is cleared/reset

### 2. Eye Icon Overlays (Virtual Try-On)

**Purpose**: Provide clickable interface for virtual try-on functionality

**Visual Appearance**:
- Circular button (40px × 40px)
- Green background: `rgba(16, 185, 129, 0.9)`
- White eye icon SVG (24px × 24px)
- Box shadow: `0 2px 8px rgba(0, 0, 0, 0.3)`
- Hover effect: scale(1.1) and brighter background
- Must be clickable (pointer-events: auto)

**Positioning**:
- Bottom-right corner of the product image
- Slightly below the image edge (5px offset)
- Should not overlap other UI elements
- Must update position on scroll and resize

**States**:
1. **Default**: Green background, eye icon, "Click to generate virtual try-on"
2. **Cached**: Yellow/gold gradient background, indicates cached result available
3. **Loading**: Blue background with spinner animation
4. **Close**: Red background with X icon when result is showing
5. **Error**: Red background with error icon

**Behavior**:
- Click to generate/show virtual try-on result
- Click again to close/hide result
- Auto-close result after 5 seconds
- Cache results in DOM for 24 hours

### 3. Score Badge Overlays (Style Compatibility)

**Purpose**: Display AI-generated style compatibility scores (1-10 scale)

**Visual Appearance**:
- Small badge in top-right corner of product image
- Rounded rectangle (border-radius: 12px)
- Font: 12px, bold, white text
- Different colors based on score:
  - **Score 9-10**: Gold gradient with pulse animation `#fbbf24 → #f59e0b`
  - **Score 7-8**: Green gradient `#10b981 → #059669`
  - **Score 5-6**: Yellow gradient `#fbbf24 → #f59e0b`
  - **Score 1-4**: Red gradient `#ef4444 → #dc2626` (or hidden)
  - **Loading**: Purple gradient with spinner animation

**Positioning**:
- Top-right corner of product image (8px from top, right edge)
- Perfect match badges (9-10) centered on top border
- Must update position on scroll and resize

**Content**:
- Score format: "8/10", "9/10", etc.
- Tooltip with reasoning on hover

**Lifecycle**:
- Only shown when `isShowingStyleSuggestions === true`
- Replaced with loading indicator during analysis
- Updated when analysis completes
- Removed when UI is hidden

### 4. Loading Indicators

**Purpose**: Show analysis in progress

**Visual Appearance**:
- Small badge with spinner animation
- Purple/gray gradient background
- Spinner: 12px circle with rotating border
- Text: "..." or similar

**Positioning**:
- Same position as score badges
- Shown in place of score badges during analysis

## Technical Requirements

### Positioning Strategy
- Use absolute positioning relative to viewport
- Calculate position using: `getBoundingClientRect()` + scroll offsets
- Store position in: `top`, `left`, `width`, `height` CSS properties
- Update on: scroll, resize, dynamic content changes

### Performance Considerations
- Add all overlays in a single batch per detection cycle
- Use passive event listeners for scroll
- Debounce resize events if needed
- Clean up event listeners when overlays removed

### DOM Structure
```html
<!-- Green border overlay -->
<div class="ai-style-detected-overlay"
     data-ai-style-overlay="detected"
     data-ai-style-target-index="0">
</div>

<!-- Eye icon overlay -->
<div class="ai-style-eye-icon"
     data-ai-style-eye-icon="true"
     data-ai-style-target-index="0">
  <svg>...</svg>
</div>

<!-- Score badge overlay -->
<div class="ai-style-score-badge"
     data-ai-style-score-badge="score|perfect"
     data-target-index="0">
  8/10 | 9/10 | etc.
</div>
```

### Data Flow

1. **Detection Phase**:
   - ImageDetector finds product images
   - Green borders added to ALL detected images immediately
   - Eye icons added to ALL detected images immediately

2. **Analysis Phase** (if style profile exists and UI enabled):
   - Loading indicators replace score badge positions
   - AI analysis runs for each image
   - Score badges replace loading indicators as results complete

3. **UI Toggle**:
   - When `isShowingStyleSuggestions = true`: Show score badges
   - When `isShowingStyleSuggestions = false`: Hide score badges (keep green borders and eye icons)

### State Management

**Per-Image Tracking** (in `overlayMap`):
```javascript
{
  overlay: HTMLElement,      // Green border overlay
  eyeIcon: HTMLElement,       // Eye icon overlay
  scoreBadge: HTMLElement,    // Score badge overlay (or null)
  score: number,              // Compatibility score
  reasoning: string,          // AI reasoning
  index: number,              // Global image index
  img: HTMLImageElement       // Reference to product image
}
```

**Event Handler Tracking** (in `updateHandlers`):
```javascript
{
  updatePosition: Function,          // Updates overlay positions
  updateScoreBadgePosition: Function // Updates score badge position
}
```

## Current Issues to Fix

1. **Overlays moving to top-left corner**: Position calculated correctly initially but changes afterward
2. **Overlays not appearing on all images**: Only first batch shows overlays
3. **Score badges not appearing**: Progressive UI update logic not working

## Testing Checklist

- [ ] Green borders appear on ALL detected images (not just first batch)
- [ ] Green borders stay in correct position (don't move to 0,0)
- [ ] Green borders update position on scroll/resize
- [ ] Eye icons appear on ALL detected images
- [ ] Eye icons are clickable and functional
- [ ] Eye icons update position on scroll/resize
- [ ] Score badges appear when analysis completes (if UI enabled)
- [ ] Score badges show correct colors for different scores (1-10 scale)
- [ ] Loading indicators show during analysis
- [ ] All overlays removed when detection cleared
- [ ] Works on different product grid layouts (grid, list, etc.)
- [ ] Works with lazy-loaded images
- [ ] No performance issues with 30+ products on page

## Implementation Notes

### Why overlays are separate from product images:
- Product images may be inside complex DOM structures (cards, links, containers)
- Direct modification of product elements could break site functionality
- Overlays appended to `document.body` avoid parent container restrictions
- Absolute positioning allows precise control

### Why multiple overlay types:
- Separation of concerns: detection, scoring, try-on are independent features
- Different lifecycles: detection overlays persist, score overlays toggle
- Different z-index layers: borders (9998), eye icons (10000), badges (10000+)
