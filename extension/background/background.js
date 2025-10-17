// Background service worker for AI Style-Based Shopping Filter + Virtual Try-On
console.log('AI Style Filter background service worker started');

// Import Firebase SDK (compat version for service workers)
importScripts('/lib/firebase/firebase-app-compat.js');
importScripts('/lib/firebase/firebase-auth-compat.js');
importScripts('/lib/firebase/firebase-firestore-compat.js');

// Import Firebase config
importScripts('/config/firebase-config.js');

// Import Firebase managers
importScripts('/services/FirebaseAuthManager.js');
importScripts('/services/FirestoreWardrobeManager.js');

// Initialize Firebase
let app;
let auth;
let db;
let authManager;
let wardrobeManager;

try {
  console.log('🔥 Initializing Firebase...');
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();

  // Enable offline persistence
  db.enablePersistence({ synchronizeTabs: true })
    .then(() => {
      console.log('✅ Firestore offline persistence enabled');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('⚠️ Multiple tabs open, persistence only enabled in first tab');
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Browser does not support persistence');
      } else {
        console.error('❌ Persistence error:', err);
      }
    });

  // Initialize auth manager
  authManager = new FirebaseAuthManager(auth);

  // Initialize wardrobe manager (callback will be set after analyzeWardrobeItem is defined)
  wardrobeManager = new FirestoreWardrobeManager(db, null);

  console.log('✅ Firebase initialized successfully');
  console.log('📍 Project:', firebaseConfig.projectId);
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

// Set the analysis callback after analyzeWardrobeItem function is defined
if (wardrobeManager) {
  // We'll set this right before the analyzeWardrobeItem function definition
  // using a wrapper that ensures the function exists
  wardrobeManager.analyzeItemCallback = (itemId, imageUrl, category) => {
    return analyzeWardrobeItem(itemId, imageUrl, category);
  };
}

// Setup/cleanup Firestore listeners on auth state change
auth.onAuthStateChanged(async (user) => {
  if (user && wardrobeManager) {
    console.log('👤 User authenticated, setting up Firestore listeners');
    wardrobeManager.setupListeners(user.uid);

    // Trigger wardrobe analysis on login
    console.log('[Background] User logged in, starting wardrobe analysis...');
    await analyzeAllWardrobeItems(user.uid);
  } else if (wardrobeManager) {
    console.log('👤 User logged out, cleaning up Firestore listeners');
    wardrobeManager.cleanupListeners();
  }
});

// Import Gemini API Manager (for Virtual Try-On features)
importScripts('/gemini/GeminiAPIManager.js');
const geminiManager = new GeminiAPIManager();

// Handle extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('AI Style Filter extension installed/updated', details.reason);

    if (details.reason === 'install') {
        // First time installation
        chrome.storage.local.set({
            'firstInstall': true,
            'styleProfile': null,
            'userPhotos': [],
            'tryOnCache': {}
        });
    }

    // Trigger wardrobe analysis on installation/update if user is logged in
    if (authManager) {
        const user = authManager.getCurrentUser();
        if (user) {
            console.log('[Background] Extension installed/updated, checking wardrobe...');
            await analyzeAllWardrobeItems(user.uid);
        }
    }
});

// Handle extension startup (when Chrome starts with extension already installed)
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Background] Extension started, checking for logged-in user...');

    // Wait a bit for auth to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (authManager) {
        const user = authManager.getCurrentUser();
        if (user) {
            console.log('[Background] User is logged in, checking wardrobe...');
            await analyzeAllWardrobeItems(user.uid);
        } else {
            console.log('[Background] No user logged in on startup');
        }
    }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'openDashboard':
            openStyleDashboard();
            break;
            
        case 'checkAIAvailability':
            checkChromeAIAvailability().then(result => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        case 'testAI':
            testBasicAIPrompt(request.prompt || 'Hello, how are you?').then(result => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        case 'aiPrompt':
            executeAIPrompt(request.prompt, request.options).then(result => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        case 'contentScriptActive':
            handleContentScriptActive(request.data, sender);
            sendResponse({status: 'acknowledged'});
            break;

        case 'generateTryOn':
            geminiManager.generateTryOn(request.userPhoto, request.clothingImage, request.options).then(result => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response

        case 'checkGeminiAPI':
            geminiManager.checkSetup().then(result => {
                sendResponse(result);
            });
            return true;

        case 'setGeminiAPIKey':
            geminiManager.setAPIKey(request.apiKey).then(result => {
                sendResponse(result);
            });
            return true;

        // Firebase Authentication handlers
        case 'firebaseLogin':
            if (authManager) {
                authManager.loginWithEmail(request.email, request.password)
                    .then(result => sendResponse(result));
            } else {
                sendResponse({ success: false, error: 'Firebase not initialized' });
            }
            return true;

        case 'firebaseSignUp':
            if (authManager) {
                authManager.signUpWithEmail(request.email, request.password, request.displayName)
                    .then(result => sendResponse(result));
            } else {
                sendResponse({ success: false, error: 'Firebase not initialized' });
            }
            return true;

        case 'firebaseLogout':
            if (authManager) {
                authManager.logout()
                    .then(result => sendResponse(result));
            } else {
                sendResponse({ success: false, error: 'Firebase not initialized' });
            }
            return true;

        case 'getAuthStatus':
            if (authManager) {
                const user = authManager.getCurrentUser();
                sendResponse({
                    authenticated: authManager.isAuthenticated(),
                    user: user ? {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName
                    } : null
                });
            } else {
                sendResponse({ authenticated: false, user: null });
            }
            break;

        case 'testFirebaseConnection':
            // Test Firebase connectivity
            sendResponse({
                success: true,
                firebaseInitialized: !!app,
                authInitialized: !!auth,
                dbInitialized: !!db,
                authManagerInitialized: !!authManager,
                wardrobeManagerInitialized: !!wardrobeManager,
                projectId: firebaseConfig.projectId
            });
            break;

        // Firestore Wardrobe handlers
        case 'getWardrobeItems':
            if (wardrobeManager && authManager) {
                const user = authManager.getCurrentUser();
                if (user) {
                    wardrobeManager.getItems(user.uid, request.filters || {})
                        .then(items => sendResponse({ success: true, items }));
                } else {
                    sendResponse({ success: false, error: 'Not authenticated' });
                }
            } else {
                sendResponse({ success: false, error: 'Wardrobe manager not initialized' });
            }
            return true;

        case 'getLooks':
            if (wardrobeManager && authManager) {
                const currentUser = authManager.getCurrentUser();
                if (currentUser) {
                    wardrobeManager.getLooks(currentUser.uid)
                        .then(looks => sendResponse({ success: true, looks }));
                } else {
                    sendResponse({ success: false, error: 'Not authenticated' });
                }
            } else {
                sendResponse({ success: false, error: 'Wardrobe manager not initialized' });
            }
            return true;

        case 'getCachedWardrobe':
            if (wardrobeManager) {
                sendResponse({
                    success: true,
                    data: wardrobeManager.getCachedData()
                });
            } else {
                sendResponse({ success: false, data: { items: [], looks: [] } });
            }
            break;

        case 'getWardrobeStats':
            if (wardrobeManager) {
                sendResponse({
                    success: true,
                    stats: wardrobeManager.getStats()
                });
            } else {
                sendResponse({ success: false, stats: { itemCount: 0, lookCount: 0, hasData: false } });
            }
            break;

        case 'analyzeWardrobeItem':
            analyzeWardrobeItem(request.itemId, request.imageUrl, request.category)
                .then(result => sendResponse({ success: true, analysis: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep message channel open for async response

        case 'clearAllAIAnalysis':
            if (authManager && db) {
                const user = authManager.getCurrentUser();
                if (user) {
                    clearAllAIAnalysis(user.uid)
                        .then(result => sendResponse(result))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                } else {
                    sendResponse({ success: false, error: 'Not authenticated' });
                }
            } else {
                sendResponse({ success: false, error: 'Firebase not initialized' });
            }
            return true;

        case 'reanalyzeAllItems':
            if (authManager && db) {
                const user = authManager.getCurrentUser();
                if (user) {
                    analyzeAllWardrobeItems(user.uid)
                        .then(() => {
                            // Get item count
                            db.collection('wardrobeItems')
                                .where('userId', '==', user.uid)
                                .get()
                                .then(snapshot => {
                                    sendResponse({ success: true, itemCount: snapshot.size });
                                });
                        })
                        .catch(error => sendResponse({ success: false, error: error.message }));
                } else {
                    sendResponse({ success: false, error: 'Not authenticated' });
                }
            } else {
                sendResponse({ success: false, error: 'Firebase not initialized' });
            }
            return true;

        default:
            console.log('Unknown action:', request.action);
    }
});

// Open the style dashboard in a new tab
function openStyleDashboard() {
    chrome.tabs.create({
        url: chrome.runtime.getURL('tab/tab.html')
    });
}

// Handle content script active notifications
function handleContentScriptActive(data, sender) {
    console.log('Content script active on:', data);
    
    // Store active content script info
    const tabId = sender.tab?.id;
    if (tabId) {
        // Update badge with site info
        chrome.action.setBadgeText({
            tabId: tabId,
            text: '✓'
        });
        chrome.action.setBadgeBackgroundColor({
            tabId: tabId,
            color: '#10b981'
        });
        
        // Log detailed info
        console.log(`📊 Content script stats:`, {
            site: data.site,
            pageType: data.pageType,
            url: data.url,
            tabId: tabId,
            timestamp: new Date(data.timestamp).toLocaleTimeString()
        });
    }
}

// Check if Chrome AI is available
async function checkChromeAIAvailability() {
    try {
        if (typeof chrome !== 'undefined' && chrome.ai) {
            const canCreateSession = await chrome.ai.canCreateTextSession();
            return {
                available: true,
                status: canCreateSession,
                message: getAIStatusMessage(canCreateSession)
            };
        } else {
            return {
                available: false,
                status: 'not-supported',
                message: 'Chrome AI not supported in this browser version'
            };
        }
    } catch (error) {
        console.error('Error checking AI availability:', error);
        return {
            available: false,
            status: 'error',
            message: 'Error checking AI availability'
        };
    }
}

function getAIStatusMessage(status) {
    switch (status) {
        case 'readily':
            return 'Chrome AI is ready to use! ✅';
        case 'after-download':
            return 'Chrome AI is downloading models... This may take several minutes on first use. Please wait and try again.';
        case 'no':
            return 'Chrome AI is not available. Please check Chrome AI setup instructions.';
        default:
            return 'Unknown AI status. Please check Chrome AI setup.';
    }
}

function getAISetupInstructions() {
    return {
        title: "Chrome AI Setup Instructions",
        steps: [
            {
                step: 1,
                action: "Update Chrome",
                description: "Ensure you have Chrome 128 or later",
                url: "chrome://settings/help"
            },
            {
                step: 2,
                action: "Enable AI API Flag",
                description: "Go to chrome://flags/#prompt-api-for-gemini-nano and set to 'Enabled'",
                url: "chrome://flags/#prompt-api-for-gemini-nano"
            },
            {
                step: 3,
                action: "Enable Model Download Flag",
                description: "Go to chrome://flags/#optimization-guide-on-device-model and set to 'Enabled BypassPerfRequirement'",
                url: "chrome://flags/#optimization-guide-on-device-model"
            },
            {
                step: 4,
                action: "Restart Chrome",
                description: "Close Chrome completely and restart it (required after flag changes)"
            },
            {
                step: 5,
                action: "Reload Extension",
                description: "Go to chrome://extensions/, find this extension, and click the reload button"
            },
            {
                step: 6,
                action: "Test AI",
                description: "Return to the Style Dashboard and click 'Test Chrome AI'"
            }
        ],
        troubleshooting: [
            "If AI status shows 'Downloading...', wait 5-10 minutes for models to download",
            "If problems persist, try disabling and re-enabling the Chrome flags",
            "Some Chrome installations may require signing up for Early Preview Programs",
            "Ensure you have a stable internet connection for model downloads"
        ]
    };
}

// Handle tab updates to inject content script on supported sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const supportedSites = ['zara.com', 'hm.com', 'nike.com'];
        const isSupported = supportedSites.some(site => tab.url.includes(site));
        
        if (isSupported) {
            console.log('Supported e-commerce site detected:', tab.url);
            // Content script will be automatically injected due to manifest configuration
            
            // Set badge to show extension is active
            chrome.action.setBadgeText({
                tabId: tabId,
                text: '👕'
            });
            chrome.action.setBadgeBackgroundColor({
                tabId: tabId,
                color: '#667eea'
            });
        } else {
            // Clear badge for non-supported sites
            chrome.action.setBadgeText({
                tabId: tabId,
                text: ''
            });
        }
    }
});

// Wardrobe Analysis Functions

// Clear all AI analysis data from Firestore
async function clearAllAIAnalysis(userId) {
  try {
    if (!db || !userId) {
      throw new Error('Missing required parameters: db or userId');
    }

    console.log('[Background] Clearing all AI analysis for user:', userId);

    // Get all wardrobe items
    const wardrobeSnapshot = await db.collection('wardrobeItems')
      .where('userId', '==', userId)
      .get();

    console.log(`[Background] Found ${wardrobeSnapshot.size} items to clear`);

    // Batch update to remove aiAnalysis field
    const batch = db.batch();
    let updateCount = 0;

    wardrobeSnapshot.forEach(doc => {
      const docRef = db.collection('wardrobeItems').doc(doc.id);
      batch.update(docRef, {
        aiAnalysis: firebase.firestore.FieldValue.delete(),
        aiAnalyzedAt: firebase.firestore.FieldValue.delete()
      });
      updateCount++;
    });

    // Commit the batch
    await batch.commit();

    console.log(`[Background] Successfully cleared AI analysis for ${updateCount} items`);

    return {
      success: true,
      clearedCount: updateCount,
      message: `Cleared analysis for ${updateCount} items`
    };

  } catch (error) {
    console.error('[Background] Error clearing AI analysis:', error);
    throw error;
  }
}

// Analyze all wardrobe items that don't have AI analysis
async function analyzeAllWardrobeItems(userId) {
  try {
    if (!db || !userId) {
      console.error('[Background] Cannot analyze wardrobe: missing db or userId');
      return;
    }

    console.log('[Background] Fetching wardrobe items for analysis...');

    // Get all wardrobe items from Firestore
    const wardrobeSnapshot = await db.collection('wardrobeItems')
      .where('userId', '==', userId)
      .get();

    const itemsNeedingAnalysis = [];
    wardrobeSnapshot.forEach(doc => {
      const item = doc.data();
      if (!item.aiAnalysis) {
        itemsNeedingAnalysis.push({
          id: doc.id,
          ...item
        });
      }
    });

    console.log(`[Background] Found ${itemsNeedingAnalysis.length} items needing analysis out of ${wardrobeSnapshot.size} total items`);

    if (itemsNeedingAnalysis.length === 0) {
      console.log('[Background] All wardrobe items already analyzed');
      return;
    }

    // Analyze items one by one (rate limiting built in)
    for (const item of itemsNeedingAnalysis) {
      console.log(`[Background] Analyzing item ${item.id}...`);
      await analyzeWardrobeItem(item.id, item.imageUrl, item.category);
    }

    console.log('[Background] All wardrobe items analyzed successfully');
  } catch (error) {
    console.error('[Background] Error analyzing all wardrobe items:', error);
  }
}

// Analyze a single wardrobe item and store results in Firestore
async function analyzeWardrobeItem(itemId, imageUrl, category) {
  try {
    if (!db || !itemId) {
      throw new Error('Missing required parameters: db or itemId');
    }

    // STEP 1: Check if analysis already exists in Firestore
    console.log(`[Background] Checking if item ${itemId} already has analysis...`);
    const itemDoc = await db.collection('wardrobeItems').doc(itemId).get();

    if (!itemDoc.exists) {
      throw new Error(`Item ${itemId} not found in Firestore`);
    }

    const existingData = itemDoc.data();

    if (existingData?.aiAnalysis) {
      console.log(`[Background] Item ${itemId} already has analysis, skipping`);
      return existingData.aiAnalysis;
    }

    // STEP 2: No analysis found, make AI call
    console.log(`[Background] No existing analysis for ${itemId}, analyzing now...`);

    // NOTE: Chrome AI cannot fetch or view images from URLs. The analysis is based on
    // the category field provided by the user. This is a limitation we need to address
    // by either: 1) Using a vision API like Gemini, or 2) Having users provide descriptions

    const prompt = `You are a fashion expert analyzing a clothing item for outfit matching.

CATEGORY PROVIDED BY USER: ${category || 'Unknown'}

CRITICAL INSTRUCTIONS:
1. FIRST, determine if the category represents an actual clothing/fashion item
2. If it's NOT a clothing item (e.g., "cat", "pet", "animal", "food", "object"), respond with:
   {
     "is_clothing": false,
     "error": "Not a clothing item",
     "description": "This item is not a clothing or fashion item"
   }
3. If it IS a clothing item, provide detailed fashion analysis

For CLOTHING ITEMS ONLY, respond with this JSON format:
{
  "is_clothing": true,
  "colors": ["specific color name", "specific color name"],
  "style": ["casual", "formal", "sporty", "bohemian", "minimalist", "streetwear", "preppy"],
  "pattern": "solid|striped|floral|plaid|geometric|printed|textured|embroidered",
  "formality": "casual|business casual|semi-formal|formal|athletic",
  "season": ["spring", "summer", "fall", "winter"],
  "versatility_score": 7,
  "description": "Accurate 1-2 sentence description based ONLY on the category ${category}"
}

RULES FOR ACCURATE ANALYSIS:
- Use SPECIFIC color names based on the category (e.g., "white dress" → ["white"], "blue jeans" → ["blue", "denim"])
- Extract colors directly from the category name when mentioned
- Be realistic about the item type (shoes are shoes, not "casual bohemian minimalist")
- Versatility score should reflect how many outfits this item can be part of
- Description MUST match the category - don't make up details not in the category
- If category is vague (like "undefined"), use generic neutral analysis

EXAMPLES:
Category: "White T-Shirt"
{
  "is_clothing": true,
  "colors": ["white"],
  "style": ["casual", "minimalist"],
  "pattern": "solid",
  "formality": "casual",
  "season": ["spring", "summer", "fall", "winter"],
  "versatility_score": 10,
  "description": "A white t-shirt that pairs easily with any bottom"
}

Category: "Black Leather Jacket"
{
  "is_clothing": true,
  "colors": ["black"],
  "style": ["casual", "streetwear"],
  "pattern": "solid",
  "formality": "casual",
  "season": ["fall", "winter", "spring"],
  "versatility_score": 8,
  "description": "A black leather jacket suitable for layering in cooler weather"
}

Category: "Cat" or "undefined" (if image shows a cat)
{
  "is_clothing": false,
  "error": "Not a clothing item",
  "description": "This appears to be a pet/animal, not a clothing item"
}

Now analyze: "${category || 'undefined'}"

Respond with ONLY valid JSON, no markdown or extra text.`;

    const aiResult = await executeAIPrompt(prompt, {
      temperature: 0.7,
      maxRetries: 3
    });

    if (!aiResult.success) {
      throw new Error(`AI analysis failed: ${aiResult.error}`);
    }

    // STEP 3: Parse the AI response
    console.log(`[Background] AI response received for ${itemId}, parsing...`);
    let analysis;

    try {
      // Try to parse the response as JSON
      const responseText = aiResult.response.trim();

      // Remove markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedResponse);

      // Check if this is actually a clothing item
      if (parsed.is_clothing === false) {
        console.warn(`[Background] Item ${itemId} is NOT a clothing item: ${parsed.description}`);
        analysis = {
          is_clothing: false,
          error: parsed.error || 'Not a clothing item',
          colors: ['n/a'],
          style: ['n/a'],
          pattern: 'n/a',
          formality: 'n/a',
          season: [],
          versatility_score: 0,
          description: parsed.description || 'This is not a clothing or fashion item'
        };
      } else {
        // Validate required fields for clothing items
        if (!parsed.colors || !parsed.style || !parsed.pattern) {
          throw new Error('Missing required fields in AI response');
        }

        analysis = {
          is_clothing: true,
          ...parsed
        };
      }

      console.log(`[Background] Successfully parsed analysis for ${itemId}:`, analysis);
    } catch (parseError) {
      console.error(`[Background] Failed to parse AI response for ${itemId}:`, parseError);
      console.error('Raw AI response:', aiResult.response);

      // Provide fallback analysis
      analysis = {
        is_clothing: true,
        colors: ['unknown'],
        style: ['casual'],
        pattern: 'unknown',
        formality: 'casual',
        season: ['spring', 'summer', 'fall', 'winter'],
        versatility_score: 5,
        description: `${category || 'Clothing item'} - analysis failed, using defaults`
      };
    }

    // STEP 4: Store analysis in Firestore for permanent reuse
    console.log(`[Background] Storing analysis for ${itemId} in Firestore...`);
    await db.collection('wardrobeItems').doc(itemId).update({
      aiAnalysis: analysis,
      aiAnalyzedAt: new Date().toISOString()
    });

    console.log(`[Background] Analysis saved successfully for item ${itemId}`);
    return analysis;

  } catch (error) {
    console.error(`[Background] Error analyzing wardrobe item ${itemId}:`, error);
    throw error;
  }
}

// AI Utility Functions

// Test basic AI functionality with a simple prompt using modern API
async function testBasicAIPrompt(prompt) {
    try {
        console.log('Testing AI with prompt:', prompt);
        
        // Check if AI is available first
        const availability = await checkChromeAIAvailability();
        if (!availability.available || availability.status !== 'readily') {
            return {
                success: false,
                error: 'AI not available',
                message: availability.message
            };
        }
        
        let response;
        
        // Try modern LanguageModel API first
        if (typeof LanguageModel !== 'undefined') {
            console.log('Using LanguageModel API for test...');
            const session = await LanguageModel.create();
            response = await session.prompt(prompt);
            console.log('LanguageModel response:', response);
            
            return {
                success: true,
                response: response,
                message: 'AI test successful (LanguageModel API)',
                apiUsed: 'LanguageModel'
            };
        }
        
        // Try window.ai API
        if (typeof window !== 'undefined' && window.ai) {
            console.log('Using window.ai API for test...');
            const session = await window.ai.createTextSession();
            response = await session.prompt(prompt);
            console.log('window.ai response:', response);
            
            // Clean up session
            if (session.destroy) {
                session.destroy();
            }
            
            return {
                success: true,
                response: response,
                message: 'AI test successful (window.ai API)',
                apiUsed: 'window.ai'
            };
        }
        
        throw new Error('No compatible AI API found');
        
    } catch (error) {
        console.error('AI test failed:', error);
        return {
            success: false,
            error: error.message,
            message: 'AI test failed: ' + error.message
        };
    }
}

// Execute AI prompt with retry logic and error handling using modern API
async function executeAIPrompt(prompt, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`AI prompt attempt ${attempt}/${maxRetries}:`, prompt.substring(0, 100) + '...');
            
            // Check AI availability
            const availability = await checkChromeAIAvailability();
            if (!availability.available) {
                throw new Error(availability.message);
            }
            
            if (availability.status !== 'readily') {
                throw new Error('AI not ready: ' + availability.message);
            }
            
            let response;
            let apiUsed;
            
            // Try modern LanguageModel API first
            if (typeof LanguageModel !== 'undefined') {
                console.log('Using LanguageModel API for prompt...');
                const sessionOptions = {
                    temperature: options.temperature || 0.7,
                    topK: options.topK || 40
                };
                
                const session = await LanguageModel.create(sessionOptions);
                response = await session.prompt(prompt);
                apiUsed = 'LanguageModel';
                
                // Clean up if available
                if (session.destroy) {
                    session.destroy();
                }
            }
            // Try window.ai API
            else if (typeof window !== 'undefined' && window.ai) {
                console.log('Using window.ai API for prompt...');
                const sessionOptions = {
                    temperature: options.temperature || 0.7,
                    topK: options.topK || 40
                };
                
                const session = await window.ai.createTextSession(sessionOptions);
                response = await session.prompt(prompt);
                apiUsed = 'window.ai';
                
                // Clean up
                if (session.destroy) {
                    session.destroy();
                }
            }
            else {
                throw new Error('No compatible AI API found');
            }
            
            console.log(`AI prompt successful on attempt ${attempt} using ${apiUsed}`);
            return {
                success: true,
                response: response,
                attempt: attempt,
                apiUsed: apiUsed
            };
            
        } catch (error) {
            console.error(`AI prompt attempt ${attempt} failed:`, error);
            
            if (attempt === maxRetries) {
                return {
                    success: false,
                    error: error.message,
                    attempts: maxRetries
                };
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

// Enhanced AI availability check with modern Chrome AI API
async function checkChromeAIAvailability() {
    try {
        const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown';
        const chromeVersionNum = parseInt(chromeVersion);
        
        console.log(`🔍 Checking Chrome AI availability - Chrome version: ${chromeVersion}`);
        console.log('🔍 Extension context:', chrome.runtime.getManifest().name);
        console.log('🔍 window.ai exists:', typeof window !== 'undefined' && !!window.ai);
        console.log('🔍 self.ai exists:', typeof self !== 'undefined' && !!self.ai);
        console.log('🔍 LanguageModel exists:', typeof LanguageModel !== 'undefined');
        
        // Try modern Chrome AI API first (LanguageModel)
        if (typeof LanguageModel !== 'undefined') {
            console.log('✅ Found LanguageModel API, checking availability...');
            const availability = await LanguageModel.availability();
            console.log('📊 LanguageModel availability:', availability);
            
            const diagnostics = {
                chromeVersion: chromeVersion,
                chromeVersionNum: chromeVersionNum,
                apiType: 'LanguageModel',
                availability: availability,
                extensionContext: 'service_worker'
            };
            
            if (availability === 'available') {
                return {
                    available: true,
                    status: 'readily',
                    message: 'Chrome AI is ready to use! ✅',
                    diagnostics: diagnostics
                };
            } else if (availability === 'after-download') {
                return {
                    available: false,
                    status: 'after-download',
                    message: 'Chrome AI is downloading models... This may take several minutes on first use. Please wait and try again.',
                    setupInstructions: getAISetupInstructions(),
                    diagnostics: diagnostics
                };
            } else {
                return {
                    available: false,
                    status: 'no',
                    message: 'Chrome AI is not available. Please check Chrome AI setup instructions.',
                    setupInstructions: getAISetupInstructions(),
                    diagnostics: diagnostics
                };
            }
        }
        
        // Fallback to window.ai if available
        if (typeof window !== 'undefined' && window.ai) {
            console.log('✅ Found window.ai API, checking capabilities...');
            const diagnostics = {
                chromeVersion: chromeVersion,
                chromeVersionNum: chromeVersionNum,
                apiType: 'window.ai',
                extensionContext: 'service_worker'
            };
            
            return {
                available: true,
                status: 'readily',
                message: 'Chrome AI is ready to use! ✅',
                diagnostics: diagnostics
            };
        }
        
        // No modern AI API found
        const message = chromeVersionNum < 128 
            ? `Chrome ${chromeVersion} detected. Chrome AI requires Chrome 128+. Please update Chrome.`
            : 'Chrome AI API not found. Please enable Chrome AI flags:\n1. Go to chrome://flags/#prompt-api-for-gemini-nano\n2. Set to "Enabled"\n3. Go to chrome://flags/#optimization-guide-on-device-model\n4. Set to "Enabled BypassPerfRequirement"\n5. Restart Chrome twice';
            
        return {
            available: false,
            status: 'not-supported',
            message: message,
            setupInstructions: getAISetupInstructions(),
            diagnostics: {
                chromeVersion: chromeVersion,
                chromeVersionNum: chromeVersionNum,
                apiType: 'none',
                extensionContext: 'service_worker'
            }
        };

    } catch (error) {
        console.error('Error checking AI availability:', error);
        return {
            available: false,
            status: 'error',
            message: 'Error checking AI availability: ' + error.message,
            setupInstructions: getAISetupInstructions(),
            diagnostics: {
                error: error.message,
                chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown',
                extensionContext: 'service_worker'
            }
        };
    }
}


// Gemini API functions have been moved to gemini/GeminiAPIManager.js
// and are accessed via the geminiManager instance
