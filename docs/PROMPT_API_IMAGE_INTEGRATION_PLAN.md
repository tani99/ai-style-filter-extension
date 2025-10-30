## Personal Style Matcher: On‑Device Image Analysis via Chrome Prompt API

This plan updates `PersonalStyleMatcher` to analyze the actual product image using Chrome's Prompt API (Gemini Nano, on-device) instead of relying on alt text or inferred image context. It includes progressive enhancement with graceful fallbacks.

Reference: Chrome Prompt API docs: [developer.chrome.com/docs/ai/prompt-api](https://developer.chrome.com/docs/ai/prompt-api)

### Minimal plan (smallest diffs)
- Use the same options for availability and session creation: `{ modalities: ['text', 'image'] }`.
- Pass the image Blob/File in `session.append()` as `{ type: 'image', value: imageBlob }` alongside your instruction text.
- If the image Blob is unavailable (failed fetch or missing), log a single line and fall back to the existing alt‑text prompt path.

Minimal sketch:
```javascript
// after a user gesture
const opts = { modalities: ['text', 'image'] };
const available = await LanguageModel.availability(opts);
if (available === 'unavailable') return fallbackToAltText();

const session = await LanguageModel.create(opts);

let imageBlob = null;
try {
  imageBlob = await getProductImageBlob(imageUrl); // your existing/background fetch
} catch (e) {
  console.info('[PromptAPI] Image unavailable, falling back to alt text.', e);
}

if (imageBlob) {
  await session.append([{
    role: 'user',
    content: [
      { type: 'text', value: 'Analyze dominant colors, patterns, and style tags.' },
      { type: 'image', value: imageBlob },
    ],
  }]);
  // prompt with optional responseConstraint...
} else {
  console.info('[PromptAPI] Using alt text/image context path.');
  return buildProductAnalysisPromptFromAltText(/* existing path */);
}
```

### Goals
- Pass a real product image (Blob/File) into a Prompt API session alongside instructions.
- Extract detected colors, patterns, and style tags to improve matching quality.
- Preserve current text-only prompt as a fallback.

### Step-by-step execution plan
1) Identify where the Prompt API session is created
   - Locate your existing `LanguageModel.availability(...)` and `LanguageModel.create(...)` calls (likely in `AIAnalysisEngine` or wherever the Prompt session is managed).

2) Add user gesture gating (only if not already)
   - Ensure the first availability/create call runs within a user click/keypress handler (e.g., an existing toggle/button in `StyleOverlayController`).

3) Update availability and create options to include image modality
   - Replace existing calls with:
     - `const opts = { modalities: ['text', 'image'] }`.
     - `await LanguageModel.availability(opts)`.
     - `await LanguageModel.create(opts)`.

4) Get the product image as a Blob/File
   - Reuse functions to convert to blobs that are used by the GeminiAPIManager.js
   - Use the src url from the stored detected images that are constantly updated byour background task in ContentScriptManager which should be passe to the style matcher.
   - Fetch to Blob using your current fetch path. If cross‑origin blocks appear, reuse your background fetch helper (if present) to return an ArrayBuffer/Blob.

5) Append the multimodal message including the image
   - Before calling `prompt()`:
     - `await session.append([{ role: 'user', content: [ { type: 'text', value: 'Analyze dominant colors, patterns, style tags.' }, { type: 'image', value: imageBlob } ] }]);`

6) Prompt with optional structured output
   - Keep your current prompt flow. Optionally add a JSON Schema via `responseConstraint` to ensure `{ detectedColors, patterns, styleTags }`.

7) Fallback if image isn’t available
   - If image fetch fails or `imageBlob` is null:
     - Log exactly one line: `console.info('[PromptAPI] Image unavailable, falling back to alt text.')`.
     - Call the existing alt‑text/image‑context path (no further changes needed).

8) Fallback if Prompt API is unavailable
   - If `availability` is `unavailable`, keep your current fallback (Gemini or text path) unchanged.

9) Test
   - Verify with a same‑origin image (direct Blob) and a cross‑origin image (background fetch). Ensure the log line appears only when image is missing and alt‑text fallback is used.
   - Confirm the first invocation is tied to a user action and works per the Prompt API requirement.

Docs: Chrome Prompt API (image modality, user gesture): https://developer.chrome.com/docs/ai/prompt-api

### Capability detection and user gesture
- Use `LanguageModel.availability()` with the same options used for prompting, including image modality, for accurate status.
- Ensure a user interaction precedes first model download/session creation (button/toggle already in UI can serve as the gesture).
- Handle availability states: `available`, `downloadable`, `downloading`, `unavailable`.

### Data flow overview
1) Content script identifies the product `HTMLImageElement` and resolves an image URL (`src`/`srcset`/lazy attrs).
2) Request a Blob from background/offscreen to avoid CORS taint:
   - Message: `{ type: "FETCH_PRODUCT_IMAGE", url }`.
   - Background fetches, optionally downscales/re-encodes, returns bytes.
3) Attempt Prompt API multimodal session with the image Blob. If unsupported/unavailable, fallback to Gemini multimodal; else fallback to text-only prompt.

### Image normalization
- In background/offscreen: Blob → `ImageBitmap` or canvas → downscale to max ~1024 px longest edge → re-encode as JPEG/WebP (quality ~0.8).
- Enforce size bounds (≤ ~1.5 MB) and ensure color profile is standard (sRGB).

### Prompt API usage (image + text)
- Availability (same options as session):
  - `await LanguageModel.availability({ modalities: ['text', 'image'] })`.
- Session creation after user gesture:
  - `const session = await LanguageModel.create({ modalities: ['text', 'image'] })`.
- Provide messages with both text instruction and image Blob:
  - `await session.append([{ role: 'user', content: [{ type: 'text', value: 'Analyze …' }, { type: 'image', value: imageBlob }] }])`.
- Request structured output:
  - Use `responseConstraint` JSON Schema on `prompt()` for `{ detectedColors: string[], patterns: string[], styleTags: string[] }`.
- Docs: [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) (sessions, availability, multimodal messages, structured output).

### Integration points (files)
- `extension/content/ai/PersonalStyleMatcher.js`
  - Add an image-first path (new `analyzeWithImage(productImageElement, options)` or extend `buildPrompt` to accept `imageBlob`).
  - If Prompt API analysis succeeds, build results directly from vision output; else fall back.
- `extension/content/ai/ChromePromptAdapter.js` (new)
  - Encapsulate Prompt API lifecycle, availability checks, and multimodal prompting.
  - API: `analyzeProductImage(imageBlob, styleProfile)` → `{ detectedColors, patterns, styleTags, captions? } | null`.
- `extension/background/background.js`
  - Handle `FETCH_PRODUCT_IMAGE` (fetch, normalize, return bytes).
  - Optionally handle `ANALYZE_WITH_PROMPT_API` if run in an offscreen document (Prompt API is not available in workers; requires a document context).
- `extension/content/core/ContentScriptManager.js`
  - Wire message requests for image fetching; coordinate gesture-bound analysis trigger.
- `extension/manifest.json`
  - Add required host permissions for product image domains or `"<all_urls>"`.
  - If using an offscreen document: add `"offscreen"` permission and offscreen page entry.
  - Remove deprecated `"aiLanguageModelOriginTrial"` if present (per docs).

### Fallbacks
- If Prompt API is `unavailable` or append/prompt fails → try Gemini multimodal (existing `GeminiAPIManager.js`) with the same image Blob.
- If image cannot be fetched due to CORS/network constraints → fall back to current text-only prompt based on `altText` and `imageContext`.

### Caching and rate limiting
- Cache per-image URL hash (and size params) with TTL (e.g., 24h) in `chrome.storage.session` or in-memory in background.
- Debounce/limit concurrent analyses; one in-flight analysis per product card.

### Privacy/UX
- On-device first; add a setting to allow or disallow cloud fallback.
- Inform users when the model is downloading; surface availability states; allow cancel.

### Minimal adapter shape
```javascript
// ChromePromptAdapter.js (conceptual outline)
export async function analyzeProductImage(imageBlob, styleProfile) {
  const available = await LanguageModel.availability({ modalities: ['text', 'image'] });
  if (available === 'unavailable') return null;
  const session = await LanguageModel.create({ modalities: ['text', 'image'] });
  await session.append([
    { role: 'user', content: [
      { type: 'text', value: 'Analyze this product for dominant colors, patterns, and style tags.' },
      { type: 'image', value: imageBlob },
    ]},
  ]);
  const schema = {
    type: 'object',
    properties: {
      detectedColors: { type: 'array', items: { type: 'string' } },
      patterns: { type: 'array', items: { type: 'string' } },
      styleTags: { type: 'array', items: { type: 'string' } },
    },
    required: ['detectedColors', 'patterns', 'styleTags'],
    additionalProperties: false,
  };
  const result = await session.prompt('Only output compact JSON.', { responseConstraint: schema });
  return JSON.parse(result);
}
```

### Testing
- Unit-test `ChromePromptAdapter` with a small sample Blob; validate schema parsing.
- Integration-test content↔background message for `FETCH_PRODUCT_IMAGE` across same-origin and cross-origin cases.
- E2E on a few sites with lazy-loaded images; verify Prompt API path, Gemini fallback, and text-only fallback.

### Task checklist
- Update `manifest.json` permissions and (optional) offscreen document.
- Implement background `FETCH_PRODUCT_IMAGE` with normalization.
- Create `ChromePromptAdapter.js` with availability check and multimodal prompt.
- Thread image-first flow into `PersonalStyleMatcher` with fallbacks.
- Add caching, limits, and settings for on-device-only vs cloud fallback.


