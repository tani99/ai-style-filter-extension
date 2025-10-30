## Option 1 Implementation Plan: Move Eye Icon into ScoreBadgeManager

### Goal
Use `ScoreBadgeManager` to fully manage the virtual try-on eye icon (creation, positioning, lifecycle, and events) so both the score badge and the eye icon share a single positioning and update path. Remove `TryOnOverlays` usage entirely.

### 1) Extend ScoreBadgeManager API
- Add state
  - `activeEyeIcons: Map<HTMLImageElement, HTMLElement>` to track `img → eyeIcon`.
- Add creation and lifecycle methods
  - `createEyeIconElement()`
  - `showEyeIcon(img)` → create if needed, append to `document.body`, position, register events
  - `hideEyeIcon(img)` → remove DOM and map entry
  - `hideAllEyeIcons()` → remove all and clear map
- Add positioning
  - `positionEyeIcon(eyeIcon, img)` uses bottom-right corner with offset `{ x:45, y:5 }`
  - Add helper `positionElementRelativeToImage(element, img, corner, offset, transform)` that wraps `GeometryUtils.positionElementRelativeToImage`
- Update existing updater
  - Extend `updateAllPositions()` to reposition both `activeBadges` and `activeEyeIcons`
  - Existing scroll/resize listeners remain as-is (they call `updateAllPositions()`)

### 2) Move eye icon behavior from TryOnOverlays
- Click/state handling
  - Add methods in `ScoreBadgeManager`:
    - `attachEyeIconHandlers(eyeIcon, img)` → manage click to generate/close, update states: `default`, `loading`, `close`, `cached`, `error`
    - `updateEyeIconState(eyeIcon, state)` → visuals for the above states (reuse current styles)
- Caching helpers (ported from `TryOnOverlays`)
  - `getCachedTryonData(eyeIcon)`
  - `cacheTryonData(eyeIcon, imageUrl, imageData)`
  - `clearCachedTryonData(eyeIcon)`
- Try-on generation integration
  - Add a thin integration method in `ScoreBadgeManager` to trigger existing try-on flow. Options:
    - Call existing background messaging directly (replicate the path used in `TryOnOverlays.handleVirtualTryOn`), or
    - Expose a callback from `ContentScriptManager` that `ScoreBadgeManager` invokes on click, returning `{ overlay | error }` and a cached state. Prefer the callback for separation.

### 3) Integrate in VisualIndicators and Controller
- In `VisualIndicators`:
  - Replace eye icon creation/positioning with calls to `scoreBadgeManager.showEyeIcon(img)` on detection
  - On removal/cleanup, call `scoreBadgeManager.hideEyeIcon(img)`
  - Remove global updater branches that referenced eye icon positioning (ScoreBadgeManager will handle it)
- In `ContentScriptManager`:
  - Ensure `this.scoreBadgeManager` is instantiated (already present)
  - Provide a callback to trigger try-on generation if you do not want `ScoreBadgeManager` to talk to background script directly

### 4) Remove TryOnOverlays
- Delete `extension/content/ui/TryOnOverlays.js`
- Remove imports and references from `VisualIndicators`
- Ensure no other modules import `TryOnOverlays`

### 5) Visual and z-index consistency
- Keep appending eye icons to `document.body`
- Ensure z-index aligns with badges (>= `10000`) and does not cover modals unintentionally

### 6) Cleanup and lifecycle
- On detection clear: call `scoreBadgeManager.hideAllEyeIcons()` and `scoreBadgeManager.hideAllBadges()`
- On image removal: `updateAllPositions()` should prune entries whose images are no longer in the DOM (match current badge behavior)

### 7) Testing checklist
- Toggle on/off: both badges and eye icons show/hide consistently
- Scroll/resize: both remain pinned to image corners
- Lazy-loaded images: placement correct once measurable
- Click flow: default → loading → close → cached/default; cached state persists for 24h; error state shown when applicable
- Multiple images: each image has its own eye icon; no cross-updates
- Clear/reset: no stray nodes left; maps emptied

### 8) Follow-ups (optional)
- Add a generic `registerFloatingElement(img, element, corner, offset, transform)` to reduce duplication between badges and eye icons

