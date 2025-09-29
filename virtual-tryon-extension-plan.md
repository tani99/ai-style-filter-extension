# AI Style-Based Shopping Filter + Virtual Try-On Chrome Extension

## Project Overview
A Chrome extension that uses Chrome's built-in AI to create a personal style profile, then filters shopping pages to show only items that match your aesthetic while providing hover-based virtual try-on image generation.

## Architecture
- **Chrome Built-in AI**: Prompt API for style analysis and product evaluation
- **Gemini Developer API**: Image generation for virtual try-on
- **Extension Components**: Content scripts, background service worker, extension tab, popup interface

---

## Phase 1: Foundation & Setup (Days 1-2)

### Step 1.1: Create Basic Chrome Extension Structure
**Goal**: Set up the foundational Chrome extension with manifest v3
**Deliverable**: Working extension that can be loaded in Chrome

**Tasks**:
1. Create `manifest.json` with required permissions:
   - `activeTab` for content script injection
   - `storage` for user profile data
   - `ai` for Chrome built-in AI access
   - Host permissions for major e-commerce sites
2. Create basic folder structure:
   ```
   /extension
   ├── manifest.json
   ├── popup/
   │   ├── popup.html
   │   ├── popup.css
   │   └── popup.js
   ├── content/
   │   └── content.js
   ├── background/
   │   └── background.js
   └── tab/
       ├── tab.html
       ├── tab.css
       └── tab.js
   ```
3. Create minimal popup interface with extension icon
4. Test extension loads and appears in Chrome

**How to Test This Step**:
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" and select your `/extension` folder
4. The extension should appear in your extensions list
5. Click the extension icon in the toolbar - popup should open
6. Check for any errors in the Chrome DevTools console

### Step 1.2: Set Up Extension Tab for Style Dashboard
**Goal**: Create dedicated extension tab for style profile management
**Deliverable**: Extension tab opens with basic layout

**Tasks**:
1. Create `tab.html` with layout sections:
   - Header with extension name/logo
   - Photo upload area
   - Style profile display area (placeholder)
   - Settings section
2. Add basic CSS styling for professional appearance
3. Add tab opening functionality from popup
4. Test tab opens correctly and displays content

**How to Test This Step**:
1. After loading the extension, click the extension icon
2. Click "Open Style Dashboard" (or similar button) in popup
3. New tab should open showing your style dashboard
4. Check that all layout sections are visible and styled correctly
5. Test on different screen sizes to ensure responsive design

---

## Phase 2: Photo Upload & Storage System (Day 3)

### Step 2.1: Implement Photo Upload Interface
**Goal**: Allow users to upload multiple photos for style analysis
**Deliverable**: Working photo upload with preview

**Tasks**:
1. Create photo upload component in extension tab:
   - Multiple file input (accept only images)
   - Drag & drop functionality
   - Photo preview thumbnails
   - Remove photo buttons
2. Add client-side image validation:
   - File type checking (jpg, png, webp)
   - File size limits (max 5MB per photo)
   - Maximum 5 photos total
3. Implement image resizing/compression for storage efficiency
4. Test upload functionality with various image formats

**How to Test This Step**:
1. Open the style dashboard tab
2. Try uploading photos by clicking the upload button
3. Test drag & drop by dragging image files onto the upload area
4. Verify thumbnail previews appear for uploaded images
5. Test validation by trying to upload:
   - Non-image files (should be rejected)
   - Very large files (should be rejected or compressed)
   - More than 5 photos (should show limit message)
6. Test remove buttons work for each uploaded photo

### Step 2.2: Local Storage for User Photos
**Goal**: Securely store user photos locally using Chrome storage API
**Deliverable**: Photos persist between extension sessions

**Tasks**:
1. Convert uploaded images to base64 for storage
2. Implement storage functions:
   - Save photos to `chrome.storage.local`
   - Retrieve photos on tab load
   - Delete individual photos
   - Clear all photos function
3. Add storage quota management (prevent exceeding limits)
4. Test photo persistence across browser restarts

**How to Test This Step**:
1. Upload several photos in the style dashboard
2. Close the extension tab and reopen it - photos should still be there
3. Restart Chrome browser entirely - photos should persist
4. Test individual photo deletion works correctly
5. Check Chrome storage usage:
   - Go to `chrome://extensions/`
   - Click "Details" on your extension
   - Check storage usage isn't excessive
6. Test storage limits by uploading many large photos

---

## Phase 3: Chrome AI Integration for Style Analysis (Days 4-5)

### Step 3.1: Basic Chrome AI Setup
**Goal**: Establish connection to Chrome's Prompt API
**Deliverable**: Extension can make basic AI calls

**Tasks**:
1. Request Chrome AI access in background service worker
2. Create AI utility functions:
   - Check AI availability
   - Handle API errors gracefully
   - Implement retry logic for failed calls
3. Test basic prompt with simple text input
4. Add error handling for unsupported browsers/versions

**How to Test This Step**:
1. Add a "Test AI" button to your style dashboard
2. Click the button to send a simple prompt like "Hello, how are you?"
3. Check the response appears correctly in the UI
4. Test on different Chrome versions (128+ required)
5. Check Chrome DevTools console for any AI-related errors
6. Test with Chrome AI disabled to ensure graceful error handling
7. Join Chrome Built-in AI Early Preview Program if needed:
   - Go to `chrome://flags/#prompt-api-for-gemini-nano`
   - Enable the flag and restart Chrome

### Step 3.2: Multi-Photo Style Analysis
**Goal**: Analyze uploaded photos to generate comprehensive style profile
**Deliverable**: AI-generated style profile from user photos

**Tasks**:
1. Design comprehensive style analysis prompt:
   ```javascript
   const stylePrompt = `
   Analyze these photos and create a detailed style profile:
   1. Best colors for this person's skin tone and hair color
   2. Top 3 style categories that suit them (e.g., minimalist, classic, bohemian, edgy)
   3. Preferred fits and silhouettes based on body type
   4. Pattern preferences (solid, stripes, florals, etc.)
   5. Overall aesthetic description
   
   Format as JSON with clear categories.
   `;
   ```
2. Implement multi-image analysis function
3. Parse AI response into structured data
4. Add loading states during analysis
5. Test with various photo combinations

**How to Test This Step**:
1. Upload 3-5 photos of yourself in different outfits
2. Click "Analyze My Style" button
3. Verify loading spinner appears during analysis
4. Check that AI response is parsed correctly into JSON format
5. Test with different types of photos:
   - Casual outfits
   - Formal wear
   - Different lighting conditions
6. Verify the analysis makes sense for your actual style
7. Test error handling with invalid images or API failures

### Step 3.3: Style Profile Display
**Goal**: Show generated style profile in beautiful dashboard
**Deliverable**: Visual representation of user's style profile

**Tasks**:
1. Design style profile display components:
   - Color palette visualization
   - Style category cards with descriptions
   - Fit recommendations section
   - Pattern preference indicators
2. Create dynamic UI that populates from AI analysis
3. Add "regenerate profile" functionality
4. Implement profile editing/customization options
5. Test profile display with different analysis results

**How to Test This Step**:
1. After style analysis completes, verify profile appears in dashboard
2. Check that color palette shows actual color swatches
3. Verify style categories are displayed as attractive cards
4. Test "Regenerate Profile" button creates new analysis
5. Test editing capabilities (if implemented):
   - Modify color preferences
   - Adjust style category rankings
6. Take screenshots to ensure professional visual design
7. Test responsive design on different screen sizes

---

## Phase 4: E-commerce Site Integration (Days 6-7)

### Step 4.1: Content Script Injection
**Goal**: Inject content scripts into major e-commerce websites
**Deliverable**: Extension activates on shopping sites

**Tasks**:
1. Identify target e-commerce sites:
   - Zara
   - H&M
   - Nike
2. Create content script injection system:
   - Detect when user is on supported site
   - Inject content script only on product pages
   - Add site-specific selectors for clothing items
3. Test injection on multiple sites
4. Handle dynamic content loading (SPA navigation)

**How to Test This Step**:
1. Visit supported e-commerce sites (amazon.com, zara.com, hm.com)
2. Check Chrome DevTools console for content script injection messages
3. Verify extension icon shows active state on supported sites
4. Test on different page types:
   - Product listing pages
   - Individual product pages
   - Category pages
5. Navigate between pages to test SPA handling
6. Check that script doesn't inject on non-clothing sites
7. Test with Chrome DevTools -> Sources to see injected scripts

### Step 4.2: Product Image Detection
**Goal**: Automatically identify clothing items on product pages
**Deliverable**: Extension can find and target clothing images

**Tasks**:
1. Create product detection algorithms:
   - CSS selectors for common product image classes
   - DOM analysis for image containers
   - Filter for clothing-related images (avoid logos, models, etc.)
2. Handle different site layouts:
   - Grid view products
   - List view products
   - Individual product pages
3. Add image quality checking (minimum size, aspect ratio)
4. Test detection accuracy across different sites

**How to Test This Step**:
1. Add visual indicators (red borders) around detected clothing images
2. Visit various e-commerce sites and verify detection:
   - Amazon Fashion: Check product grid and individual items
   - Zara: Test both grid and individual product pages
   - H&M: Verify detection in catalog and product views
3. Check detection accuracy:
   - Should detect: clothing product images
   - Should ignore: logos, navigation icons, model photos, ads
4. Test different image sizes and aspect ratios
5. Use browser DevTools to inspect detected elements
6. Test scrolling and lazy-loaded images
7. Add console logs showing detection counts per page

---

## Phase 5: Style-Based Filtering System (Days 8-9)

### Step 5.1: Real-time Product Analysis
**Goal**: Analyze each product against user's style profile
**Deliverable**: Products get style compatibility scores

**Tasks**:
1. Create product analysis function:
   ```javascript
   const analyzeProduct = async (productImage, userProfile) => {
     const prompt = `
     Rate this clothing item 1-10 for compatibility with this style profile:
     Colors: ${userProfile.colors}
     Styles: ${userProfile.styles}
     Fits: ${userProfile.fits}
     
     Consider color harmony, style match, and overall aesthetic compatibility.
     Return only the numeric score.
     `;
     return await ai.prompt({ content: prompt, images: [productImage] });
   };
   ```
2. Implement batch processing for multiple products
3. Add caching to avoid re-analyzing same products
4. Create performance optimization (limit concurrent API calls)
5. Test analysis accuracy with known good/bad matches

**How to Test This Step**:
1. Visit e-commerce sites with your style profile generated
2. Watch products get analyzed with loading indicators
3. Verify scores appear as overlays on product images
4. Test analysis accuracy by checking scores manually:
   - Items matching your style should score 7-10
   - Items not matching should score 1-6
5. Test performance with pages containing many products
6. Check caching works by revisiting same products
7. Monitor Chrome DevTools Network tab for API call patterns
8. Test with different user profiles to verify scoring changes

### Step 5.2: Visual Filtering Implementation
**Goal**: Transform product pages based on style scores
**Deliverable**: Pages show only style-compatible items

**Tasks**:
1. Create filtering visual effects:
   - Dim products with low scores (opacity: 0.3)
   - Highlight high-scoring products with badges
   - Add style score overlays
2. Implement filtering controls:
   - Toggle between "My Style" and "All Items"
   - Adjustable score threshold slider
   - Filter by specific style categories
3. Add smooth animations for filter changes
4. Test filtering on pages with many products

**How to Test This Step**:
1. Browse e-commerce sites and watch pages transform
2. Verify low-scoring items are dimmed appropriately
3. Check high-scoring items have visible badges/highlights
4. Test filtering controls:
   - Toggle "My Style" vs "All Items" modes
   - Adjust threshold slider and see real-time changes
   - Test style category filters
5. Verify smooth animations during filter changes
6. Test on pages with different product counts:
   - Small pages (5-10 products)
   - Large pages (50+ products)
7. Check filtering works with infinite scroll/pagination
8. Take before/after screenshots to show filtering effect

---

## Phase 6: Virtual Try-On System (Days 10-11)

### Step 6.1: Gemini API Integration
**Goal**: Set up Gemini Developer API for image generation
**Deliverable**: Extension can generate try-on images

**Tasks**:
1. Set up Gemini API credentials and authentication
2. Create try-on image generation function:
   ```javascript
   const generateTryOn = async (userPhoto, clothingImage) => {
     return await geminiAPI.generateImage({
       userPhoto: userPhoto,
       clothingItem: clothingImage,
       prompt: "Generate realistic image of person wearing this clothing item"
     });
   };
   ```
3. Handle API responses and error cases
4. Implement image caching for repeated requests
5. Test with various clothing types and user photos

**How to Test This Step**:
1. Get Gemini API key from Google AI Studio
2. Add a "Test Try-On" button in your style dashboard
3. Test image generation with your uploaded photos:
   - Use a simple clothing image from the web
   - Verify generated image shows you wearing the item
4. Test error handling:
   - Invalid API key
   - Network failures
   - Unsupported image formats
5. Check image caching by generating same combination twice
6. Test with different clothing types:
   - Shirts/tops
   - Dresses
   - Jackets
7. Monitor API usage and costs in Google Cloud Console

### Step 6.2: Hover-Based Try-On Interface
**Goal**: Show try-on images when hovering over products
**Deliverable**: Smooth hover experience with generated images

**Tasks**:
1. Create hover detection system:
   - Add event listeners to filtered product images
   - Implement hover delay (500ms) to avoid excessive API calls
   - Handle mouse leave events to hide popups
2. Design try-on popup interface:
   - Floating popup positioned near original image
   - Loading spinner during generation
   - Generated image display with smooth fade-in
   - Close button and auto-hide functionality
3. Add popup positioning logic:
   - Stay within viewport boundaries
   - Adjust position based on scroll position
   - Handle responsive layouts
4. Test hover experience across different devices

**How to Test This Step**:
1. Browse e-commerce sites with your style profile active
2. Hover over filtered clothing items and verify:
   - Hover delay prevents immediate API calls
   - Loading spinner appears during generation
   - Generated try-on image displays correctly
   - Popup positions properly near original image
3. Test edge cases:
   - Hover on items at screen edges
   - Hover while scrolling
   - Quick hover movements (should not spam API)
4. Test on different screen sizes and zoom levels
5. Verify popup disappears when mouse leaves area
6. Test with slow internet to ensure good loading experience
7. Check popup doesn't interfere with page functionality

---

## Phase 7: User Experience & Polish (Day 12)

### Step 7.1: Performance Optimization
**Goal**: Ensure smooth performance across all features
**Deliverable**: Fast, responsive extension

**Tasks**:
1. Optimize API call patterns:
   - Debounce rapid hover events
   - Batch product analysis requests
   - Implement smart caching strategies
2. Reduce memory usage:
   - Compress stored images
   - Clean up unused DOM listeners
   - Limit concurrent operations
3. Add loading states for all async operations
4. Test performance with large product catalogs

**How to Test This Step**:
1. Use Chrome DevTools Performance tab to profile extension
2. Test with large product pages (50+ items):
   - Measure analysis time
   - Check memory usage doesn't grow excessively
   - Verify UI remains responsive
3. Test rapid hover movements:
   - Should not create excessive API calls
   - Verify debouncing works correctly
4. Check caching effectiveness:
   - Revisit same products
   - Monitor network requests
5. Test on slower devices/connections
6. Use Chrome DevTools Memory tab to check for leaks
7. Verify extension doesn't slow down page loading

### Step 7.2: Error Handling & Edge Cases
**Goal**: Graceful handling of errors and unusual scenarios
**Deliverable**: Robust extension that works reliably

**Tasks**:
1. Add comprehensive error handling:
   - API rate limits and failures
   - Network connectivity issues
   - Unsupported image formats
   - Browser compatibility problems
2. Create fallback experiences:
   - Show cached results when API unavailable
   - Graceful degradation for unsupported features
   - Clear error messages for users
3. Handle edge cases:
   - Very large/small product images
   - Sites with unusual layouts
   - Dynamic content loading
4. Test extensively across different scenarios

---

## Phase 8: Documentation & Submission (Days 13-14)

### Step 8.1: Create Demo Video
**Goal**: 3-minute demonstration video for competition submission
**Deliverable**: Professional demo video

**Tasks**:
1. Script demo covering key features:
   - Setup process (photo upload, style analysis)
   - Shopping experience (filtering, try-on)
   - Style profile dashboard
   - Benefits and use cases
2. Record high-quality screen capture
3. Add voiceover explaining features
4. Edit with smooth transitions and highlighting
5. Upload to accessible platform

### Step 8.2: Documentation & Repository Setup
**Goal**: Complete GitHub repository with documentation
**Deliverable**: Public repository ready for submission

**Tasks**:
1. Create comprehensive README.md:
   - Project description and features
   - Installation instructions
   - Usage guide with screenshots
   - API requirements and setup
   - Technical architecture overview
2. Add code documentation:
   - Inline comments explaining complex logic
   - API reference for key functions
   - Configuration options
3. Prepare submission materials:
   - Feature description for competition
   - Technical implementation details
   - Demo link and video
4. Choose appropriate open source license
5. Final testing and quality assurance

---

## Chrome Extension Development & Testing Guide

### How to Load and Test Your Extension

#### Initial Setup:
1. **Enable Developer Mode**:
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" on (top right corner)

2. **Load Your Extension**:
   - Click "Load unpacked"
   - Select your `/extension` folder
   - Extension appears in your extensions list

3. **Pin Extension**:
   - Click the puzzle piece icon in Chrome toolbar
   - Pin your extension for easy access

#### Testing Workflow for Each Step:

1. **After Making Changes**:
   - Go to `chrome://extensions/`
   - Click the refresh icon on your extension
   - Test the new functionality

2. **Debugging**:
   - **Popup/Tab Pages**: Right-click extension popup → "Inspect"
   - **Content Scripts**: Open DevTools on webpage → Console tab
   - **Background Script**: Go to `chrome://extensions/` → Click "service worker" link
   - **Permissions**: Check manifest.json permissions are correct

3. **Common Issues**:
   - **Extension not loading**: Check manifest.json syntax
   - **API not working**: Ensure Chrome 128+ and AI features enabled
   - **Content script not injecting**: Check host permissions in manifest
   - **Storage not persisting**: Verify storage permissions

#### Chrome AI Setup:
- Join Chrome Built-in AI Early Preview Program
- Enable flags: `chrome://flags/#prompt-api-for-gemini-nano`
- Restart Chrome after enabling flags

#### Gemini API Setup:
- Get API key from [Google AI Studio](https://makersuite.google.com/)
- Store securely (not in code)
- Set up proper authentication in background script

---

## Technical Requirements

### APIs Used
- **Chrome Prompt API**: Multi-image style analysis, product evaluation
- **Chrome Writer API**: Style descriptions and recommendations (optional enhancement)
- **Gemini Developer API**: Virtual try-on image generation

### Browser Support
- Chrome 128+ (for built-in AI APIs)
- Extension manifest v3 compliant

### Performance Targets
- Style analysis: < 5 seconds for 5 photos
- Product filtering: < 2 seconds for 50 products
- Try-on generation: < 10 seconds per image
- Hover response: < 500ms to show loading state

### Privacy & Security
- All user photos stored locally only
- No data transmission except to AI APIs
- User control over data deletion
- Clear privacy policy and permissions