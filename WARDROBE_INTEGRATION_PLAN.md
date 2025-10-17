# Wardrobe Integration Implementation Plan

## Executive Summary

**Feasibility Assessment: ✅ FULLY FEASIBLE**

This document outlines a comprehensive plan to integrate your existing React Native wardrobe/looks database with the Chrome extension, enabling real-time outfit suggestions that combine website products with your personal wardrobe items on hover.

## Table of Contents

1. [Technical Feasibility Analysis](#technical-feasibility-analysis)
2. [Architecture Overview](#architecture-overview)
3. [Implementation Phases](#implementation-phases)
4. [Detailed Step-by-Step Implementation](#detailed-step-by-step-implementation)
5. [Security Considerations](#security-considerations)
6. [Testing Strategy](#testing-strategy)
7. [Alternative Approaches](#alternative-approaches)

---

## Technical Feasibility Analysis

### ✅ What Makes This Feasible

1. **Chrome Extension Capabilities**
   - Extensions can make HTTP/HTTPS requests to external APIs
   - `chrome.storage.local` can cache wardrobe data locally for fast access
   - Content scripts can inject dynamic hover overlays on any webpage
   - Background service workers can handle authentication and API communication

2. **React Native App Integration**
   - Your existing database can be exposed via REST API or GraphQL
   - Standard authentication (JWT, OAuth, session tokens) works with extensions
   - Image URLs from your database can be accessed directly by the extension

3. **AI-Powered Outfit Generation**
   - Can use Chrome's built-in AI (already integrated in your extension)
   - Can use Gemini API (already integrated via GeminiAPIManager.js)
   - Can use external AI services for advanced styling logic

4. **Real-time Performance**
   - Hover interactions can trigger instant UI overlays
   - Cached wardrobe data enables sub-100ms response times
   - Lazy loading and progressive rendering keep the experience smooth

### ⚠️ Key Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| **Cross-origin API requests** | Use CORS headers on your backend + `host_permissions` in manifest |
| **Authentication persistence** | Store tokens in `chrome.storage.local` with encryption |
| **Large wardrobe datasets** | Implement smart caching + incremental sync |
| **Hover performance** | Pre-compute outfit combinations + use Web Workers |
| **Image loading speed** | CDN for wardrobe images + lazy loading + thumbnails |
| **AI processing time** | Background pre-generation + caching popular combinations |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension Layer                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┐      ┌──────────────────┐                  │
│  │  Content Script │◄────►│  Background      │                  │
│  │                 │      │  Service Worker  │                  │
│  │  - Hover detect │      │  - Auth manager  │                  │
│  │  - Outfit UI    │      │  - API client    │                  │
│  │  - Image cache  │      │  - AI engine     │                  │
│  └────────────────┘      └──────────────────┘                  │
│         ▲                         ▲                              │
│         │                         │                              │
│         ▼                         ▼                              │
│  ┌────────────────┐      ┌──────────────────┐                  │
│  │  Popup UI      │      │  Dashboard Tab   │                  │
│  │  - Quick login │      │  - Full wardrobe │                  │
│  │  - Status      │      │  - Sync controls │                  │
│  └────────────────┘      └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS REST API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  React Native App Backend                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  Auth Service    │    │  Wardrobe API    │                  │
│  │  - Login         │    │  - GET /items    │                  │
│  │  - JWT tokens    │    │  - GET /looks    │                  │
│  │  - Session mgmt  │    │  - GET /user     │                  │
│  └──────────────────┘    └──────────────────┘                  │
│                                   ▲                              │
│                                   │                              │
│                                   ▼                              │
│                    ┌──────────────────────┐                     │
│                    │  Database            │                     │
│                    │  - User wardrobe     │                     │
│                    │  - Looks/outfits     │                     │
│                    │  - Item metadata     │                     │
│                    │  - User preferences  │                     │
│                    └──────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Backend API Preparation (1-2 days)
- Expose wardrobe database via REST API
- Implement authentication endpoints
- Add CORS configuration for Chrome extension

### Phase 2: Extension Authentication System (2-3 days)
- Build login UI in extension dashboard
- Implement secure token storage
- Create API client service

### Phase 3: Wardrobe Data Sync (2-3 days)
- Fetch and cache wardrobe items
- Implement incremental sync
- Build offline-first caching layer

### Phase 4: Hover UI System (3-4 days)
- Detect product images on hover
- Build outfit suggestion overlay
- Implement responsive positioning

### Phase 5: AI Outfit Generation (4-5 days)
- Integrate outfit matching algorithm
- Pre-compute popular combinations
- Add real-time AI suggestions

### Phase 6: Performance Optimization (2-3 days)
- Optimize image loading
- Add Web Workers for heavy computation
- Implement aggressive caching

### Phase 7: Testing & Refinement (2-3 days)
- Cross-browser testing
- Performance benchmarking
- User experience polish

**Total Estimated Time: 16-23 days**

---

## Detailed Step-by-Step Implementation

### STEP 1: Backend API Development

#### 1.1 Create Authentication Endpoints

**File: `backend/routes/auth.js` (in your React Native app backend)**

```javascript
// POST /api/auth/login
{
  username: string,
  password: string
}
// Response:
{
  success: true,
  token: "jwt_token_here",
  user: {
    id: string,
    username: string,
    email: string
  }
}

// POST /api/auth/refresh
// Headers: Authorization: Bearer <token>
// Response: { token: "new_jwt_token" }

// POST /api/auth/logout
// Headers: Authorization: Bearer <token>
```

#### 1.2 Create Wardrobe API Endpoints

**File: `backend/routes/wardrobe.js`**

```javascript
// GET /api/wardrobe/items
// Headers: Authorization: Bearer <token>
// Query params: ?page=1&limit=50&category=tops
// Response:
{
  items: [
    {
      id: string,
      name: string,
      category: "tops" | "bottoms" | "shoes" | "accessories",
      subcategory: string,
      colors: ["#hex1", "#hex2"],
      style: ["casual", "formal", "sporty"],
      imageUrl: string,
      thumbnailUrl: string,
      metadata: {
        brand: string,
        season: string,
        tags: string[]
      }
    }
  ],
  pagination: {
    page: number,
    limit: number,
    total: number,
    hasMore: boolean
  }
}

// GET /api/wardrobe/looks
// Headers: Authorization: Bearer <token>
// Response:
{
  looks: [
    {
      id: string,
      name: string,
      itemIds: [string, string, string],
      items: [/* full item objects */],
      style: string[],
      occasion: string,
      createdAt: timestamp
    }
  ]
}

// GET /api/wardrobe/sync
// Headers: Authorization: Bearer <token>
// Query: ?lastSync=timestamp
// Returns only items modified since lastSync
```

#### 1.3 Configure CORS

**File: `backend/middleware/cors.js`**

```javascript
const cors = require('cors');

// Allow Chrome extension to make requests
app.use(cors({
  origin: [
    'chrome-extension://*', // Allow all Chrome extensions during dev
    // In production, whitelist your specific extension ID:
    // 'chrome-extension://YOUR_EXTENSION_ID'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

### STEP 2: Extension Authentication System

#### 2.1 Update Manifest Permissions

**File: `extension/manifest.json`**

```json
{
  "permissions": [
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "*://*.zara.com/*",
    "*://*.hm.com/*",
    "*://*.nike.com/*",
    "https://your-backend-api.com/*"  // Add your API domain
  ],
  "optional_host_permissions": [
    "https://your-image-cdn.com/*"    // If using CDN for wardrobe images
  ]
}
```

#### 2.2 Create API Client Service

**File: `extension/services/WardrobeAPIClient.js`**

```javascript
class WardrobeAPIClient {
  constructor() {
    this.baseURL = 'https://your-backend-api.com/api';
    this.token = null;
  }

  async initialize() {
    // Load stored token
    const data = await chrome.storage.local.get(['authToken']);
    this.token = data.authToken || null;
  }

  async login(username, password) {
    try {
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        this.token = data.token;
        await chrome.storage.local.set({
          authToken: data.token,
          userData: data.user,
          loginTimestamp: Date.now()
        });
        return { success: true, user: data.user };
      }

      return { success: false, error: data.error };
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      await fetch(`${this.baseURL}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }

    // Clear local data
    this.token = null;
    await chrome.storage.local.remove(['authToken', 'userData', 'wardrobeItems', 'looks']);
  }

  async fetchWardrobeItems(options = {}) {
    if (!this.token) throw new Error('Not authenticated');

    const params = new URLSearchParams({
      page: options.page || 1,
      limit: options.limit || 50,
      category: options.category || ''
    });

    const response = await fetch(`${this.baseURL}/wardrobe/items?${params}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.logout();
        throw new Error('Session expired');
      }
      throw new Error('Failed to fetch wardrobe items');
    }

    return await response.json();
  }

  async fetchLooks() {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.baseURL}/wardrobe/looks`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch looks');
    return await response.json();
  }

  async syncWardrobe(lastSyncTimestamp) {
    if (!this.token) throw new Error('Not authenticated');

    const params = new URLSearchParams({
      lastSync: lastSyncTimestamp || 0
    });

    const response = await fetch(`${this.baseURL}/wardrobe/sync?${params}`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    if (!response.ok) throw new Error('Sync failed');
    return await response.json();
  }
}

// Export singleton instance
const wardrobeAPI = new WardrobeAPIClient();
```

#### 2.3 Create Login UI in Dashboard

**File: `extension/tab/tab.html` (add new section)**

```html
<!-- Add after the Settings Section -->
<section class="wardrobe-section">
  <h2>Wardrobe Integration</h2>
  <div class="wardrobe-content">
    <!-- Login State -->
    <div id="wardrobeLogin" class="wardrobe-login">
      <p>Connect your wardrobe to get personalized outfit suggestions</p>
      <div class="login-form">
        <input type="text" id="wardrobeUsername" placeholder="Username">
        <input type="password" id="wardrobePassword" placeholder="Password">
        <button id="wardrobeLoginBtn" class="login-btn">Login</button>
      </div>
      <div id="loginError" class="error-message" style="display: none;"></div>
    </div>

    <!-- Connected State -->
    <div id="wardrobeConnected" class="wardrobe-connected" style="display: none;">
      <div class="connected-info">
        <span class="status-icon">✅</span>
        <span id="connectedUsername"></span>
      </div>
      <div class="wardrobe-stats">
        <div class="stat-item">
          <span class="stat-label">Items:</span>
          <span id="itemCount">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Looks:</span>
          <span id="lookCount">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Last Sync:</span>
          <span id="lastSync">Never</span>
        </div>
      </div>
      <div class="wardrobe-actions">
        <button id="syncWardrobeBtn" class="sync-btn">Sync Now</button>
        <button id="wardrobeLogoutBtn" class="logout-btn">Logout</button>
      </div>
    </div>
  </div>
</section>
```

#### 2.4 Implement Login Logic

**File: `extension/tab/tab.js` (add to existing file)**

```javascript
// Initialize Wardrobe API
wardrobeAPI.initialize();

// Check if already logged in
async function checkWardrobeLoginStatus() {
  const data = await chrome.storage.local.get(['authToken', 'userData']);

  if (data.authToken && data.userData) {
    showConnectedState(data.userData);
    await loadWardrobeStats();
  } else {
    showLoginState();
  }
}

// Login handler
document.getElementById('wardrobeLoginBtn').addEventListener('click', async () => {
  const username = document.getElementById('wardrobeUsername').value;
  const password = document.getElementById('wardrobePassword').value;

  if (!username || !password) {
    showLoginError('Please enter username and password');
    return;
  }

  const loginBtn = document.getElementById('wardrobeLoginBtn');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  const result = await wardrobeAPI.login(username, password);

  if (result.success) {
    showConnectedState(result.user);
    await syncWardrobe();
  } else {
    showLoginError(result.error || 'Login failed');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
});

// Logout handler
document.getElementById('wardrobeLogoutBtn').addEventListener('click', async () => {
  await wardrobeAPI.logout();
  showLoginState();
});

// Sync handler
document.getElementById('syncWardrobeBtn').addEventListener('click', async () => {
  await syncWardrobe();
});

function showLoginState() {
  document.getElementById('wardrobeLogin').style.display = 'block';
  document.getElementById('wardrobeConnected').style.display = 'none';
}

function showConnectedState(user) {
  document.getElementById('wardrobeLogin').style.display = 'none';
  document.getElementById('wardrobeConnected').style.display = 'block';
  document.getElementById('connectedUsername').textContent = user.username;
}

function showLoginError(message) {
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

async function loadWardrobeStats() {
  const data = await chrome.storage.local.get(['wardrobeItems', 'looks', 'lastSyncTimestamp']);

  document.getElementById('itemCount').textContent = data.wardrobeItems?.length || 0;
  document.getElementById('lookCount').textContent = data.looks?.length || 0;

  if (data.lastSyncTimestamp) {
    const date = new Date(data.lastSyncTimestamp);
    document.getElementById('lastSync').textContent = date.toLocaleString();
  }
}

// Initialize on page load
checkWardrobeLoginStatus();
```

---

### STEP 3: Wardrobe Data Sync & Caching

#### 3.1 Create Wardrobe Cache Manager

**File: `extension/services/WardrobeCacheManager.js`**

```javascript
class WardrobeCacheManager {
  constructor() {
    this.syncInterval = 1000 * 60 * 30; // 30 minutes
  }

  async syncWardrobe() {
    try {
      console.log('Starting wardrobe sync...');

      // Get last sync timestamp
      const data = await chrome.storage.local.get(['lastSyncTimestamp']);
      const lastSync = data.lastSyncTimestamp || 0;

      // Fetch updated data
      const syncData = await wardrobeAPI.syncWardrobe(lastSync);

      // Get existing cached data
      const cached = await chrome.storage.local.get(['wardrobeItems', 'looks']);

      // Merge new data with existing
      const updatedItems = this.mergeItems(cached.wardrobeItems || [], syncData.items);
      const updatedLooks = this.mergeLooks(cached.looks || [], syncData.looks);

      // Save to cache
      await chrome.storage.local.set({
        wardrobeItems: updatedItems,
        looks: updatedLooks,
        lastSyncTimestamp: Date.now()
      });

      console.log(`Wardrobe synced: ${updatedItems.length} items, ${updatedLooks.length} looks`);

      return {
        success: true,
        itemCount: updatedItems.length,
        lookCount: updatedLooks.length
      };
    } catch (error) {
      console.error('Wardrobe sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  mergeItems(existingItems, newItems) {
    const itemMap = new Map(existingItems.map(item => [item.id, item]));

    // Add or update new items
    newItems.forEach(item => {
      itemMap.set(item.id, item);
    });

    return Array.from(itemMap.values());
  }

  mergeLooks(existingLooks, newLooks) {
    const lookMap = new Map(existingLooks.map(look => [look.id, look]));

    newLooks.forEach(look => {
      lookMap.set(look.id, look);
    });

    return Array.from(lookMap.values());
  }

  async getCachedWardrobe() {
    const data = await chrome.storage.local.get(['wardrobeItems', 'looks']);
    return {
      items: data.wardrobeItems || [],
      looks: data.looks || []
    };
  }

  async searchItems(query) {
    const { items } = await this.getCachedWardrobe();

    const lowerQuery = query.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery) ||
      item.style.some(s => s.toLowerCase().includes(lowerQuery))
    );
  }

  async getItemsByCategory(category) {
    const { items } = await this.getCachedWardrobe();
    return items.filter(item => item.category === category);
  }

  async getItemsByIds(ids) {
    const { items } = await this.getCachedWardrobe();
    const idSet = new Set(ids);
    return items.filter(item => idSet.has(item.id));
  }

  // Setup automatic background sync
  setupAutoSync() {
    setInterval(async () => {
      const data = await chrome.storage.local.get(['authToken']);
      if (data.authToken) {
        await this.syncWardrobe();
      }
    }, this.syncInterval);
  }
}

const wardrobeCache = new WardrobeCacheManager();
```

#### 3.2 Integrate Sync in Background Worker

**File: `extension/background/background.js` (add to existing file)**

```javascript
// Import wardrobe services
importScripts('/services/WardrobeAPIClient.js');
importScripts('/services/WardrobeCacheManager.js');

// Initialize on extension startup
chrome.runtime.onStartup.addListener(async () => {
  await wardrobeAPI.initialize();
  wardrobeCache.setupAutoSync();

  // Trigger initial sync if logged in
  const data = await chrome.storage.local.get(['authToken']);
  if (data.authToken) {
    await wardrobeCache.syncWardrobe();
  }
});

// Add message handlers for wardrobe operations
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ... existing handlers ...

  switch (request.action) {
    case 'wardrobeLogin':
      wardrobeAPI.login(request.username, request.password).then(result => {
        if (result.success) {
          wardrobeCache.syncWardrobe().then(() => {
            sendResponse(result);
          });
        } else {
          sendResponse(result);
        }
      });
      return true;

    case 'wardrobeLogout':
      wardrobeAPI.logout().then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'syncWardrobe':
      wardrobeCache.syncWardrobe().then(result => {
        sendResponse(result);
      });
      return true;

    case 'getWardrobeItems':
      wardrobeCache.getCachedWardrobe().then(data => {
        sendResponse(data);
      });
      return true;

    case 'searchWardrobeItems':
      wardrobeCache.searchItems(request.query).then(items => {
        sendResponse({ items });
      });
      return true;
  }
});
```

---

### STEP 4: Hover UI System

#### 4.1 Create Outfit Overlay Component

**File: `extension/content/ui/OutfitOverlay.js`**

```javascript
class OutfitOverlay {
  constructor() {
    this.currentOverlay = null;
    this.hoverTimeout = null;
    this.isGenerating = false;
  }

  async showOnHover(productImage, productData) {
    // Clear any existing timeout
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    // Delay showing overlay slightly to avoid accidental triggers
    this.hoverTimeout = setTimeout(async () => {
      await this.show(productImage, productData);
    }, 300);
  }

  async show(productImage, productData) {
    // Remove existing overlay
    this.hide();

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'tryme-outfit-overlay';
    overlay.innerHTML = `
      <div class="outfit-overlay-content">
        <div class="outfit-header">
          <h3>Complete the Look</h3>
          <button class="close-btn">×</button>
        </div>
        <div class="outfit-loading">
          <div class="spinner"></div>
          <p>Generating outfit suggestions...</p>
        </div>
        <div class="outfit-suggestions" style="display: none;"></div>
      </div>
    `;

    // Position overlay near the product image
    const rect = productImage.getBoundingClientRect();
    overlay.style.position = 'fixed';
    overlay.style.left = `${rect.right + 10}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.zIndex = '999999';

    // Add to page
    document.body.appendChild(overlay);
    this.currentOverlay = overlay;

    // Close button handler
    overlay.querySelector('.close-btn').addEventListener('click', () => {
      this.hide();
    });

    // Generate outfit suggestions
    await this.generateSuggestions(overlay, productData);
  }

  async generateSuggestions(overlay, productData) {
    this.isGenerating = true;

    try {
      // Request outfit suggestions from background worker
      const response = await chrome.runtime.sendMessage({
        action: 'generateOutfitSuggestions',
        productData: productData
      });

      if (response.success && response.outfits.length > 0) {
        this.renderOutfits(overlay, response.outfits, productData);
      } else {
        this.showNoSuggestions(overlay);
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      this.showError(overlay);
    } finally {
      this.isGenerating = false;
    }
  }

  renderOutfits(overlay, outfits, productData) {
    const loadingEl = overlay.querySelector('.outfit-loading');
    const suggestionsEl = overlay.querySelector('.outfit-suggestions');

    loadingEl.style.display = 'none';
    suggestionsEl.style.display = 'block';

    suggestionsEl.innerHTML = outfits.map((outfit, index) => `
      <div class="outfit-suggestion">
        <div class="outfit-items">
          <!-- Website Product (the hovered item) -->
          <div class="outfit-item website-item">
            <img src="${productData.imageUrl}" alt="${productData.name}">
            <span class="item-label">From website</span>
          </div>

          <!-- Wardrobe Items -->
          ${outfit.wardrobeItems.map(item => `
            <div class="outfit-item wardrobe-item">
              <img src="${item.thumbnailUrl || item.imageUrl}" alt="${item.name}">
              <span class="item-label">${item.name}</span>
            </div>
          `).join('')}
        </div>

        <div class="outfit-meta">
          <span class="confidence-score">Match: ${Math.round(outfit.confidence * 100)}%</span>
          <span class="style-tags">${outfit.styleTags.join(', ')}</span>
        </div>
      </div>
    `).join('');
  }

  showNoSuggestions(overlay) {
    const loadingEl = overlay.querySelector('.outfit-loading');
    loadingEl.innerHTML = `
      <p>No matching items found in your wardrobe.</p>
      <small>Try adding more items to your wardrobe!</small>
    `;
  }

  showError(overlay) {
    const loadingEl = overlay.querySelector('.outfit-loading');
    loadingEl.innerHTML = `<p>Failed to generate suggestions. Please try again.</p>`;
  }

  hide() {
    if (this.currentOverlay) {
      this.currentOverlay.remove();
      this.currentOverlay = null;
    }
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }
}

// Create singleton instance
const outfitOverlay = new OutfitOverlay();
```

#### 4.2 Add Overlay Styles

**File: `extension/content/styles/OutfitOverlay.css`**

```css
.tryme-outfit-overlay {
  position: fixed;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: 0;
  min-width: 400px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.outfit-overlay-content {
  padding: 20px;
}

.outfit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #f0f0f0;
}

.outfit-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.outfit-loading {
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f0f0f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.outfit-suggestions {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.outfit-suggestion {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
  transition: transform 0.2s;
}

.outfit-suggestion:hover {
  transform: scale(1.02);
}

.outfit-items {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  overflow-x: auto;
}

.outfit-item {
  flex: 0 0 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.outfit-item img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.outfit-item:hover img {
  border-color: #667eea;
}

.website-item img {
  border-color: #10b981;
}

.item-label {
  font-size: 12px;
  color: #666;
  text-align: center;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outfit-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #e0e0e0;
  font-size: 14px;
}

.confidence-score {
  color: #10b981;
  font-weight: 600;
}

.style-tags {
  color: #666;
  font-style: italic;
}
```

#### 4.3 Integrate Hover Detection

**File: `extension/content/content.generated.js` (modify existing file)**

```javascript
// Add to existing content script initialization

// Import outfit overlay
// (Ensure OutfitOverlay.js is loaded before this)

// Track hover state
let hoverTimeout = null;

// Attach hover listeners to detected product images
function attachOutfitHoverListeners() {
  const productImages = document.querySelectorAll('[data-tryme-product="true"]');

  productImages.forEach(img => {
    // Remove existing listeners
    img.removeEventListener('mouseenter', handleProductHover);
    img.removeEventListener('mouseleave', handleProductLeave);

    // Add new listeners
    img.addEventListener('mouseenter', handleProductHover);
    img.addEventListener('mouseleave', handleProductLeave);
  });
}

async function handleProductHover(event) {
  const img = event.target;

  // Check if wardrobe is connected
  const data = await chrome.storage.local.get(['authToken']);
  if (!data.authToken) {
    return; // User not logged in to wardrobe
  }

  // Extract product data
  const productData = {
    imageUrl: img.src,
    name: img.alt || 'Product',
    url: window.location.href,
    // Extract additional data from parent elements if available
    price: extractPrice(img),
    category: detectCategory(img)
  };

  // Show outfit overlay
  outfitOverlay.showOnHover(img, productData);
}

function handleProductLeave(event) {
  // Hide overlay after a delay (allows moving mouse to overlay)
  setTimeout(() => {
    if (!document.querySelector('.tryme-outfit-overlay:hover')) {
      outfitOverlay.hide();
    }
  }, 200);
}

function extractPrice(img) {
  // Try to find price in nearby elements
  const productCard = img.closest('[class*="product"], [class*="item"]');
  if (productCard) {
    const priceEl = productCard.querySelector('[class*="price"]');
    if (priceEl) {
      return priceEl.textContent.trim();
    }
  }
  return null;
}

function detectCategory(img) {
  // Basic category detection from URL or alt text
  const alt = img.alt.toLowerCase();
  const url = window.location.href.toLowerCase();

  if (alt.includes('shirt') || alt.includes('top') || url.includes('/tops/')) {
    return 'tops';
  } else if (alt.includes('pant') || alt.includes('jean') || url.includes('/bottoms/')) {
    return 'bottoms';
  } else if (alt.includes('shoe') || url.includes('/shoes/')) {
    return 'shoes';
  }

  return 'unknown';
}

// Call after product detection completes
// Add to existing detectProductImages() function:
// attachOutfitHoverListeners();
```

---

### STEP 5: AI Outfit Generation Engine

#### 5.1 Create Outfit Matching Algorithm

**File: `extension/services/OutfitMatcher.js`**

```javascript
class OutfitMatcher {
  constructor() {
    this.cache = new Map(); // Cache generated outfits
  }

  async generateOutfits(websiteProduct, wardrobeItems, options = {}) {
    const maxOutfits = options.maxOutfits || 3;

    // Check cache first
    const cacheKey = this.getCacheKey(websiteProduct);
    if (this.cache.has(cacheKey)) {
      console.log('Using cached outfits');
      return this.cache.get(cacheKey);
    }

    // Categorize website product
    const productCategory = this.categorizeProduct(websiteProduct);

    // Filter wardrobe for complementary items
    const complementaryItems = this.getComplementaryItems(productCategory, wardrobeItems);

    // Generate outfit combinations
    const outfits = await this.createOutfitCombinations(
      websiteProduct,
      productCategory,
      complementaryItems,
      maxOutfits
    );

    // Cache results
    this.cache.set(cacheKey, outfits);

    return outfits;
  }

  categorizeProduct(product) {
    // Use AI to categorize if category not provided
    if (product.category && product.category !== 'unknown') {
      return product.category;
    }

    // Fallback to keyword matching
    const text = `${product.name} ${product.url}`.toLowerCase();

    if (text.match(/shirt|blouse|top|tee|sweater|hoodie/)) return 'tops';
    if (text.match(/pant|jean|trouser|short|skirt|dress/)) return 'bottoms';
    if (text.match(/shoe|sneaker|boot|sandal|heel/)) return 'shoes';
    if (text.match(/bag|belt|hat|scarf|jewelry|watch/)) return 'accessories';

    return 'unknown';
  }

  getComplementaryItems(productCategory, wardrobeItems) {
    // Define what items complement each category
    const complementaryMap = {
      tops: ['bottoms', 'shoes', 'accessories'],
      bottoms: ['tops', 'shoes', 'accessories'],
      shoes: ['tops', 'bottoms', 'accessories'],
      accessories: ['tops', 'bottoms', 'shoes'],
      unknown: ['tops', 'bottoms', 'shoes', 'accessories']
    };

    const allowedCategories = complementaryMap[productCategory] || [];

    return wardrobeItems.filter(item =>
      allowedCategories.includes(item.category)
    );
  }

  async createOutfitCombinations(websiteProduct, productCategory, wardrobeItems, maxOutfits) {
    const outfits = [];

    // Group items by category
    const itemsByCategory = this.groupByCategory(wardrobeItems);

    // Generate combinations based on product category
    if (productCategory === 'tops') {
      // Need: bottoms + optional shoes/accessories
      const bottoms = itemsByCategory.bottoms || [];
      const shoes = itemsByCategory.shoes || [];
      const accessories = itemsByCategory.accessories || [];

      for (let i = 0; i < Math.min(maxOutfits, bottoms.length); i++) {
        const outfit = {
          websiteProduct: websiteProduct,
          wardrobeItems: [bottoms[i]],
          confidence: 0,
          styleTags: []
        };

        // Add shoes if available
        if (shoes.length > 0) {
          outfit.wardrobeItems.push(shoes[i % shoes.length]);
        }

        // Add accessories if available
        if (accessories.length > 0 && Math.random() > 0.5) {
          outfit.wardrobeItems.push(accessories[i % accessories.length]);
        }

        // Calculate confidence score
        outfit.confidence = await this.calculateMatchScore(websiteProduct, outfit.wardrobeItems);
        outfit.styleTags = this.extractStyleTags(outfit);

        outfits.push(outfit);
      }
    } else if (productCategory === 'bottoms') {
      // Need: tops + optional shoes/accessories
      const tops = itemsByCategory.tops || [];
      const shoes = itemsByCategory.shoes || [];
      const accessories = itemsByCategory.accessories || [];

      for (let i = 0; i < Math.min(maxOutfits, tops.length); i++) {
        const outfit = {
          websiteProduct: websiteProduct,
          wardrobeItems: [tops[i]],
          confidence: 0,
          styleTags: []
        };

        if (shoes.length > 0) {
          outfit.wardrobeItems.push(shoes[i % shoes.length]);
        }

        if (accessories.length > 0 && Math.random() > 0.5) {
          outfit.wardrobeItems.push(accessories[i % accessories.length]);
        }

        outfit.confidence = await this.calculateMatchScore(websiteProduct, outfit.wardrobeItems);
        outfit.styleTags = this.extractStyleTags(outfit);

        outfits.push(outfit);
      }
    } else if (productCategory === 'shoes') {
      // Need: tops + bottoms + optional accessories
      const tops = itemsByCategory.tops || [];
      const bottoms = itemsByCategory.bottoms || [];
      const accessories = itemsByCategory.accessories || [];

      for (let i = 0; i < Math.min(maxOutfits, Math.min(tops.length, bottoms.length)); i++) {
        const outfit = {
          websiteProduct: websiteProduct,
          wardrobeItems: [tops[i], bottoms[i]],
          confidence: 0,
          styleTags: []
        };

        if (accessories.length > 0 && Math.random() > 0.5) {
          outfit.wardrobeItems.push(accessories[i % accessories.length]);
        }

        outfit.confidence = await this.calculateMatchScore(websiteProduct, outfit.wardrobeItems);
        outfit.styleTags = this.extractStyleTags(outfit);

        outfits.push(outfit);
      }
    }

    // Sort by confidence
    outfits.sort((a, b) => b.confidence - a.confidence);

    return outfits.slice(0, maxOutfits);
  }

  groupByCategory(items) {
    return items.reduce((groups, item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
      return groups;
    }, {});
  }

  async calculateMatchScore(websiteProduct, wardrobeItems) {
    // Use AI to calculate style compatibility
    // For now, use heuristic approach

    let score = 0.7; // Base score

    // Color matching (simplified)
    const productColors = websiteProduct.colors || [];
    const wardrobeColors = wardrobeItems.flatMap(item => item.colors || []);

    if (this.hasComplementaryColors(productColors, wardrobeColors)) {
      score += 0.15;
    }

    // Style matching
    const productStyles = websiteProduct.style || [];
    const wardrobeStyles = wardrobeItems.flatMap(item => item.style || []);

    if (this.hasCommonStyles(productStyles, wardrobeStyles)) {
      score += 0.15;
    }

    return Math.min(score, 1.0);
  }

  hasComplementaryColors(colors1, colors2) {
    // Simplified color matching
    // In production, use color theory algorithms
    return colors1.length > 0 && colors2.length > 0;
  }

  hasCommonStyles(styles1, styles2) {
    return styles1.some(s => styles2.includes(s));
  }

  extractStyleTags(outfit) {
    const allItems = [outfit.websiteProduct, ...outfit.wardrobeItems];
    const styles = new Set();

    allItems.forEach(item => {
      if (item.style) {
        item.style.forEach(s => styles.add(s));
      }
    });

    return Array.from(styles);
  }

  getCacheKey(product) {
    return `${product.url}_${product.imageUrl}`;
  }
}

const outfitMatcher = new OutfitMatcher();
```

#### 5.2 Integrate AI-Powered Matching (Optional Enhancement)

**File: `extension/services/AIOutfitMatcher.js`**

```javascript
// Enhanced version using Chrome AI / Gemini
class AIOutfitMatcher extends OutfitMatcher {
  async calculateMatchScore(websiteProduct, wardrobeItems) {
    try {
      // Use Chrome AI or Gemini to analyze style compatibility
      const prompt = this.buildMatchingPrompt(websiteProduct, wardrobeItems);

      const result = await chrome.runtime.sendMessage({
        action: 'aiPrompt',
        prompt: prompt,
        options: { temperature: 0.3 }
      });

      if (result.success) {
        return this.parseMatchScore(result.response);
      }
    } catch (error) {
      console.error('AI matching failed, using fallback:', error);
    }

    // Fallback to heuristic approach
    return await super.calculateMatchScore(websiteProduct, wardrobeItems);
  }

  buildMatchingPrompt(websiteProduct, wardrobeItems) {
    const itemDescriptions = wardrobeItems.map(item =>
      `${item.category}: ${item.name} (${item.style.join(', ')})`
    ).join('\n');

    return `Analyze the style compatibility of this outfit combination:

Website Product: ${websiteProduct.name} (${websiteProduct.category})

Wardrobe Items:
${itemDescriptions}

Rate the overall style compatibility on a scale of 0.0 to 1.0, where:
- 1.0 = Perfect match, cohesive style
- 0.7 = Good match, works well together
- 0.5 = Acceptable match, neutral
- 0.3 = Poor match, clashing styles
- 0.0 = Completely incompatible

Respond with ONLY a number between 0.0 and 1.0.`;
  }

  parseMatchScore(response) {
    const match = response.match(/\d+\.\d+/);
    if (match) {
      return parseFloat(match[0]);
    }
    return 0.7; // Default score
  }
}
```

#### 5.3 Add Background Message Handler

**File: `extension/background/background.js` (add to existing handlers)**

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ... existing handlers ...

  if (request.action === 'generateOutfitSuggestions') {
    generateOutfitSuggestions(request.productData).then(result => {
      sendResponse(result);
    });
    return true;
  }
});

async function generateOutfitSuggestions(productData) {
  try {
    // Get cached wardrobe items
    const wardrobe = await wardrobeCache.getCachedWardrobe();

    if (wardrobe.items.length === 0) {
      return {
        success: false,
        error: 'No wardrobe items available',
        outfits: []
      };
    }

    // Generate outfit combinations
    const outfits = await outfitMatcher.generateOutfits(productData, wardrobe.items, {
      maxOutfits: 3
    });

    return {
      success: true,
      outfits: outfits
    };
  } catch (error) {
    console.error('Failed to generate outfit suggestions:', error);
    return {
      success: false,
      error: error.message,
      outfits: []
    };
  }
}
```

---

### STEP 6: Performance Optimization

#### 6.1 Implement Image Lazy Loading

**File: `extension/services/ImageLoader.js`**

```javascript
class ImageLoader {
  constructor() {
    this.cache = new Map();
    this.loadingQueue = [];
    this.maxConcurrent = 4;
    this.activeLoads = 0;
  }

  async loadImage(url) {
    // Check cache
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    // Queue loading
    return new Promise((resolve, reject) => {
      this.loadingQueue.push({ url, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    while (this.activeLoads < this.maxConcurrent && this.loadingQueue.length > 0) {
      const item = this.loadingQueue.shift();
      this.activeLoads++;

      try {
        const blob = await this.fetchImage(item.url);
        const objectURL = URL.createObjectURL(blob);
        this.cache.set(item.url, objectURL);
        item.resolve(objectURL);
      } catch (error) {
        item.reject(error);
      } finally {
        this.activeLoads--;
        this.processQueue();
      }
    }
  }

  async fetchImage(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Image load failed');
    return await response.blob();
  }

  preloadImages(urls) {
    urls.forEach(url => this.loadImage(url).catch(console.error));
  }
}

const imageLoader = new ImageLoader();
```

#### 6.2 Add Web Worker for Heavy Computation

**File: `extension/workers/outfit-worker.js`**

```javascript
// Dedicated worker for outfit generation
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'generateOutfits':
      const outfits = await generateOutfitsInWorker(data.product, data.wardrobe);
      self.postMessage({ type: 'outfitsGenerated', outfits });
      break;
  }
});

async function generateOutfitsInWorker(product, wardrobeItems) {
  // Perform heavy outfit generation computation
  // This runs off the main thread to keep UI responsive

  // Import matching algorithm
  importScripts('/services/OutfitMatcher.js');

  return await outfitMatcher.generateOutfits(product, wardrobeItems);
}
```

#### 6.3 Optimize Cache with IndexedDB

**File: `extension/services/IndexedDBCache.js`**

```javascript
// For larger datasets, use IndexedDB instead of chrome.storage.local
class IndexedDBCache {
  constructor() {
    this.dbName = 'TryMeWardrobe';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('items')) {
          db.createObjectStore('items', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('looks')) {
          db.createObjectStore('looks', { keyPath: 'id' });
        }
      };
    });
  }

  async saveItems(items) {
    const transaction = this.db.transaction(['items'], 'readwrite');
    const store = transaction.objectStore('items');

    for (const item of items) {
      store.put(item);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getItems() {
    const transaction = this.db.transaction(['items'], 'readonly');
    const store = transaction.objectStore('items');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
```

---

### STEP 7: Testing & Quality Assurance

#### 7.1 Test Checklist

**File: `TESTING_CHECKLIST.md`**

```markdown
# Wardrobe Integration Testing Checklist

## Authentication Tests
- [ ] Successful login with valid credentials
- [ ] Failed login with invalid credentials
- [ ] Token persistence across browser restarts
- [ ] Automatic logout on 401 errors
- [ ] Session timeout handling

## Data Sync Tests
- [ ] Initial wardrobe sync downloads all items
- [ ] Incremental sync only fetches new/updated items
- [ ] Sync works after browser restart
- [ ] Sync handles network failures gracefully
- [ ] Large wardrobes (1000+ items) sync without errors

## Hover UI Tests
- [ ] Overlay appears on hover after 300ms delay
- [ ] Overlay positions correctly next to product image
- [ ] Overlay closes when clicking X button
- [ ] Overlay closes when clicking outside
- [ ] Multiple rapid hovers don't create multiple overlays
- [ ] Overlay displays correctly on different screen sizes

## Outfit Generation Tests
- [ ] Generates valid outfit combinations for tops
- [ ] Generates valid outfit combinations for bottoms
- [ ] Generates valid outfit combinations for shoes
- [ ] Matches at least 1 outfit when wardrobe has items
- [ ] Shows "no matches" message when wardrobe is empty
- [ ] Confidence scores are between 0-100%
- [ ] Style tags display correctly

## Performance Tests
- [ ] Hover response time < 500ms
- [ ] Outfit generation time < 2 seconds
- [ ] Page scrolling remains smooth with extension active
- [ ] No memory leaks after extended use
- [ ] Image loading doesn't block UI
- [ ] Cache reduces API calls effectively

## Cross-Site Tests
- [ ] Works on Zara product pages
- [ ] Works on H&M product pages
- [ ] Works on Nike product pages
- [ ] Handles different product card layouts
- [ ] Adapts to mobile-responsive site layouts

## Error Handling Tests
- [ ] Graceful degradation when API is down
- [ ] Clear error messages for users
- [ ] Continues working with cached data when offline
- [ ] Recovers from AI API failures
```

#### 7.2 Performance Benchmarks

Target performance metrics:

- **Initial Sync Time**: < 10 seconds for 500 items
- **Hover to Overlay**: < 300ms
- **Outfit Generation**: < 2 seconds
- **Image Loading**: < 500ms per image
- **Memory Usage**: < 100MB for extension
- **Cache Hit Rate**: > 80% for repeat visits

---

## Security Considerations

### 5.1 Token Storage Security

- **Use chrome.storage.local with encryption**: Never store tokens in plaintext
- **Implement token refresh**: Rotate tokens periodically
- **Clear sensitive data on logout**: Remove all cached user data

### 5.2 API Communication Security

- **HTTPS only**: All API requests must use HTTPS
- **CORS validation**: Backend should whitelist specific extension ID
- **Rate limiting**: Prevent abuse with request throttling
- **Input validation**: Sanitize all data before sending to API

### 5.3 User Privacy

- **No tracking**: Don't send browsing data to your backend
- **Local AI processing**: Use Chrome AI for sensitive analysis
- **Transparent data usage**: Clearly document what data is collected

---

## Alternative Approaches

### Approach 1: GraphQL Instead of REST
- More efficient data fetching with selective field queries
- Better for complex wardrobe relationships
- Requires GraphQL client library in extension

### Approach 2: Firebase Integration
- Use Firebase Authentication for easier auth flow
- Use Firestore for real-time wardrobe sync
- Reduces backend development effort

### Approach 3: Offline-First PWA
- Convert extension to Progressive Web App
- Use Service Workers for advanced caching
- Enable full offline functionality

### Approach 4: Browser Native AI Only
- Remove dependency on external backend
- Store wardrobe in chrome.storage.local
- Use Chrome's built-in AI for all matching
- More privacy-friendly but limited by storage quotas

---

## Implementation Timeline

| Phase | Duration | Dependencies | Risk Level |
|-------|----------|--------------|------------|
| Phase 1: Backend API | 2 days | React Native backend access | Low |
| Phase 2: Authentication | 3 days | Phase 1 complete | Low |
| Phase 3: Data Sync | 3 days | Phase 2 complete | Medium |
| Phase 4: Hover UI | 4 days | Phase 3 complete | Medium |
| Phase 5: AI Matching | 5 days | Phase 4 complete | High |
| Phase 6: Optimization | 3 days | Phase 5 complete | Medium |
| Phase 7: Testing | 3 days | All phases complete | Low |

**Total: 23 days (approximately 4-5 weeks)**

---

## Next Steps

1. **Immediate Actions**
   - Expose your React Native database via REST API
   - Set up CORS configuration
   - Test API endpoints with Postman

2. **Week 1**
   - Implement authentication endpoints
   - Build extension login UI
   - Test end-to-end authentication

3. **Week 2**
   - Implement wardrobe sync
   - Build caching layer
   - Test with real wardrobe data

4. **Week 3**
   - Build hover UI system
   - Implement outfit overlay
   - Test on all supported sites

5. **Week 4**
   - Integrate AI outfit matching
   - Performance optimization
   - User testing and refinement

---

## Conclusion

This integration is **highly feasible** and will significantly enhance the user experience by:

- Providing personalized outfit suggestions in real-time
- Leveraging existing wardrobe data
- Creating a seamless shopping experience
- Increasing engagement with both the extension and your React Native app

The main technical challenges (CORS, authentication, caching) have proven solutions, and the modular architecture of your existing extension makes integration straightforward.

**Recommendation: Proceed with implementation starting with Phase 1 (Backend API).**
