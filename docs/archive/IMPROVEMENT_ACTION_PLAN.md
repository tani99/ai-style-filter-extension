# TryMe Extension - Actionable Improvement Plan

**Date Created:** October 22, 2025  
**Priority System:** 🔴 Critical | 🟡 High | 🟢 Medium | 🔵 Low

---

## Quick Action Checklist

### This Week (Critical Items)
- [ ] Complete security audit
- [ ] Add message input validation
- [ ] Verify Firebase security rules
- [ ] Check git history for credentials

### This Month (High Priority)
- [ ] Modularize background worker
- [ ] Implement rate limiting
- [ ] Add request batching
- [ ] Create basic test suite

### This Quarter (Medium Priority)
- [ ] Expand to 3+ more sites
- [ ] Improve build system
- [ ] Add comprehensive documentation
- [ ] Implement performance monitoring

---

## Detailed Action Items

## 1. Security Audit 🔴 CRITICAL

**Priority:** CRITICAL  
**Estimated Time:** 2-3 hours  
**Dependencies:** None  
**Impact:** High - Protects user data and API keys

### Tasks

#### 1.1 Firebase Security Rules Review
**Action:**
```bash
# 1. Open Firebase Console
# 2. Navigate to Firestore Database > Rules
# 3. Verify rules follow this pattern:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own wardrobe items
    match /wardrobeItems/{itemId} {
      allow read, write: if request.auth != null && 
                           resource.data.userId == request.auth.uid;
    }
    
    // Users can only read/write their own looks
    match /looks/{lookId} {
      allow read, write: if request.auth != null && 
                           resource.data.userId == request.auth.uid;
    }
  }
}
```

**Checklist:**
- [ ] Verify users can only access their own data
- [ ] Check for any public read/write rules
- [ ] Ensure authentication is required
- [ ] Test with multiple user accounts
- [ ] Document security rules in codebase

#### 1.2 Check Git History for Credentials
**Action:**
```bash
cd /Users/tanisha/Desktop/TryMe

# Search for potential API keys in history
git log --all --full-history --source --pretty=format:'%H' -- extension/config/firebase-config.js | while read commit; do
    echo "Checking commit: $commit"
    git show $commit:extension/config/firebase-config.js 2>/dev/null || echo "File not found in commit"
done

# Search for any API keys in all history
git log --all --full-history -p | grep -i "apikey\|api_key\|secret" | head -20

# Check if firebase-config.js was ever committed
git log --all -- extension/config/firebase-config.js
```

**Checklist:**
- [ ] Run git history audit
- [ ] If credentials found, rotate all API keys
- [ ] Update Firebase API restrictions
- [ ] Force push cleaned history (if needed)
- [ ] Document incident and prevention

#### 1.3 Add Message Input Validation
**Action:** Create `extension/background/message-validator.js`

```javascript
// extension/background/message-validator.js

class MessageValidator {
  static MESSAGE_SCHEMAS = {
    'analyzeWardrobeItem': {
      required: ['itemId', 'imageUrl', 'category'],
      types: {
        itemId: 'string',
        imageUrl: 'string',
        category: 'string'
      },
      validators: {
        imageUrl: (url) => {
          try {
            new URL(url);
            return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
          } catch {
            return false;
          }
        }
      }
    },
    
    'firebaseLogin': {
      required: ['email', 'password'],
      types: {
        email: 'string',
        password: 'string'
      },
      validators: {
        email: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        password: (pwd) => pwd.length >= 6
      }
    },
    
    // Add more schemas...
  };

  static validate(action, request) {
    const schema = this.MESSAGE_SCHEMAS[action];
    if (!schema) {
      throw new Error(`Unknown message action: ${action}`);
    }

    // Check required fields
    for (const field of schema.required) {
      if (!(field in request)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Check types
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (field in request && typeof request[field] !== expectedType) {
        throw new Error(`Invalid type for ${field}: expected ${expectedType}, got ${typeof request[field]}`);
      }
    }

    // Run custom validators
    if (schema.validators) {
      for (const [field, validator] of Object.entries(schema.validators)) {
        if (field in request && !validator(request[field])) {
          throw new Error(`Validation failed for ${field}`);
        }
      }
    }

    return true;
  }
}
```

**Then update background.js:**
```javascript
// Add at top of background.js
importScripts('/background/message-validator.js');

// Update message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    try {
        // Validate message
        if (request.action) {
            MessageValidator.validate(request.action, request);
        }
        
        // Existing switch statement...
        switch (request.action) {
            // ... rest of code
        }
    } catch (error) {
        console.error('Message validation error:', error);
        sendResponse({ success: false, error: error.message });
        return;
    }
});
```

**Checklist:**
- [ ] Create MessageValidator class
- [ ] Add schemas for all message types
- [ ] Integrate into background.js
- [ ] Test with invalid inputs
- [ ] Document message protocol

#### 1.4 API Key Security Check
**Action:** Review API key storage and restrictions

**Gemini API:**
- [ ] Verify API key stored only in chrome.storage.local
- [ ] Check Firebase Console > API & Services > Credentials
- [ ] Add API key restrictions:
  - Application restrictions: None (extension needs it)
  - API restrictions: Limit to Gemini API only
  - Quota limits: Set daily limits

**Firebase API:**
- [ ] Check Firebase project settings
- [ ] Verify API key restrictions in Google Cloud Console
- [ ] Ensure domain restrictions if possible

**Checklist:**
- [ ] Audit all API keys
- [ ] Apply appropriate restrictions
- [ ] Set quota limits
- [ ] Document key management process

---

## 2. Modularize Background Worker 🔴 CRITICAL

**Priority:** CRITICAL  
**Estimated Time:** 4-6 hours  
**Dependencies:** None  
**Impact:** High - Improves maintainability and debugging

### File Structure to Create

```
extension/background/
├── background.js (main coordinator, <200 lines)
├── message-validator.js (input validation)
├── message-router.js (route messages to handlers)
├── handlers/
│   ├── ai-handler.js (Chrome AI operations)
│   ├── firebase-handler.js (Firebase operations)
│   ├── gemini-handler.js (Gemini API operations)
│   ├── wardrobe-handler.js (Wardrobe analysis)
│   └── outfit-handler.js (Outfit matching)
├── prompts/
│   ├── style-profile-prompt.json
│   ├── wardrobe-analysis-prompt.json
│   ├── outfit-filter-prompt.json
│   └── outfit-compose-prompt.json
└── utils/
    ├── ai-utils.js (shared AI utilities)
    └── cache-utils.js (caching utilities)
```

### Implementation Steps

#### Step 1: Create Message Router
```javascript
// extension/background/message-router.js

class MessageRouter {
  constructor() {
    this.handlers = new Map();
  }

  register(action, handler) {
    this.handlers.set(action, handler);
  }

  async route(request, sender) {
    const handler = this.handlers.get(request.action);
    if (!handler) {
      throw new Error(`No handler for action: ${request.action}`);
    }
    return await handler(request, sender);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessageRouter;
}
```

#### Step 2: Create AI Handler
```javascript
// extension/background/handlers/ai-handler.js

class AIHandler {
  constructor() {
    this.prompts = {}; // Load from JSON files
  }

  async handleAIPrompt(request) {
    return await executeAIPrompt(request.prompt, request.options);
  }

  async handleStyleProfileAnalysis(request) {
    const prompt = this.prompts.styleProfile
      .replace('{{photoCount}}', request.photoCount);
    
    return await executeAIPromptWithMultipleImages(
      prompt,
      request.photoDataUrls,
      request.options
    );
  }

  // ... more handlers
}
```

#### Step 3: Update Main Background.js
```javascript
// extension/background/background.js (NEW - much shorter)

// Import modules
importScripts('/background/message-validator.js');
importScripts('/background/message-router.js');
importScripts('/background/handlers/ai-handler.js');
importScripts('/background/handlers/firebase-handler.js');
importScripts('/background/handlers/gemini-handler.js');
importScripts('/background/handlers/wardrobe-handler.js');

// Initialize
const router = new MessageRouter();
const aiHandler = new AIHandler();
const firebaseHandler = new FirebaseHandler();
const geminiHandler = new GeminiHandler();
const wardrobeHandler = new WardrobeHandler();

// Register handlers
router.register('aiPrompt', (req) => aiHandler.handleAIPrompt(req));
router.register('firebaseLogin', (req) => firebaseHandler.handleLogin(req));
router.register('generateTryOn', (req) => geminiHandler.handleTryOn(req));
router.register('analyzeWardrobeItem', (req) => wardrobeHandler.handleAnalyzeItem(req));
// ... register all handlers

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    MessageValidator.validate(request.action, request);
    router.route(request, sender).then(sendResponse);
    return true; // Keep channel open
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
});

// Lifecycle handlers
chrome.runtime.onInstalled.addListener(handleInstall);
chrome.runtime.onStartup.addListener(handleStartup);
```

#### Step 4: Extract Prompts to JSON
```json
// extension/background/prompts/style-profile-prompt.json
{
  "version": "1.0",
  "name": "Style Profile Analysis",
  "description": "Analyzes user photos to generate comprehensive style profile",
  "template": "You are an expert fashion stylist and personal style consultant. I have uploaded {{photoCount}} photos showing different outfits. Please analyze the ACTUAL IMAGES provided...",
  "variables": ["photoCount"],
  "expectedOutput": "JSON",
  "options": {
    "temperature": 0.7,
    "maxRetries": 3
  }
}
```

**Checklist:**
- [ ] Create message router
- [ ] Create AI handler module
- [ ] Create Firebase handler module
- [ ] Create Gemini handler module
- [ ] Create wardrobe handler module
- [ ] Extract all prompts to JSON
- [ ] Update background.js to use modules
- [ ] Test all functionality still works
- [ ] Update manifest if needed

---

## 3. Implement Rate Limiting 🔴 CRITICAL

**Priority:** CRITICAL  
**Estimated Time:** 2-3 hours  
**Dependencies:** None  
**Impact:** Medium - Prevents quota issues and API abuse

### Implementation

```javascript
// extension/background/utils/rate-limiter.js

class RateLimiter {
  constructor(maxRequests, timeWindow) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow; // in milliseconds
    this.requests = [];
  }

  async checkLimit() {
    const now = Date.now();
    
    // Remove old requests outside time window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.timeWindow
    );

    // Check if at limit
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.timeWindow - (now - oldestRequest);
      
      console.warn(`Rate limit reached. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      return this.checkLimit(); // Retry
    }

    // Record this request
    this.requests.push(now);
    return true;
  }

  reset() {
    this.requests = [];
  }
}

// Create rate limiters for different APIs
const chromeAILimiter = new RateLimiter(60, 60000); // 60 requests per minute
const geminiLimiter = new RateLimiter(10, 60000);    // 10 requests per minute
const firestoreLimiter = new RateLimiter(100, 60000); // 100 requests per minute
```

**Usage:**
```javascript
// Before making Chrome AI call
await chromeAILimiter.checkLimit();
const result = await executeAIPrompt(prompt);

// Before making Gemini call
await geminiLimiter.checkLimit();
const result = await geminiManager.generateTryOn(userPhoto, clothingImage);
```

**Checklist:**
- [ ] Create RateLimiter class
- [ ] Add limiter for Chrome AI
- [ ] Add limiter for Gemini API
- [ ] Add limiter for Firestore
- [ ] Integrate into all API calls
- [ ] Add rate limit UI feedback
- [ ] Test with rapid requests
- [ ] Document rate limits

---

## 4. Performance Optimization 🟡 HIGH

**Priority:** HIGH  
**Estimated Time:** 3-4 hours  
**Dependencies:** None  
**Impact:** High - Significantly improves user experience

### 4.1 Batch Wardrobe Analysis

**Current (Sequential):**
```javascript
// SLOW - analyzes one at a time
for (const item of itemsNeedingAnalysis) {
  await analyzeWardrobeItem(item.id, item.imageUrl, item.category);
}
```

**New (Batched):**
```javascript
// extension/background/utils/batch-processor.js

class BatchProcessor {
  constructor(batchSize = 5, delayBetweenBatches = 1000) {
    this.batchSize = batchSize;
    this.delayBetweenBatches = delayBetweenBatches;
  }

  async processBatch(items, processFunc, progressCallback) {
    const batches = this.createBatches(items, this.batchSize);
    const results = [];
    let processed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(item => processFunc(item))
      );

      results.push(...batchResults);
      processed += batch.length;

      // Report progress
      if (progressCallback) {
        progressCallback({
          processed,
          total: items.length,
          batchNumber: i + 1,
          totalBatches: batches.length
        });
      }

      // Delay between batches (except last one)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }

    return results;
  }

  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

// Usage
const batchProcessor = new BatchProcessor(5, 1000);
await batchProcessor.processBatch(
  itemsNeedingAnalysis,
  (item) => analyzeWardrobeItem(item.id, item.imageUrl, item.category),
  (progress) => {
    console.log(`Progress: ${progress.processed}/${progress.total}`);
  }
);
```

**Checklist:**
- [ ] Create BatchProcessor class
- [ ] Update analyzeAllWardrobeItems to use batching
- [ ] Add progress reporting
- [ ] Test with large wardrobes
- [ ] Measure performance improvement

### 4.2 Request Queue

```javascript
// extension/background/utils/request-queue.js

class RequestQueue {
  constructor(concurrencyLimit = 3) {
    this.queue = [];
    this.active = 0;
    this.concurrencyLimit = concurrencyLimit;
  }

  async add(requestFunc, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFunc, priority, resolve, reject });
      this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
      this.process();
    });
  }

  async process() {
    if (this.active >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }

    this.active++;
    const { requestFunc, resolve, reject } = this.queue.shift();

    try {
      const result = await requestFunc();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.active--;
      this.process(); // Process next in queue
    }
  }

  getQueueLength() {
    return this.queue.length;
  }
}

// Create queue
const aiQueue = new RequestQueue(3); // Max 3 concurrent AI requests

// Usage
const result = await aiQueue.add(
  () => executeAIPrompt(prompt, options),
  priority // 0 = normal, 1 = high, 2 = urgent
);
```

**Checklist:**
- [ ] Create RequestQueue class
- [ ] Integrate with Chrome AI calls
- [ ] Integrate with Gemini API calls
- [ ] Add priority system
- [ ] Test concurrent requests
- [ ] Add queue monitoring

### 4.3 Cache Size Management

```javascript
// extension/background/utils/cache-manager.js

class CacheManager {
  constructor(maxSize = 100, maxAge = 3600000) { // 1 hour default
    this.cache = new Map();
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  set(key, value) {
    // Clean old entries first
    this.cleanup();

    // If at max size, remove oldest
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge
    };
  }
}
```

**Checklist:**
- [ ] Create CacheManager class
- [ ] Replace existing caches
- [ ] Add automatic cleanup
- [ ] Add cache monitoring
- [ ] Test with large datasets

---

## 5. Testing Infrastructure 🟡 HIGH

**Priority:** HIGH  
**Estimated Time:** 6-8 hours  
**Dependencies:** None  
**Impact:** Medium - Ensures code quality and prevents regressions

### Setup Testing

```bash
cd /Users/tanisha/Desktop/TryMe

# Install testing dependencies
npm install --save-dev jest @testing-library/dom @testing-library/jest-dom
```

### Update package.json

```json
{
  "scripts": {
    "build": "node build.js",
    "watch": "node build.js --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "esbuild": "^0.23.0",
    "jest": "^29.0.0",
    "@testing-library/dom": "^9.0.0",
    "@testing-library/jest-dom": "^9.0.0"
  }
}
```

### Create Jest Config

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  collectCoverageFrom: [
    'extension/**/*.js',
    '!extension/**/*.test.js',
    '!extension/lib/**',
    '!extension/content/content.generated.js'
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70
    }
  }
};
```

### Example Tests

```javascript
// extension/services/__tests__/AttributeFilter.test.js

const AttributeFilter = require('../AttributeFilter');

describe('AttributeFilter', () => {
  let filter;

  beforeEach(() => {
    filter = new AttributeFilter();
  });

  describe('determineNeededCategories', () => {
    test('should return correct categories for top', () => {
      const result = filter.determineNeededCategories('top');
      expect(result.needs).toContain('bottom');
      expect(result.needs).toContain('shoes');
    });

    test('should return correct categories for dress', () => {
      const result = filter.determineNeededCategories('dress');
      expect(result.needs).toContain('shoes');
      expect(result.optional).toContain('accessories');
    });
  });

  describe('caching', () => {
    test('should cache filter results', async () => {
      const product = { id: '123', aiAnalysis: { category: 'top' } };
      const items = [/* mock items */];

      // Mock chrome.runtime.sendMessage
      global.chrome = {
        runtime: {
          sendMessage: jest.fn().mockResolvedValue({ shortlist: [0, 1] })
        }
      };

      // First call
      await filter.filterByAttributes(product, items);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      await filter.filterByAttributes(product, items);
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
```

**Checklist:**
- [ ] Install testing dependencies
- [ ] Create Jest config
- [ ] Write tests for utilities
- [ ] Write tests for services
- [ ] Write tests for core modules
- [ ] Set up CI pipeline
- [ ] Add test coverage reporting
- [ ] Document testing practices

---

## 6. Expand Site Support 🟢 MEDIUM

**Priority:** MEDIUM  
**Estimated Time:** 2-3 hours per site  
**Dependencies:** None  
**Impact:** Medium - Increases extension usefulness

### Sites to Add

1. **Amazon Fashion** (High Priority)
2. **ASOS** (High Priority)
3. **Nordstrom**
4. **Macy's**
5. **Target**

### Implementation Template

For each site, create a configuration:

```javascript
// extension/content/config/SiteConfigurations.js

export const SUPPORTED_SITES = {
  // ... existing sites ...
  
  'amazon': {
    name: 'Amazon',
    domain: 'amazon.com',
    selectors: {
      productImages: [
        '.s-image',  // Search results
        '#landingImage',  // Product page
        '.imgTagWrapper img'
      ],
      productCards: [
        '[data-component-type="s-search-result"]',
        '.s-result-item'
      ],
      productLinks: [
        'a.a-link-normal.s-no-outline'
      ]
    },
    exclusions: {
      classes: ['nav-logo', 'nav-sprite', 'buybox'],
      ids: ['navbar', 'site-footer'],
      attributes: ['data-a-thumbnail']
    }
  }
};
```

### Testing Checklist (Per Site)

- [ ] Product listing page detection works
- [ ] Individual product page detection works
- [ ] Product images correctly identified
- [ ] Non-product images excluded
- [ ] Visual indicators display correctly
- [ ] No layout breaking
- [ ] Performance acceptable

---

## 7-10. Additional Improvements

See COMPREHENSIVE_SUMMARY.md for details on:
- Build system improvements
- Documentation
- Feature enhancements
- Code quality improvements

---

## Progress Tracking

### Week 1 (Current Week)
- [x] Complete codebase walkthrough
- [x] Create comprehensive documentation
- [ ] Security audit
- [ ] Add message validation

### Week 2
- [ ] Modularize background worker
- [ ] Implement rate limiting
- [ ] Begin testing infrastructure

### Week 3
- [ ] Performance optimization
- [ ] Expand to 2 more sites
- [ ] Complete testing suite

### Week 4
- [ ] Build system improvements
- [ ] Documentation updates
- [ ] Final polish and review

---

## Success Metrics

### Code Quality
- Background worker: < 300 lines
- Test coverage: > 70%
- Linting errors: 0
- Documentation: All public APIs documented

### Performance
- Wardrobe analysis: 5x faster (batched)
- Page load impact: < 100ms
- Memory usage: < 50MB
- Cache hit rate: > 80%

### Security
- All API keys rotated (if needed)
- Security rules verified
- Input validation: 100% of message types
- No credentials in git history

---

**Document Status:** Ready for Implementation  
**Next Action:** Begin security audit  
**Estimated Total Time:** 25-35 hours for all improvements

