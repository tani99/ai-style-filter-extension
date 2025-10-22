# User Prompt-Based Product Ranking Implementation Plan

## Overview
This document provides a detailed step-by-step implementation plan for adding user prompt-based outfit ranking to the AI Style Filter Chrome Extension. This feature allows users to enter specific search queries (e.g., "I'm looking for a black A-line dress") and uses Chrome's built-in Prompt API to rank products based on how well they match the user's request.

**Key Principle**: The rest of the logic (scoring images, UI display) remains the same. We're adding an alternative ranking method alongside the existing style profile ranking.

---

## Current Architecture Context

### Existing Components
- **ProductAnalyzer** (`content/ai/ProductAnalyzer.js`): Analyzes products against user's style profile using Chrome's Prompt API
- **StyleMatcher**: Currently not implemented separately - logic is in ProductAnalyzer
- **VisualIndicators** (`content/ui/VisualIndicators.js`): Displays tier overlays (1=bad, 2=fine, 3=good/perfect match)
- **FilterControls** (`content/ui/FilterControls.js`): UI controls for filtering
- **ContentScriptManager** (`content/core/ContentScriptManager.js`): Orchestrates all modules
- **Popup** (`popup/popup.html`): Extension toolbar popup with "My Style Mode" toggle

### Current Workflow
1. User uploads photos → AI generates style profile
2. Content script detects products on e-commerce sites
3. ProductAnalyzer scores each product (1-3 tier) based on style profile
4. VisualIndicators displays:
   - Tier 1 (bad): Greyed out
   - Tier 2 (fine): Normal appearance
   - Tier 3 (good): ✨ Perfect Match badge
5. User can toggle "My Style Mode" to filter by style profile

---

## New Feature Architecture

### Two Ranking Modes
1. **Style Profile Mode** (existing): Ranks products based on uploaded photos and AI-generated style profile
2. **Prompt Mode** (new): Ranks products based on user's text prompt (e.g., "black A-line dress")

### User Flow
1. User opens extension popup or dashboard
2. User chooses ranking mode:
   - Toggle "My Style Mode" (existing)
   - Enter text prompt in new "Search Mode" (new)
3. Products are ranked using the selected method
4. Visual indicators show the same tier system (1-3)
5. User can switch between modes at any time

---

## Implementation Plan

### Phase 1: Data Model & Storage (Day 1)

#### Step 1.1: Extend Storage Schema
**Goal**: Add storage for user prompts and prompt mode state
**File**: Background storage schema

**Tasks**:
1. Update storage schema to include:
```javascript
{
  // Existing fields
  userPhotos: [],
  styleProfile: { ... },

  // New fields for prompt mode
  userPrompt: "", // Current active prompt
  rankingMode: "style", // "style" or "prompt"
  recentPrompts: [], // Last 5 prompts for quick access
  promptHistory: [
    {
      prompt: "black A-line dress",
      timestamp: 1234567890,
      resultsCount: 15
    }
  ]
}
```

2. Create storage utility functions:
```javascript
// Save user prompt
async function saveUserPrompt(prompt) {
  await chrome.storage.local.set({
    userPrompt: prompt,
    rankingMode: 'prompt'
  });

  // Add to recent prompts
  const { recentPrompts = [] } = await chrome.storage.local.get(['recentPrompts']);
  const updated = [prompt, ...recentPrompts.filter(p => p !== prompt)].slice(0, 5);
  await chrome.storage.local.set({ recentPrompts: updated });
}

// Get current ranking mode
async function getRankingMode() {
  const { rankingMode = 'style' } = await chrome.storage.local.get(['rankingMode']);
  return rankingMode;
}

// Switch ranking mode
async function setRankingMode(mode) {
  await chrome.storage.local.set({ rankingMode: mode });
}
```

3. Create migration utility to handle existing users
4. Add validation for prompt length (max 200 characters)

**Testing**:
- Save prompts and verify they persist across browser restarts
- Test recent prompts list updates correctly
- Verify mode switching works
- Test with long prompts (should truncate/validate)

---

#### Step 1.2: Create PromptRankingEngine Module
**Goal**: New module to handle prompt-based ranking
**File**: `extension/content/ai/PromptRankingEngine.js`

**Tasks**:
1. Create new class structure:
```javascript
export class PromptRankingEngine {
    constructor() {
        this.analysisCache = new Map();
        this.maxCacheSize = 100;
        this.isInitialized = false;
        this.pendingAnalyses = new Map();
    }

    /**
     * Initialize AI session for prompt-based ranking
     */
    async initialize() {
        // Same initialization as ProductAnalyzer
        // Check if LanguageModel is available
        // Test session creation
    }

    /**
     * Analyze product against user prompt
     * @param {HTMLImageElement} productImage - Product image element
     * @param {string} userPrompt - User's search prompt
     * @returns {Promise<Object>} Analysis result with tier (1-3) and reasoning
     */
    async analyzeProductWithPrompt(productImage, userPrompt) {
        // Check cache first
        // Build prompt-specific analysis prompt
        // Call AI API
        // Parse response
        // Return tier and reasoning
    }

    /**
     * Build analysis prompt for prompt-based ranking
     */
    buildPromptAnalysisPrompt(productImage, userPrompt) {
        // Extract image context (alt text, title, etc.)
        // Create AI prompt that compares product to user's request
    }

    /**
     * Analyze batch of products against prompt
     */
    async analyzeBatch(productImages, userPrompt, options = {}) {
        // Same batching logic as ProductAnalyzer
    }
}
```

2. Implement prompt-based analysis logic:
```javascript
buildPromptAnalysisPrompt(productImage, userPrompt) {
    const altText = productImage.alt || '';
    const imageContext = this.extractImageContext(productImage);

    const prompt = `Analyze this clothing item for how well it matches this specific search request:

USER IS LOOKING FOR: "${userPrompt}"

IMAGE CONTEXT:
- Alt text: "${altText}"
- ${imageContext}

TASK:
Rate how well this item matches the user's specific request using ONLY these 3 tiers:
- TIER 1 (BAD): Does not match the request at all (wrong item type, color, or style)
- TIER 2 (FINE): Partially matches but missing key attributes from the request
- TIER 3 (GOOD): Strong match - closely matches what the user is looking for

Be DECISIVE and specific. Consider:
- Item type match (e.g., dress vs. shirt)
- Color match (if specified)
- Style attributes (e.g., A-line, casual, formal)
- Pattern or material (if specified)

Respond in this exact format:
TIER: [number 1, 2, or 3]
REASON: [brief 1-sentence explanation of why this matches or doesn't match the request]

Example response:
TIER: 3
REASON: Black A-line dress matches all specified criteria perfectly.`;

    return prompt;
}
```

3. Add image context extraction (reuse from ProductAnalyzer)
4. Implement caching with prompt-specific cache keys
5. Add error handling and fallbacks

**Testing**:
- Test with various prompts ("black dress", "casual t-shirt", "blue running shoes")
- Verify tier assignments make sense
- Test caching works correctly
- Test error handling (AI unavailable, invalid images)
- Compare results with manual evaluation

---

### Phase 2: UI Components (Days 2-3)

#### Step 2.1: Add Prompt Input to Popup
**Goal**: Add prompt input field to extension popup
**Files**: `extension/popup/popup.html`, `popup.css`, `popup.js`

**Tasks**:
1. Update `popup.html` to add prompt input section:
```html
<!-- Existing My Style Mode Toggle -->
<div class="filter-control">
    <label class="toggle-label">
        <span>My Style Mode</span>
        <div class="toggle-container">
            <input type="checkbox" id="myStyleToggle" class="toggle-input">
            <div class="toggle-switch"></div>
        </div>
    </label>
</div>

<!-- NEW: Divider -->
<div class="divider">
    <span>OR</span>
</div>

<!-- NEW: Prompt Search Mode -->
<div class="filter-control">
    <label class="prompt-label">
        <span>🔍 Search for Specific Item</span>
    </label>
    <div class="prompt-input-container">
        <input
            type="text"
            id="promptInput"
            class="prompt-input"
            placeholder="e.g., black A-line dress"
            maxlength="200"
        >
        <button id="applyPromptBtn" class="apply-prompt-btn" disabled>
            Apply
        </button>
        <button id="clearPromptBtn" class="clear-prompt-btn" style="display: none;">
            ✕
        </button>
    </div>

    <!-- Recent prompts quick access -->
    <div id="recentPrompts" class="recent-prompts" style="display: none;">
        <span class="recent-label">Recent:</span>
        <div id="recentPromptsList" class="recent-prompts-list">
            <!-- Populated dynamically -->
        </div>
    </div>
</div>

<!-- Active mode indicator -->
<div id="activeModeIndicator" class="active-mode-indicator">
    <span id="activeModeText">Mode: My Style</span>
</div>
```

2. Add CSS styling:
```css
/* Divider */
.divider {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 15px 0;
    color: #9ca3af;
    font-size: 12px;
}

.divider::before,
.divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #e5e7eb;
}

.divider span {
    padding: 0 10px;
}

/* Prompt input */
.prompt-label {
    font-weight: 600;
    color: #374151;
    font-size: 14px;
    margin-bottom: 8px;
    display: block;
}

.prompt-input-container {
    display: flex;
    gap: 8px;
    align-items: stretch;
}

.prompt-input {
    flex: 1;
    padding: 10px 12px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s ease;
    font-family: inherit;
}

.prompt-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.apply-prompt-btn {
    padding: 10px 16px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 14px;
}

.apply-prompt-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    transform: translateY(-1px);
}

.apply-prompt-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.clear-prompt-btn {
    padding: 10px 12px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 16px;
    line-height: 1;
}

.clear-prompt-btn:hover {
    background: #dc2626;
}

/* Recent prompts */
.recent-prompts {
    margin-top: 10px;
    padding: 10px;
    background: #f9fafb;
    border-radius: 8px;
}

.recent-label {
    font-size: 11px;
    color: #6b7280;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
}

.recent-prompts-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
}

.recent-prompt-chip {
    padding: 4px 10px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.recent-prompt-chip:hover {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
}

/* Active mode indicator */
.active-mode-indicator {
    margin-top: 15px;
    padding: 8px 12px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border-radius: 8px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
}

.active-mode-indicator.prompt-mode {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}
```

3. Implement popup interaction logic in `popup.js`:
```javascript
// Load current state on popup open
async function loadCurrentState() {
    const { rankingMode, userPrompt, recentPrompts } = await chrome.storage.local.get([
        'rankingMode',
        'userPrompt',
        'recentPrompts'
    ]);

    // Update UI based on current mode
    if (rankingMode === 'prompt' && userPrompt) {
        promptInput.value = userPrompt;
        applyPromptBtn.disabled = false;
        clearPromptBtn.style.display = 'block';
        myStyleToggle.checked = false;
        updateActiveModeIndicator('prompt', userPrompt);
    } else if (rankingMode === 'style') {
        myStyleToggle.checked = true;
        updateActiveModeIndicator('style');
    }

    // Show recent prompts if any
    if (recentPrompts && recentPrompts.length > 0) {
        displayRecentPrompts(recentPrompts);
    }
}

// Apply prompt button handler
applyPromptBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Save to storage
    await saveUserPrompt(prompt);

    // Send message to content script to re-analyze
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'applyPrompt',
            prompt: prompt
        });
    });

    // Update UI
    clearPromptBtn.style.display = 'block';
    myStyleToggle.checked = false;
    updateActiveModeIndicator('prompt', prompt);

    // Show confirmation
    showNotification('✅ Prompt applied! Products are being re-ranked...');
});

// Clear prompt button handler
clearPromptBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({
        userPrompt: '',
        rankingMode: 'style'
    });

    promptInput.value = '';
    clearPromptBtn.style.display = 'none';
    updateActiveModeIndicator('style');

    // Send message to content script to switch back to style mode
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'switchToStyleMode'
        });
    });

    showNotification('Switched back to My Style Mode');
});

// My Style toggle (disable prompt when enabled)
myStyleToggle.addEventListener('change', async () => {
    if (myStyleToggle.checked) {
        // Clear prompt mode
        await chrome.storage.local.set({
            userPrompt: '',
            rankingMode: 'style'
        });

        promptInput.value = '';
        clearPromptBtn.style.display = 'none';
        updateActiveModeIndicator('style');

        // Send message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'switchToStyleMode'
            });
        });
    }
});

// Enable/disable apply button based on input
promptInput.addEventListener('input', () => {
    applyPromptBtn.disabled = promptInput.value.trim().length === 0;
});

// Recent prompt chip click
function displayRecentPrompts(prompts) {
    const container = document.getElementById('recentPromptsList');
    container.innerHTML = '';

    prompts.forEach(prompt => {
        const chip = document.createElement('div');
        chip.className = 'recent-prompt-chip';
        chip.textContent = prompt;
        chip.addEventListener('click', () => {
            promptInput.value = prompt;
            applyPromptBtn.disabled = false;
            applyPromptBtn.click(); // Auto-apply
        });
        container.appendChild(chip);
    });

    document.getElementById('recentPrompts').style.display = 'block';
}

// Update active mode indicator
function updateActiveModeIndicator(mode, prompt = '') {
    const indicator = document.getElementById('activeModeIndicator');
    const text = document.getElementById('activeModeText');

    if (mode === 'prompt') {
        indicator.classList.add('prompt-mode');
        text.textContent = `🔍 Search: "${prompt}"`;
    } else {
        indicator.classList.remove('prompt-mode');
        text.textContent = '✨ Mode: My Style';
    }
}
```

**Testing**:
- Type prompt and verify "Apply" button enables
- Click "Apply" and verify prompt is saved
- Refresh popup and verify prompt persists
- Test "Clear" button returns to style mode
- Test recent prompts appear and are clickable
- Test mode indicator updates correctly
- Test My Style toggle clears prompt mode

---

#### Step 2.2: Add Prompt Input to Dashboard Tab
**Goal**: Add prompt search option to extension dashboard
**Files**: `extension/tab/tab.html`, `tab.css`, `tab.js`

**Tasks**:
1. Add prompt search section to dashboard (similar to popup but with more space for features)
2. Add prompt history table showing past searches
3. Add ability to save favorite prompts
4. Add prompt suggestions/examples

**UI Section**:
```html
<!-- Add this section to tab.html after Style Profile section -->
<section class="prompt-search-section">
    <h2>🔍 Search for Specific Items</h2>
    <p>Enter what you're looking for and we'll rank products based on your request</p>

    <div class="prompt-search-card">
        <div class="prompt-input-large-container">
            <input
                type="text"
                id="dashboardPromptInput"
                class="prompt-input-large"
                placeholder="Describe what you're looking for (e.g., black A-line dress, casual white sneakers)"
                maxlength="200"
            >
            <button id="dashboardApplyPromptBtn" class="apply-prompt-btn-large" disabled>
                Search Products
            </button>
        </div>

        <!-- Prompt suggestions -->
        <div class="prompt-suggestions">
            <span class="suggestions-label">Try these:</span>
            <div class="suggestion-chips">
                <button class="suggestion-chip" data-prompt="black A-line dress">Black A-line dress</button>
                <button class="suggestion-chip" data-prompt="casual white sneakers">Casual white sneakers</button>
                <button class="suggestion-chip" data-prompt="blue denim jacket">Blue denim jacket</button>
                <button class="suggestion-chip" data-prompt="formal blazer">Formal blazer</button>
                <button class="suggestion-chip" data-prompt="summer floral dress">Summer floral dress</button>
            </div>
        </div>
    </div>

    <!-- Prompt history -->
    <div class="prompt-history-section">
        <h3>Search History</h3>
        <div id="promptHistoryTable" class="prompt-history-table">
            <!-- Populated dynamically -->
        </div>
    </div>
</section>
```

**Testing**:
- Test prompt input and apply functionality
- Test suggestion chips populate input
- Test history table displays correctly
- Test syncing between popup and dashboard

---

### Phase 3: Content Script Integration (Days 4-5)

#### Step 3.1: Update ContentScriptManager
**Goal**: Integrate prompt ranking mode into content script
**File**: `extension/content/core/ContentScriptManager.js`

**Tasks**:
1. Import PromptRankingEngine:
```javascript
import { PromptRankingEngine } from '../ai/PromptRankingEngine.js';
```

2. Initialize in constructor:
```javascript
constructor() {
    // ... existing initialization

    this.promptRankingEngine = new PromptRankingEngine();
    this.currentRankingMode = 'style'; // or 'prompt'
    this.userPrompt = '';
}
```

3. Load ranking mode in initialize():
```javascript
async initialize() {
    // ... existing initialization

    // Load ranking mode and prompt
    const { rankingMode, userPrompt } = await chrome.storage.local.get([
        'rankingMode',
        'userPrompt'
    ]);

    this.currentRankingMode = rankingMode || 'style';
    this.userPrompt = userPrompt || '';

    console.log(`🎯 Ranking Mode: ${this.currentRankingMode}`);
    if (this.currentRankingMode === 'prompt') {
        console.log(`🔍 User Prompt: "${this.userPrompt}"`);
    }

    // ... rest of initialization
}
```

4. Add message listener for mode switching:
```javascript
setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'applyPrompt':
                this.handleApplyPrompt(message.prompt);
                sendResponse({ success: true });
                break;

            case 'switchToStyleMode':
                this.handleSwitchToStyleMode();
                sendResponse({ success: true });
                break;

            // ... existing message handlers
        }
        return true;
    });
}

async handleApplyPrompt(prompt) {
    console.log(`🔍 Applying prompt: "${prompt}"`);

    this.currentRankingMode = 'prompt';
    this.userPrompt = prompt;

    // Clear existing analysis cache
    this.productAnalysisResults.clear();
    this.promptRankingEngine.clearCache();

    // Re-analyze all detected products with new prompt
    await this.analyzeDetectedProducts();
}

async handleSwitchToStyleMode() {
    console.log('✨ Switching to Style Mode');

    this.currentRankingMode = 'style';
    this.userPrompt = '';

    // Clear prompt analysis cache
    this.promptRankingEngine.clearCache();
    this.productAnalysisResults.clear();

    // Re-analyze with style profile
    await this.analyzeDetectedProducts();
}
```

5. Update product analysis logic:
```javascript
async analyzeDetectedProducts() {
    console.log(`🔍 Analyzing ${this.detectedProducts.length} products...`);
    console.log(`   Mode: ${this.currentRankingMode}`);

    if (this.detectedProducts.length === 0) {
        console.log('⚠️ No products to analyze');
        return;
    }

    // Choose analyzer based on mode
    let analyzer;
    let analysisParam;

    if (this.currentRankingMode === 'prompt') {
        if (!this.userPrompt) {
            console.warn('⚠️ Prompt mode active but no prompt set');
            return;
        }
        analyzer = this.promptRankingEngine;
        analysisParam = this.userPrompt;
        console.log(`   Using prompt: "${this.userPrompt}"`);
    } else {
        if (!this.styleProfile) {
            console.warn('⚠️ Style mode active but no style profile loaded');
            return;
        }
        analyzer = this.productAnalyzer;
        analysisParam = this.styleProfile;
        console.log(`   Using style profile`);
    }

    // Initialize analyzer
    await analyzer.initialize();

    // Batch analyze products
    const productImages = this.detectedProducts.map(p => p.element);

    const analysisMethod = this.currentRankingMode === 'prompt'
        ? 'analyzeBatch'
        : 'analyzeBatch';

    const results = await analyzer.analyzeBatch(
        productImages,
        analysisParam,
        {
            batchSize: 3,
            delayBetweenBatches: 500,
            onProgress: (progress) => {
                console.log(`📊 Analysis progress: ${progress.percentage}%`);
            }
        }
    );

    // Update visual indicators with results
    results.forEach((result, index) => {
        const product = this.detectedProducts[index];
        if (result.success) {
            this.visualIndicators.addScoreOverlay(
                product.element,
                result.tier,
                result.reasoning,
                index
            );
        }
    });

    console.log('✅ Product analysis complete');
}
```

**Testing**:
- Test switching between modes updates rankings correctly
- Test prompt mode analyzes products with user prompt
- Test style mode continues to work as before
- Test cache clearing when switching modes
- Test message passing from popup to content script

---

#### Step 3.2: Update PromptRankingEngine Implementation
**Goal**: Complete the prompt ranking engine with all methods
**File**: `extension/content/ai/PromptRankingEngine.js`

**Tasks**:
1. Implement full `analyzeProductWithPrompt` method:
```javascript
async analyzeProductWithPrompt(productImage, userPrompt) {
    console.log('🔍 analyzeProductWithPrompt called for:', {
        alt: productImage.alt,
        prompt: userPrompt,
        src: productImage.src.substring(0, 60) + '...'
    });

    if (!this.isInitialized) {
        console.log('⚠️ PromptRankingEngine not initialized, initializing now...');
        const initialized = await this.initialize();
        if (!initialized) {
            console.error('❌ Failed to initialize PromptRankingEngine');
            return {
                success: false,
                tier: 2,
                reasoning: 'AI not available - neutral tier',
                method: 'fallback'
            };
        }
    }

    // Check cache first
    const cacheKey = this.getCacheKey(productImage, userPrompt);
    if (this.analysisCache.has(cacheKey)) {
        const cached = this.analysisCache.get(cacheKey);
        console.log('📦 Using cached analysis for product:', cached);
        return { ...cached, cached: true };
    }

    // Check if this product is already being analyzed
    if (this.pendingAnalyses.has(cacheKey)) {
        console.log('⏳ Analysis already in progress, waiting...');
        return await this.pendingAnalyses.get(cacheKey);
    }

    // Create promise for this analysis
    console.log('🚀 Starting new prompt-based analysis for product');
    const analysisPromise = this._performPromptAnalysis(productImage, userPrompt, cacheKey);
    this.pendingAnalyses.set(cacheKey, analysisPromise);

    try {
        const result = await analysisPromise;
        console.log('✅ Prompt analysis complete:', result);
        return result;
    } finally {
        this.pendingAnalyses.delete(cacheKey);
    }
}

async _performPromptAnalysis(productImage, userPrompt, cacheKey) {
    console.log('📝 _performPromptAnalysis started');

    try {
        // Build analysis prompt
        console.log('🔨 Building prompt analysis prompt...');
        const prompt = this.buildPromptAnalysisPrompt(productImage, userPrompt);
        console.log('📄 Prompt built (length: ' + prompt.length + ' chars)');

        // Create AI session
        console.log('🤖 Creating LanguageModel session for this analysis...');
        const session = await window.LanguageModel.create({
            temperature: 0.3,
            topK: 5
        });
        console.log('✅ LanguageModel session created');

        // Get AI response
        console.log('🤖 Sending prompt to session...');
        const response = await session.prompt(prompt);
        console.log('🤖 Response received:', response);

        // Clean up session
        session.destroy();
        console.log('🗑️ Session destroyed');

        // Parse response
        console.log('🔍 Parsing AI response...');
        const result = this.parseAnalysisResponse(response);
        console.log('✅ Parsed result:', result);

        // Cache the result
        this.cacheResult(cacheKey, result);

        console.log(`✅ Product analyzed with prompt: Tier ${result.tier}/3 - ${result.reasoning}`);
        return result;

    } catch (error) {
        console.error('❌ Prompt-based product analysis failed:', error);
        console.error('   Error message:', error.message);
        return {
            success: false,
            tier: 2,
            reasoning: 'Analysis error - neutral tier',
            method: 'error_fallback',
            error: error.message
        };
    }
}
```

2. Implement helper methods (extractImageContext, parseAnalysisResponse) - can reuse from ProductAnalyzer
3. Implement cache key generation:
```javascript
getCacheKey(productImage, userPrompt) {
    const imageSrc = productImage.src || productImage.currentSrc || '';
    const imageHash = imageSrc.substring(0, 50) + imageSrc.length;
    const promptHash = userPrompt.substring(0, 30) + userPrompt.length;
    return `${imageHash}_prompt_${promptHash}`;
}
```

**Testing**:
- Test analysis returns correct tiers
- Test caching works correctly
- Test error handling
- Compare prompt-based results vs style-based results

---

### Phase 4: Testing & Refinement (Day 6)

#### Step 4.1: End-to-End Testing
**Goal**: Test complete workflow across all components

**Test Cases**:
1. **Fresh Install Flow**:
   - Install extension
   - Try prompt mode without style profile
   - Upload photos and create style profile
   - Switch between modes

2. **Prompt Mode Flow**:
   - Enter prompt in popup
   - Visit e-commerce site
   - Verify products ranked by prompt
   - Change prompt and verify re-ranking

3. **Style Mode Flow**:
   - Switch to style mode
   - Verify products ranked by style profile
   - Upload new photos
   - Verify re-analysis with new profile

4. **Mode Switching**:
   - Switch from style to prompt mode
   - Verify visual indicators update
   - Switch back to style mode
   - Verify cache clearing works

5. **Edge Cases**:
   - Empty prompt
   - Very long prompt (200+ chars)
   - Special characters in prompt
   - No style profile + style mode
   - No internet connection
   - AI API rate limiting

**Performance Tests**:
- Measure time to analyze 50 products with prompt
- Compare performance: prompt mode vs style mode
- Test memory usage with large product catalogs
- Test cache effectiveness

---

#### Step 4.2: UI/UX Polish
**Goal**: Refine user experience and visual design

**Tasks**:
1. Add loading indicators during prompt analysis
2. Add success/error notifications
3. Add helpful tooltips and hints
4. Add keyboard shortcuts (Enter to apply prompt, Esc to clear)
5. Add empty states (no prompt, no style profile)
6. Add prompt validation and error messages
7. Add mode switching confirmation if analysis is in progress

**Visual Polish**:
- Ensure consistent styling across popup and dashboard
- Add smooth transitions when switching modes
- Add visual feedback for user actions
- Test on different screen sizes

---

### Phase 5: Documentation & User Guide (Day 7)

#### Step 5.1: Update Documentation
**Goal**: Document new feature for users and developers

**Files to Update**:
1. **README.md**: Add prompt mode description and usage
2. **CLAUDE.md**: Update project instructions with new architecture
3. **User Guide**: Create guide showing both ranking modes

**User Guide Content**:
```markdown
# User Guide: Product Ranking Modes

## Two Ways to Find What You Love

### 1. My Style Mode (Recommended for Discovery)
Perfect when you want to browse items that match your overall aesthetic.

**How to use**:
1. Upload 3-5 photos of yourself in different outfits
2. AI analyzes your style and creates your profile
3. Toggle "My Style Mode" in the extension popup
4. Browse any shopping site - products will be ranked by your style

**Best for**: Discovering new items, exploring fashion, style consistency

### 2. Search Mode (Recommended for Specific Needs)
Perfect when you're looking for a specific type of item.

**How to use**:
1. Click the extension icon in your browser
2. Enter what you're looking for (e.g., "black A-line dress")
3. Click "Apply"
4. Browse shopping sites - products will be ranked by your search

**Best for**: Finding specific items, targeted shopping, event preparation

### Understanding Product Tiers
Both modes use the same 3-tier system:

- ✨ **Tier 3 (Perfect Match)**: Strong match with yellow "Perfect Match" badge
- ⚪ **Tier 2 (Fine)**: Neutral match, normal appearance
- ⚫ **Tier 1 (Bad)**: Poor match, greyed out

### Switching Between Modes
You can switch anytime:
- Use "My Style" toggle for style profile mode
- Enter a prompt for search mode
- Only one mode is active at a time
```

---

## Technical Specifications

### Chrome Prompt API Usage

#### Prompt Mode Analysis
```javascript
const prompt = `Analyze this clothing item for how well it matches this specific search request:

USER IS LOOKING FOR: "${userPrompt}"

IMAGE CONTEXT:
- Alt text: "${altText}"
- Context: ${imageContext}

Rate using 3 tiers (1=bad, 2=fine, 3=good) and provide brief reasoning.`;
```

**Expected Response Format**:
```
TIER: 3
REASON: Black A-line dress matches all specified criteria perfectly.
```

#### API Call Patterns
- **Batching**: 3 products per batch, 500ms delay between batches
- **Caching**: Cache key includes prompt + image URL
- **Session Management**: Create new session per analysis, destroy after use
- **Error Handling**: Fall back to tier 2 (neutral) on API errors

### Storage Schema

```javascript
{
  // Style mode
  userPhotos: Array<base64>,
  styleProfile: Object,

  // Prompt mode
  userPrompt: String,
  rankingMode: "style" | "prompt",
  recentPrompts: Array<String>, // Max 5
  promptHistory: Array<{
    prompt: String,
    timestamp: Number,
    resultsCount: Number
  }>
}
```

### Performance Targets
- Prompt input → Analysis start: < 500ms
- 50 products analysis (prompt mode): < 30 seconds
- Mode switching: < 2 seconds
- Cache hit rate: > 70% for repeated browsing

---

## Implementation Checklist

### Phase 1: Data Model & Storage
- [ ] Update storage schema
- [ ] Create storage utility functions
- [ ] Create PromptRankingEngine module
- [ ] Implement prompt-based analysis logic
- [ ] Add caching system
- [ ] Test storage persistence

### Phase 2: UI Components
- [ ] Add prompt input to popup
- [ ] Add CSS styling
- [ ] Implement popup interaction logic
- [ ] Add prompt input to dashboard
- [ ] Add prompt history table
- [ ] Add prompt suggestions
- [ ] Test UI across screen sizes

### Phase 3: Content Script Integration
- [ ] Update ContentScriptManager
- [ ] Add message listeners
- [ ] Implement mode switching logic
- [ ] Update product analysis logic
- [ ] Complete PromptRankingEngine implementation
- [ ] Test mode switching

### Phase 4: Testing & Refinement
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Edge case testing
- [ ] UI/UX polish
- [ ] Loading indicators
- [ ] Error handling

### Phase 5: Documentation
- [ ] Update README.md
- [ ] Update CLAUDE.md
- [ ] Create user guide
- [ ] Add code comments
- [ ] Create demo video

---

## Success Metrics

### Functionality
- ✅ Users can enter text prompts
- ✅ Products are ranked by prompt match
- ✅ Visual indicators work same as style mode
- ✅ Switching between modes works smoothly
- ✅ Recent prompts are saved and accessible

### Performance
- ✅ Prompt analysis < 30s for 50 products
- ✅ Mode switching < 2s
- ✅ No memory leaks
- ✅ Cache hit rate > 70%

### User Experience
- ✅ Intuitive UI for both modes
- ✅ Clear active mode indication
- ✅ Helpful error messages
- ✅ Smooth transitions
- ✅ Consistent styling

---

## Future Enhancements (Post-MVP)

1. **Natural Language Understanding**: Improve prompt parsing to understand complex requests
2. **Multi-Attribute Prompts**: Support prompts with multiple attributes ("black dress under $50 for summer wedding")
3. **Saved Searches**: Allow users to save favorite prompts
4. **Prompt Templates**: Pre-made templates for common searches
5. **AI Suggestions**: AI suggests refinements to user's prompt
6. **Hybrid Mode**: Combine style profile + prompt (e.g., "black dress" + "my style")
7. **Voice Input**: Allow voice-based prompt entry
8. **Prompt Analytics**: Show which prompts led to purchases

---

## Migration Strategy for Existing Users

When updating the extension for existing users:

1. **Storage Migration**:
   ```javascript
   // Add to background script on extension update
   chrome.runtime.onInstalled.addListener(async (details) => {
       if (details.reason === 'update') {
           const { rankingMode } = await chrome.storage.local.get(['rankingMode']);
           if (!rankingMode) {
               await chrome.storage.local.set({
                   rankingMode: 'style',
                   userPrompt: '',
                   recentPrompts: []
               });
           }
       }
   });
   ```

2. **Onboarding**:
   - Show tooltip explaining new prompt mode
   - Add "What's New" section in dashboard
   - Highlight prompt input on first open

3. **Backward Compatibility**:
   - Ensure style mode continues to work as before
   - Don't break existing style profiles
   - Maintain same visual indicator system

---

## Appendix: Code Examples

### Complete PromptRankingEngine.js Structure
See Phase 1, Step 1.2 and Phase 3, Step 3.2 for full implementation.

### Complete Popup Integration
See Phase 2, Step 2.1 for HTML, CSS, and JS.

### Message Passing Flow
```
Popup (popup.js)
    ↓ chrome.runtime.sendMessage({ action: 'applyPrompt', prompt })
Content Script (ContentScriptManager.js)
    ↓ handleApplyPrompt(prompt)
PromptRankingEngine.js
    ↓ analyzeProductWithPrompt(img, prompt)
Chrome Prompt API
    ↓ Return tier + reasoning
VisualIndicators.js
    ↓ addScoreOverlay(img, tier, reasoning)
DOM Updated with Visual Indicators
```

---

**End of Implementation Plan**
