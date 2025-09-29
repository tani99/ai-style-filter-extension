// Background service worker for AI Style-Based Shopping Filter + Virtual Try-On
console.log('AI Style Filter background service worker started');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('AI Style Filter extension installed/updated', details.reason);
    
    if (details.reason === 'install') {
        // First time installation
        chrome.storage.local.set({
            'firstInstall': true,
            'styleProfile': null,
            'userPhotos': []
        });
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