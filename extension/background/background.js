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
            'tryOnCache': {},
            // Prompt mode fields
            'userPrompt': '',
            'rankingMode': 'style', // 'style' or 'prompt'
            'recentPrompts': [],
            'promptHistory': []
        });
    } else if (details.reason === 'update') {
        // Migration: Add new fields if they don't exist
        const storage = await chrome.storage.local.get(['userPrompt', 'rankingMode', 'recentPrompts', 'promptHistory']);

        const updates = {};
        if (storage.userPrompt === undefined) updates.userPrompt = '';
        if (storage.rankingMode === undefined) updates.rankingMode = 'style';
        if (storage.recentPrompts === undefined) updates.recentPrompts = [];
        if (storage.promptHistory === undefined) updates.promptHistory = [];

        if (Object.keys(updates).length > 0) {
            console.log('[Background] Migrating storage schema with prompt fields:', updates);
            await chrome.storage.local.set(updates);
        }
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

        case 'fetchImageAsBase64':
            // Fetch image with extension permissions and convert to base64
            fetchImageAsBase64(request.imageUrl).then(result => {
                sendResponse(result);
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true; // Keep message channel open for async response

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

        case 'aiStyleProfileWithImages':
            analyzeStyleProfileWithImages(request.photoDataUrls, request.photoCount, request.options)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'filterWardrobeItems':
            filterWardrobeItemsByAttributes(request.product, request.wardrobeItems)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'composeOutfitVisual':
            composeOutfitVisual(request.product, request.shortlistedItems)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
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

// Analyze multiple photos for style profile generation with actual image inputs
async function analyzeStyleProfileWithImages(photoDataUrls, photoCount, options = {}) {
    try {
        console.log(`[Background] Starting style profile analysis with ${photoDataUrls.length} images...`);

        // Convert data URLs to Blobs
        const photoBlobs = [];
        for (let i = 0; i < photoDataUrls.length; i++) {
            try {
                const response = await fetch(photoDataUrls[i]);
                const blob = await response.blob();
                photoBlobs.push(blob);
                console.log(`[Background] Converted photo ${i + 1}: ${blob.size} bytes, ${blob.type}`);
            } catch (error) {
                console.error(`[Background] Failed to convert photo ${i + 1}:`, error);
            }
        }

        if (photoBlobs.length === 0) {
            throw new Error('Failed to process any photos for analysis');
        }

        console.log(`[Background] Successfully converted ${photoBlobs.length} photos to blobs`);

        // Create the style analysis prompt - PERSON-BASED (analyzes features, not current clothing)
        const prompt = `You are an expert fashion stylist and personal style consultant. I have uploaded ${photoBlobs.length} photos of a person. Please analyze the PERSON in these images - their physical features, coloring, and proportions - to create recommendations for what would look most flattering on them.

CRITICAL INSTRUCTIONS:
1. Analyze the PERSON in the photos, NOT their current clothing choices
2. Focus on: skin tone, undertones (warm/cool/neutral), hair color, eye color, body proportions, height indicators, frame, facial features
3. Recommend colors, styles, and silhouettes that would be FLATTERING based on their coloring and body type
4. Base recommendations on color theory (which colors complement their skin tone) and body proportion principles
5. Respond with ONLY a valid JSON object in the exact format specified below. Do not include any markdown formatting, explanations, or text outside the JSON.

Your task: Analyze the person's features and create a profile of what would look BEST on them.

{
  "analysis_summary": "Brief overview of the person's coloring, body type, and key features observed",
  "color_palette": {
    "best_colors": ["colors that complement their skin tone and undertones - be specific about WHY these colors work"],
    "color_reasoning": "Explanation based on their skin tone, undertones (warm/cool/neutral), hair color, and coloring. Reference color theory principles.",
    "avoid_colors": ["colors that may wash them out or clash with their coloring"]
  },
  "style_categories": [
    {
      "name": "Primary recommended style category that would flatter their features",
      "confidence": "high/medium/low",
      "description": "Why this style would work well for their body type and proportions"
    },
    {
      "name": "Secondary style category that would suit them",
      "confidence": "high/medium/low",
      "description": "Additional style that complements their features"
    },
    {
      "name": "Tertiary style option",
      "confidence": "high/medium/low",
      "description": "Third style that could work"
    }
  ],
  "body_type_analysis": {
    "observed_features": ["specific observations about their body proportions, frame, height indicators"],
    "silhouettes": ["silhouettes that would flatter their body type - e.g., A-line, straight, fitted, etc."],
    "fits": ["fit styles that would work best - e.g., tailored, relaxed, structured"],
    "recommendations": "Detailed advice on cuts, proportions, and silhouettes that would be most flattering based on their body type. Explain WHY these work."
  },
  "pattern_preferences": {
    "recommended_patterns": ["patterns that would work with their features and proportions"],
    "pattern_reasoning": "Why these patterns would be flattering (consider scale, visual weight, body proportions)",
    "avoid_patterns": ["patterns that might overwhelm or not suit their frame"]
  },
  "overall_aesthetic": {
    "keywords": ["keywords describing aesthetics that would suit their features and coloring"],
    "description": "Overall aesthetic direction that would enhance their natural features",
    "style_personality": "Style personality recommendations based on their features"
  },
  "shopping_recommendations": {
    "key_pieces": ["specific pieces that would be flattering for their body type and coloring"],
    "brands_to_consider": ["brands that cater to their style needs and body type"],
    "style_tips": ["actionable styling tips based on their specific features - e.g., 'Draw attention to X', 'Balance proportions by Y', 'Highlight your Z'"]
  }
}

REMEMBER: Focus on what would be FLATTERING for this person based on their features, NOT what they're currently wearing. This is about helping them discover what looks best on them.

Respond with ONLY the JSON object, no additional text or formatting.`;

        // Use the multi-image analysis function
        let aiResult;

        if (photoBlobs.length === 1) {
            // Single image - use single image analysis
            aiResult = await executeAIPromptWithImage(prompt, photoBlobs[0], options);
        } else {
            // Multiple images - analyze them together
            aiResult = await executeAIPromptWithMultipleImages(prompt, photoBlobs, options);
        }

        if (!aiResult.success) {
            throw new Error(`AI analysis failed: ${aiResult.error}`);
        }

        console.log(`[Background] Style profile analysis complete`);

        return {
            success: true,
            response: aiResult.response,
            apiUsed: aiResult.apiUsed
        };

    } catch (error) {
        console.error('[Background] Style profile analysis error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

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

    // STEP 2: No analysis found, fetch the image and analyze with AI
    console.log(`[Background] No existing analysis for ${itemId}, fetching image and analyzing...`);
    console.log(`[Background] Image URL: ${imageUrl}`);

    // Fetch the image from the URL
    let imageBlob;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      imageBlob = await response.blob();
      console.log(`[Background] Image fetched successfully, size: ${imageBlob.size} bytes, type: ${imageBlob.type}`);
    } catch (fetchError) {
      console.error(`[Background] Failed to fetch image for ${itemId}:`, fetchError);
      throw new Error(`Could not fetch image: ${fetchError.message}`);
    }

    const prompt = `You are a fashion expert analyzing a clothing item for outfit matching.

Analyze the image provided and determine:

CRITICAL INSTRUCTIONS:
1. Look at the image carefully and determine if it shows an actual clothing/fashion/accessory item
2. If it's NOT a clothing/fashion item (e.g., a pet, animal, food, random object), respond with:
   {
     "is_clothing": false,
     "error": "Not a clothing item",
     "description": "[Provide a detailed 1-2 sentence description of what you actually see in the image - be specific about what the subject is, its appearance, colors, and setting]"
   }
3. If it IS a clothing/fashion item, provide detailed fashion analysis based on what you SEE

For CLOTHING/FASHION ITEMS ONLY, respond with this JSON format:
{
  "is_clothing": true,
  "colors": {
    "primary": "the most dominant/visible color",
    "secondary": "second most visible color (optional)",
    "tertiary": "third most visible color (optional)"
  },
  "style": ["casual", "formal", "sporty", "bohemian", "minimalist", "streetwear", "preppy"],
  "pattern": "solid|striped|floral|plaid|geometric|printed|textured|embroidered",
  "formality": "casual|business casual|semi-formal|formal|athletic",
  "season": ["spring", "summer", "fall", "winter"],
  "versatility_score": 1-10,
  "description": "Detailed 2-3 sentence description of what you see in the image, including specific details about the item, its design, material appearance, and notable features"
}

RULES FOR ACCURATE ANALYSIS:
- Describe EXACTLY what you see in the image - be specific about colors, patterns, style
- Use SPECIFIC color names (e.g., "navy blue", "rust orange", "cream white")
- Identify the exact type of item (e.g., "one-shoulder dress", "hoop earrings", "leather ankle boots")
- **COLOR DETECTION**: Focus on 2-3 most dominant colors only:
  - **primary** (REQUIRED): The most visible/dominant color (e.g., for a white skirt with green flowers and yellow centers: primary is "white")
  - **secondary** (OPTIONAL): Second most visible color if present (e.g., "green" for the flower pattern)
  - **tertiary** (OPTIONAL): Third most visible color if present (e.g., "yellow" for flower centers)
  - DO NOT list every single shade - focus on what would help match this item with other clothing
  - Example: A white dress with small blue polka dots should be {"primary": "white", "secondary": "blue"} NOT a list of 10 different shades
- Versatility score should reflect how many different outfits this item could work with
- Description must be detailed and accurate to what's visible in the image
- If you see jewelry or accessories, analyze them as fashion items
- Category hint from user: "${category || 'unknown'}" (use this only as a hint, trust what you see in the image)

Respond with ONLY valid JSON, no markdown or extra text.`;

    const aiResult = await executeAIPromptWithImage(prompt, imageBlob, {
      temperature: 0,
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
          colors: { primary: 'n/a' },
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
        colors: { primary: 'unknown' },
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

// Outfit Matching Functions

/**
 * Filter wardrobe items by attributes for outfit matching (Stage 1)
 * Uses AI to eliminate incompatible items based on category, color, style
 * @param {Object} product - Product AI analysis attributes
 * @param {Array} wardrobeItems - Wardrobe items with AI analysis and originalIndex
 * @returns {Promise<Object>} Shortlist of compatible item indices and eliminated reasons
 */
async function filterWardrobeItemsByAttributes(product, wardrobeItems) {
  try {
    console.log('[Background] Starting attribute-based filtering...');
    console.log('[Background] Product category:', product.category);
    console.log('[Background] Wardrobe items to filter:', wardrobeItems.length);

    // Build the filtering prompt
    const filterPrompt = `You are a fashion expert performing initial outfit compatibility screening.

PRODUCT BEING CONSIDERED:
- Category: ${product.category || 'unknown'}
- Colors: ${JSON.stringify(product.colors)}
- Style: ${product.style ? product.style.join(', ') : 'unknown'}
- Pattern: ${product.pattern || 'unknown'}
- Formality: ${product.formality || 'casual'}

USER'S WARDROBE ITEMS:
${wardrobeItems.map((item, idx) => `
[${idx}] ${(item.category || 'unknown').toUpperCase()}:
- Colors: ${JSON.stringify(item.colors)}
- Style: ${item.style ? item.style.join(', ') : 'unknown'}
- Pattern: ${item.pattern || 'unknown'}
- Formality: ${item.formality || 'casual'}
- Description: ${item.description || 'No description'}
- Is Clothing: ${item.is_clothing !== false ? 'yes' : 'NO - not a clothing item'}
`).join('\n')}

FILTERING TASK:
Your goal is to create a shortlist of wardrobe items that could work well with this product to create a complete outfit.

FILTERING RULES:
0. **CRITICAL - Non-Clothing Items:**
   - ALWAYS eliminate items with category "N/A", "unknown", or "n/a"
   - ALWAYS eliminate items marked with "Is Clothing: NO"
   - These are NOT clothing items (e.g., pets, food, random objects) and should NEVER be in an outfit

1. **Category Compatibility:**
   - If product is a TOP: Keep BOTTOMS, SHOES, and optionally OUTERWEAR/ACCESSORIES
   - If product is a BOTTOM: Keep TOPS, SHOES, and optionally OUTERWEAR/ACCESSORIES
   - If product is a DRESS: Keep SHOES and optionally OUTERWEAR/ACCESSORIES
   - If product is SHOES: Keep TOPS+BOTTOMS or DRESSES, and optionally OUTERWEAR/ACCESSORIES
   - If product is OUTERWEAR: Keep complete outfits (TOP+BOTTOM+SHOES or DRESS+SHOES)
   - Eliminate items in the same category as the product (don't pair top with top)

2. **Color Compatibility:**
   - IMPORTANT: Use ONLY the colors listed in the JSON data above for each item
   - DO NOT invent or imagine colors - only reference what's explicitly stated
   - Eliminate severe color clashes based on the ACTUAL colors provided (e.g., red with orange, bright yellow with hot pink)
   - Keep complementary colors (e.g., blue with white, black with anything, earth tones together)
   - Keep neutral colors (black, white, gray, beige, navy)
   - Consider color harmony principles
   - If product has "light olive green", DO NOT describe it as "red" or any other color

3. **Style Compatibility:**
   - Eliminate extreme style mismatches (e.g., formal with athletic, bohemian with preppy)
   - Keep items with compatible or complementary styles
   - Mixed styles can work if formality levels align

4. **Pattern Compatibility:**
   - If product has bold patterns, prefer solid or subtle wardrobe items
   - Multiple patterns can work if they share color palette
   - Eliminate competing bold patterns

5. **Formality Alignment:**
   - Eliminate extreme formality mismatches (e.g., formal with athletic)
   - Business casual can mix with casual or semi-formal

RESPOND WITH ONLY valid JSON (no markdown, no extra text):
{
  "shortlist": [0, 2, 5, 7],
  "eliminated": {
    "1": "Same category as product",
    "3": "Color clash - red product with orange item",
    "4": "Style mismatch - formal with athletic"
  },
  "reasoning": "Brief explanation of shortlist strategy"
}

Include the indices of items to KEEP in the "shortlist" array.
Include the indices of items to ELIMINATE with reasons in the "eliminated" object.`;

    // Execute AI prompt
    const aiResult = await executeAIPrompt(filterPrompt, {
      temperature: 0,
      maxRetries: 3
    });

    if (!aiResult.success) {
      throw new Error(`AI filtering failed: ${aiResult.error}`);
    }

    // Parse AI response
    console.log('[Background] AI filtering response received, parsing...');
    let filterResult;

    try {
      const responseText = aiResult.response.trim();

      // Remove markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      filterResult = JSON.parse(cleanedResponse);

      // Validate structure
      if (!filterResult.shortlist || !Array.isArray(filterResult.shortlist)) {
        throw new Error('Invalid response structure: missing shortlist array');
      }

      console.log('[Background] Filtering successful:');
      console.log(`  - Shortlist: ${filterResult.shortlist.length} items`);
      console.log(`  - Eliminated: ${Object.keys(filterResult.eliminated || {}).length} items`);
      console.log(`  - Reasoning: ${filterResult.reasoning}`);

      return filterResult;

    } catch (parseError) {
      console.error('[Background] Failed to parse AI filtering response:', parseError);
      console.error('Raw AI response:', aiResult.response);

      // Fallback: create shortlist by basic category rules
      console.log('[Background] Using fallback category-based filtering...');
      const shortlist = [];
      const eliminated = {};

      const productCategory = (product.category || 'unknown').toLowerCase();

      // Validate product category
      const validCategories = ['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessories'];
      if (!validCategories.includes(productCategory) || productCategory === 'unknown' || productCategory === 'n/a') {
        console.warn('[Background] Product has invalid category:', productCategory);
        return {
          shortlist: [],
          eliminated: {},
          reasoning: 'Product category is invalid or missing - cannot filter wardrobe items'
        };
      }

      wardrobeItems.forEach((item, idx) => {
        const itemCategory = (item.category || 'unknown').toLowerCase();

        // CRITICAL: Eliminate items that are not valid clothing items
        if (!validCategories.includes(itemCategory) || itemCategory === 'unknown' || itemCategory === 'n/a') {
          eliminated[idx] = 'Invalid or missing category - not a clothing item';
          return;
        }

        // Check if item is marked as non-clothing by AI
        if (item.is_clothing === false) {
          eliminated[idx] = 'Not a clothing item';
          return;
        }

        // Basic category compatibility
        if (itemCategory === productCategory) {
          eliminated[idx] = 'Same category as product';
        } else if (productCategory === 'top' && ['bottom', 'shoes', 'outerwear', 'accessories'].includes(itemCategory)) {
          shortlist.push(idx);
        } else if (productCategory === 'bottom' && ['top', 'shoes', 'outerwear', 'accessories'].includes(itemCategory)) {
          shortlist.push(idx);
        } else if (productCategory === 'dress' && ['shoes', 'outerwear', 'accessories'].includes(itemCategory)) {
          shortlist.push(idx);
        } else if (productCategory === 'shoes' && ['top', 'bottom', 'dress', 'outerwear', 'accessories'].includes(itemCategory)) {
          shortlist.push(idx);
        } else {
          eliminated[idx] = 'Category incompatibility';
        }
      });

      return {
        shortlist: shortlist,
        eliminated: eliminated,
        reasoning: 'Fallback category-based filtering applied due to AI parsing error'
      };
    }

  } catch (error) {
    console.error('[Background] Error in filterWardrobeItemsByAttributes:', error);
    throw error;
  }
}

/**
 * Compose complete outfit using visual image analysis (Stage 2)
 * Analyzes actual images to determine best outfit combination
 * @param {Object} product - Product with imageUrl and AI analysis
 * @param {Array} shortlistedItems - Shortlisted wardrobe items with imageUrls
 * @returns {Promise<Object>} Best outfit with visual compatibility scores
 */
async function composeOutfitVisual(product, shortlistedItems) {
  try {
    console.log('[Background] Starting visual outfit composition...');
    console.log('[Background] Product category:', product.category);
    console.log('[Background] Shortlisted items:', shortlistedItems.length);

    // Build the visual analysis prompt
    const visualPrompt = `You are a professional stylist analyzing outfit visual compatibility using actual product information.

PRODUCT BEING STYLED:
- Category: ${product.category || 'unknown'}
- Colors: ${JSON.stringify(product.colors)}
- Style: ${product.style ? product.style.join(', ') : 'unknown'}
- Pattern: ${product.pattern || 'unknown'}
- Formality: ${product.formality || 'casual'}

WARDROBE ITEMS TO PAIR WITH (Already pre-filtered for basic compatibility):
${shortlistedItems.map((item, idx) => `
[${idx}] ${(item.category || 'unknown').toUpperCase()}:
- Colors: ${JSON.stringify(item.colors)}
- Style: ${item.style ? item.style.join(', ') : 'unknown'}
- Pattern: ${item.pattern || 'unknown'}
- Formality: ${item.formality || 'casual'}
- Description: ${item.description || 'No description'}
`).join('\n')}

STYLING TASK:
Create the BEST complete outfit by selecting items from the wardrobe list that pair perfectly with this product.

OUTFIT COMPOSITION CRITERIA:
1. **Completeness**: Outfit must be complete and wearable
   - If product is TOP: Select 1 BOTTOM + 1 SHOES (optionally: OUTERWEAR or ACCESSORIES)
   - If product is BOTTOM: Select 1 TOP + 1 SHOES (optionally: OUTERWEAR or ACCESSORIES)
   - If product is DRESS: Select 1 SHOES (optionally: OUTERWEAR or ACCESSORIES)
   - If product is SHOES: Select 1 TOP + 1 BOTTOM OR 1 DRESS (optionally: OUTERWEAR or ACCESSORIES)

2. **Visual Harmony** (Score 0-100):
   - Color palette cohesion - do colors work together visually?
   - Pattern mixing compatibility - can patterns coexist without clashing?
   - Proportion and silhouette balance - do shapes complement each other?
   - Visual weight distribution - is the outfit balanced?

3. **Style Consistency** (Score 0-100):
   - Do all items share a coherent aesthetic?
   - Is formality level consistent?
   - Would a fashion expert approve this pairing?

4. **Versatility** (Score 0-100):
   - Can this outfit work for multiple occasions?
   - Is it practical and wearable?

RESPOND WITH ONLY valid JSON (no markdown, no extra text):
{
  "best_outfit": {
    "items": [
      {
        "index": 0,
        "category": "bottom",
        "visual_score": 92,
        "reasoning": "Light wash denim complements the product's casual style and earth tone colors"
      },
      {
        "index": 3,
        "category": "shoes",
        "visual_score": 88,
        "reasoning": "White sneakers add a fresh contrast while maintaining casual vibe"
      }
    ],
    "overall_confidence": 90,
    "visual_harmony_score": 92,
    "style_consistency_score": 90,
    "versatility_score": 88,
    "occasion": "weekend brunch, casual office, coffee date",
    "why_it_works": "This outfit balances earth tones with fresh whites, creating a relaxed yet put-together look. The casual styles align perfectly, and the color palette is naturally harmonious.",
    "styling_tips": "Try rolling up the sleeves and adding a simple necklace to elevate the look"
  },
  "has_complete_outfit": true,
  "missing_categories": []
}

IMPORTANT:
- Select indices from the wardrobe items list [0, 1, 2, ...]
- Include ONLY items that are ESSENTIAL for the outfit (don't force accessories if they don't fit)
- Ensure outfit is COMPLETE (has all required categories)
- Be HONEST with scores - don't inflate them
- If you CANNOT create a complete outfit, set "has_complete_outfit": false and list "missing_categories"`;

    // Execute AI prompt
    const aiResult = await executeAIPrompt(visualPrompt, {
      temperature: 0,
      maxRetries: 3
    });

    if (!aiResult.success) {
      throw new Error(`Visual analysis failed: ${aiResult.error}`);
    }

    // Parse AI response
    console.log('[Background] Visual analysis response received, parsing...');
    let visualResult;

    try {
      const responseText = aiResult.response.trim();

      // Remove markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      visualResult = JSON.parse(cleanedResponse);

      // Validate structure
      if (!visualResult.best_outfit && !visualResult.has_complete_outfit) {
        throw new Error('Invalid response structure: missing outfit data');
      }

      console.log('[Background] Visual composition successful:');
      console.log(`  - Outfit confidence: ${visualResult.best_outfit?.overall_confidence || 0}%`);
      console.log(`  - Items in outfit: ${visualResult.best_outfit?.items?.length || 0}`);
      console.log(`  - Complete: ${visualResult.has_complete_outfit !== false}`);

      return visualResult;

    } catch (parseError) {
      console.error('[Background] Failed to parse visual analysis response:', parseError);
      console.error('Raw AI response:', aiResult.response);

      // Fallback: return a no-match result
      console.log('[Background] Using fallback no-match result...');
      return {
        has_complete_outfit: false,
        missing_categories: ['Unable to parse outfit analysis'],
        best_outfit: null,
        error: 'Failed to parse AI outfit composition'
      };
    }

  } catch (error) {
    console.error('[Background] Error in composeOutfitVisual:', error);
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
            const session = await LanguageModel.create({
                outputLanguage: 'en'
            });
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
                    temperature: options.temperature ?? 0,
                    topK: options.topK || 40,
                    outputLanguage: 'en'
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
                    temperature: options.temperature ?? 0,
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

// Execute AI prompt with multiple image inputs using modern Chrome AI Prompt API
async function executeAIPromptWithMultipleImages(prompt, imageBlobs, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`AI prompt with ${imageBlobs.length} images attempt ${attempt}/${maxRetries}`);
            console.log(`Prompt: ${prompt.substring(0, 100)}...`);

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

            // Try modern LanguageModel API with multiple images
            if (typeof LanguageModel !== 'undefined') {
                console.log(`Using LanguageModel API with ${imageBlobs.length} image inputs...`);

                try {
                    // Create session with image input support
                    const sessionOptions = {
                        temperature: options.temperature ?? 0,
                        topK: options.topK || 40,
                        expectedInputs: [{ type: "image" }],
                        outputLanguage: 'en'
                    };

                    const session = await LanguageModel.create(sessionOptions);

                    // Build content array with all images
                    const content = [
                        { type: 'text', value: prompt }
                    ];

                    // Add all images to the content array
                    imageBlobs.forEach((blob, index) => {
                        content.push({ type: 'image', value: blob });
                        console.log(`Added image ${index + 1}: ${blob.size} bytes, ${blob.type}`);
                    });

                    // Append message with all images
                    await session.append([
                        {
                            role: 'user',
                            content: content
                        }
                    ]);

                    // Get the response
                    response = await session.prompt('Analyze all the images provided based on the instructions given.');
                    apiUsed = `LanguageModel (with ${imageBlobs.length} images)`;

                    // Clean up
                    if (session.destroy) {
                        session.destroy();
                    }
                } catch (imageError) {
                    console.warn('LanguageModel multi-image support not available:', imageError);
                    // Fall back to analyzing first image only
                    console.log('Falling back to single image analysis of first photo...');
                    return await executeAIPromptWithImage(prompt, imageBlobs[0], options);
                }
            }
            // Try window.ai API (unlikely to support images)
            else if (typeof window !== 'undefined' && window.ai) {
                console.log('window.ai does not support image inputs, falling back to text-only...');
                return await executeAIPrompt(prompt, options);
            }
            else {
                throw new Error('No compatible AI API found');
            }

            console.log(`AI prompt with ${imageBlobs.length} images successful on attempt ${attempt} using ${apiUsed}`);
            return {
                success: true,
                response: response,
                attempt: attempt,
                apiUsed: apiUsed
            };

        } catch (error) {
            console.error(`AI prompt with multiple images attempt ${attempt} failed:`, error);

            if (attempt === maxRetries) {
                // If all retries failed, try with just the first image
                console.log('All multi-image analysis attempts failed, falling back to first image only...');
                return await executeAIPromptWithImage(prompt, imageBlobs[0], options);
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

// Execute AI prompt with image input using modern Chrome AI Prompt API
async function executeAIPromptWithImage(prompt, imageBlob, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`AI prompt with image attempt ${attempt}/${maxRetries}`);
            console.log(`Prompt: ${prompt.substring(0, 100)}...`);
            // Compute a short content hash for diagnostics to verify distinct images per call
            let imageHash = 'unknown';
            try {
                if (crypto && crypto.subtle && imageBlob && imageBlob.arrayBuffer) {
                    const buf = await imageBlob.arrayBuffer();
                    const digest = await crypto.subtle.digest('SHA-256', buf);
                    const bytes = new Uint8Array(digest);
                    let hex = '';
                    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
                    imageHash = hex.slice(0, 16);
                }
            } catch (e) {
                console.warn('Failed to hash image in background diagnostics:', e.message);
            }
            console.log(`Image: ${imageBlob.size} bytes, type: ${imageBlob.type}, hash: ${imageHash}`);

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

            // Try modern LanguageModel API with image support
            if (typeof LanguageModel !== 'undefined') {
                console.log('Using LanguageModel API with image input...');

                try {
                    // Create session with image input support
                    const sessionOptions = {
                        temperature: options.temperature ?? 0,
                        topK: options.topK || 40,
                        expectedInputs: [{ type: "image" }],
                        outputLanguage: 'en'
                    };

                    const session = await LanguageModel.create(sessionOptions);

                    // Append message with image
                    await session.append([
                        {
                            role: 'user',
                            content: [
                                { type: 'text', value: prompt },
                                { type: 'image', value: imageBlob }
                            ]
                        }
                    ]);

                    // Post-append confirmation log to prove the image was attached
                    console.log('✅ Background: image appended to session', {
                        confirmed: true,
                        hash: imageHash,
                        size: imageBlob.size,
                        type: imageBlob.type
                    });

                    // Get the response
                    response = await session.prompt('Analyze this image based on the instructions provided.');
                    apiUsed = 'LanguageModel (with image)';

                    // Clean up
                    if (session.destroy) {
                        session.destroy();
                    }
                } catch (imageError) {
                    console.warn('LanguageModel image support not available:', imageError);
                    // Fall back to text-only analysis
                    console.log('Falling back to text-only analysis...');
                    return await executeAIPrompt(prompt, options);
                }
            }
            // Try window.ai API (unlikely to support images, but try)
            else if (typeof window !== 'undefined' && window.ai) {
                console.log('window.ai does not support image inputs, falling back to text-only...');
                return await executeAIPrompt(prompt, options);
            }
            else {
                throw new Error('No compatible AI API found');
            }

            console.log(`AI prompt with image successful on attempt ${attempt} using ${apiUsed}`);
            return {
                success: true,
                response: response,
                attempt: attempt,
                apiUsed: apiUsed
            };

        } catch (error) {
            console.error(`AI prompt with image attempt ${attempt} failed:`, error);

            if (attempt === maxRetries) {
                // If all retries failed, fall back to text-only analysis
                console.log('All image analysis attempts failed, falling back to text-only analysis...');
                return await executeAIPrompt(prompt, options);
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

// Fetch image and convert to base64 (bypasses CORS with extension permissions)
async function fetchImageAsBase64(imageUrl) {
    try {
        console.log(`[Background] Fetching image for content script: ${imageUrl}`);

        // Fetch the image using extension permissions
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        // Convert to blob
        const blob = await response.blob();
        console.log(`[Background] Image fetched: ${blob.size} bytes, ${blob.type}`);

        // Convert blob to base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onloadend = () => {
                console.log('[Background] Image converted to base64');
                resolve({
                    success: true,
                    dataUrl: reader.result
                });
            };

            reader.onerror = (error) => {
                console.error('[Background] Failed to convert blob to base64:', error);
                reject(new Error('Failed to convert image to base64'));
            };

            reader.readAsDataURL(blob);
        });

    } catch (error) {
        console.error('[Background] Error fetching image:', error);
        throw error;
    }
}

// Gemini API functions have been moved to gemini/GeminiAPIManager.js
// and are accessed via the geminiManager instance
