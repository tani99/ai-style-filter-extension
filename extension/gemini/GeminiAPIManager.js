// Gemini API Manager
// Handles all Gemini API integration for Virtual Try-On features
// Separated from Chrome AI Prompt API functionality

// Gemini API Configuration
// Following official documentation: https://ai.google.dev/gemini-api/docs/quickstart
// Using v1beta as per docs, with x-goog-api-key header authentication
const GEMINI_API_TEST_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash';
const GEMINI_IMAGE_GENERATION_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview';

// Note: Gemini 2.5 Flash Image Preview supports both text AND image generation
// This model can generate actual virtual try-on images, not just text analysis

class GeminiAPIManager {
    constructor() {
        this.apiKey = null;
    }

    // Check if Gemini API is set up
    async checkSetup() {
        try {
            const result = await chrome.storage.local.get(['geminiAPIKey']);

            if (!result.geminiAPIKey) {
                return {
                    configured: false,
                    message: 'Gemini API key not configured',
                    instructions: this.getSetupInstructions()
                };
            }

            // Test API key by making a simple request
            const testResult = await this.testAPI(result.geminiAPIKey);

            return {
                configured: true,
                valid: testResult.success,
                message: testResult.success ? 'Gemini API is ready!' : 'API key is invalid',
                error: testResult.error
            };

        } catch (error) {
            console.error('Error checking Gemini API setup:', error);
            return {
                configured: false,
                message: 'Error checking API setup: ' + error.message,
                error: error.message
            };
        }
    }

    // Set Gemini API key
    async setAPIKey(apiKey) {
        try {
            if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
                return {
                    success: false,
                    error: 'Invalid API key format'
                };
            }

            // Test the API key before saving
            const testResult = await this.testAPI(apiKey);

            if (!testResult.success) {
                return {
                    success: false,
                    error: 'API key is invalid: ' + (testResult.error || 'Authentication failed')
                };
            }

            // Save the API key
            await chrome.storage.local.set({ geminiAPIKey: apiKey.trim() });
            this.apiKey = apiKey.trim();

            console.log('✅ Gemini API key saved and validated');

            return {
                success: true,
                message: 'Gemini API key saved successfully!'
            };

        } catch (error) {
            console.error('Error setting Gemini API key:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Test Gemini API with a simple request
    async testAPI(apiKey) {
        try {
            // Following official docs: use v1beta and x-goog-api-key header
            const url = `${GEMINI_API_TEST_ENDPOINT}:generateContent`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: 'Hello! Please respond with a single word: OK'
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();

            return {
                success: true,
                message: 'API key is valid'
            };

        } catch (error) {
            console.error('Gemini API test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Generate virtual try-on image/analysis
    async generateTryOn(userPhoto, clothingImage, options = {}) {
        try {
            console.log('🎨 Generating virtual try-on image...');

            // Get API key
            const result = await chrome.storage.local.get(['geminiAPIKey']);
            if (!result.geminiAPIKey) {
                throw new Error('Gemini API key not configured. Please add your API key in settings.');
            }

            // Check cache first
            const cacheKey = this.generateCacheKey(userPhoto, clothingImage);
            const cachedResult = await this.getCachedTryOn(cacheKey);

            if (cachedResult) {
                console.log('✅ Returning cached try-on image');
                return {
                    success: true,
                    imageUrl: cachedResult,
                    cached: true,
                    message: 'Try-on image retrieved from cache'
                };
            }

            // Prepare images for API (ensure base64 format)
            const userPhotoBase64 = this.cleanBase64Image(userPhoto);
            const clothingImageBase64 = this.cleanBase64Image(clothingImage);

            // Create prompt for virtual try-on IMAGE GENERATION
            const prompt = this.createImageGenerationPrompt(options);

            // Call Gemini 2.5 Flash Image Generation API
            // Following official docs: use v1beta and x-goog-api-key header
            const url = `${GEMINI_IMAGE_GENERATION_ENDPOINT}:generateContent`;

            const requestBody = {
                contents: [{
                    parts: [
                        {
                            text: prompt
                        },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: userPhotoBase64
                            }
                        },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: clothingImageBase64
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: options.temperature || 0.4,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192
                }
            };

            console.log('📤 Sending request to Gemini API...');
            console.log('🔍 URL:', url);
            console.log('🔍 Request body structure:', {
                contentsLength: requestBody.contents.length,
                partsLength: requestBody.contents[0].parts.length,
                partTypes: requestBody.contents[0].parts.map(p => p.text ? 'text' : 'image'),
                config: requestBody.generationConfig
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': result.geminiAPIKey
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('📥 Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
            }

            const data = await response.json();
            console.log('📥 Received response from Gemini API');
            
            // DEBUG: Log the full response structure
            console.log('🔍 Full API Response:', JSON.stringify(data, null, 2));
            console.log('🔍 Candidates:', data.candidates);
            console.log('🔍 First Candidate:', data.candidates?.[0]);
            console.log('🔍 Content:', data.candidates?.[0]?.content);
            console.log('🔍 Parts:', data.candidates?.[0]?.content?.parts);

            // Extract response parts - could contain both text and images
            const parts = data.candidates?.[0]?.content?.parts;

            if (!parts || parts.length === 0) {
                console.error('❌ No parts found in response. Full data:', data);
                throw new Error('No response from Gemini API');
            }

            console.log(`🔍 Found ${parts.length} parts in response`);

            // Extract generated image if present
            let generatedImageBase64 = null;
            let responseText = null;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                console.log(`🔍 Part ${i}:`, Object.keys(part));
                
                if (part.inline_data && part.inline_data.data) {
                    // Found generated image
                    generatedImageBase64 = part.inline_data.data;
                    console.log(`✅ Generated image received from Gemini (Part ${i})`);
                    console.log(`🔍 Image size: ${generatedImageBase64.length} characters`);
                } else if (part.inlineData && part.inlineData.data) {
                    // Try camelCase version
                    generatedImageBase64 = part.inlineData.data;
                    console.log(`✅ Generated image received from Gemini - camelCase (Part ${i})`);
                    console.log(`🔍 Image size: ${generatedImageBase64.length} characters`);
                } else if (part.text) {
                    // Found text response
                    responseText = part.text;
                    console.log(`📝 Text response received (Part ${i}): ${responseText.substring(0, 100)}...`);
                } else {
                    console.log(`⚠️ Unknown part type (Part ${i}):`, part);
                }
            }

            // Prepare result
            const result_data = {
                success: true,
                cached: false,
                message: 'Try-on image generated successfully'
            };

            if (generatedImageBase64) {
                // Convert to data URL for easy display
                result_data.imageUrl = `data:image/jpeg;base64,${generatedImageBase64}`;
                result_data.imageBase64 = generatedImageBase64;
                console.log('🎨 Virtual try-on image generated successfully');
            }

            if (responseText) {
                result_data.description = responseText;
            }

            if (!generatedImageBase64 && !responseText) {
                throw new Error('No image or text response from Gemini API');
            }

            // Cache the result
            await this.cacheTryOnResult(cacheKey, result_data);

            return result_data;

        } catch (error) {
            console.error('❌ Virtual try-on generation failed:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to generate try-on: ' + error.message
            };
        }
    }

    // Create prompt for image generation virtual try-on
    createImageGenerationPrompt(options = {}) {
        return `Generate a realistic virtual try-on image showing the person from the first image wearing the clothing item from the second image.

Requirements:
- Create a photorealistic image of the person wearing the clothing item
- Maintain the person's facial features, body proportions, and skin tone exactly as shown
- Accurately place the clothing item on the person with proper fit and draping
- Ensure the clothing color, pattern, and style match the product image exactly
- Keep natural lighting and a clean background
- Make it look like a professional fashion photograph

The output should be a single high-quality image showing the person wearing the clothing item.`;
    }

    // Create prompt for virtual try-on analysis (text-based)
    createTryOnAnalysisPrompt(options = {}) {
        return `You are an expert fashion consultant and virtual try-on assistant.

I have two images:
1. A photo of a person (user photo)
2. A clothing item (product image)

Please analyze these images and provide:

1. **Compatibility Analysis**: How well would this clothing item look on this person based on:
   - Body type and proportions
   - Skin tone and coloring
   - Overall style match
   - Fit prediction

2. **Styling Suggestions**: How to best wear this item:
   - What to pair it with
   - Occasion suitability
   - Styling tips

3. **Virtual Try-On Description**: Describe how this item would look when worn by this person:
   - How it would fit
   - How the colors would complement the person
   - Overall aesthetic impression

4. **Recommendation Score**: Rate the match from 1-10 with explanation.

Please provide a detailed but concise analysis in JSON format:
{
  "compatibility_score": 0-10,
  "fit_analysis": "description",
  "color_match": "description",
  "style_match": "description",
  "styling_suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "overall_recommendation": "recommendation text"
}`;
    }

    // Helper function to clean base64 image data
    cleanBase64Image(imageData) {
        if (!imageData) {
            throw new Error('Invalid image data');
        }

        // If it's already clean base64, return it
        if (!imageData.includes('data:')) {
            return imageData;
        }

        // Remove data URL prefix if present
        const base64Prefix = imageData.indexOf('base64,');
        if (base64Prefix !== -1) {
            return imageData.substring(base64Prefix + 7);
        }

        return imageData;
    }

    // Generate cache key for try-on images
    generateCacheKey(userPhoto, clothingImage) {
        // Create a simple hash from the images
        const userHash = userPhoto.substring(0, 50);
        const clothingHash = clothingImage.substring(0, 50);
        return `tryon_${userHash}_${clothingHash}`;
    }

    // Get cached try-on result
    async getCachedTryOn(cacheKey) {
        try {
            const result = await chrome.storage.local.get(['tryOnCache']);
            const cache = result.tryOnCache || {};

            if (cache[cacheKey]) {
                const cached = cache[cacheKey];

                // Check if cache is expired (24 hours)
                const now = Date.now();
                const cacheAge = now - cached.timestamp;
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours

                if (cacheAge < maxAge) {
                    console.log(`📦 Cache hit for key: ${cacheKey.substring(0, 20)}...`);
                    return cached.data;
                } else {
                    console.log(`⏰ Cache expired for key: ${cacheKey.substring(0, 20)}...`);
                    // Remove expired cache entry
                    delete cache[cacheKey];
                    await chrome.storage.local.set({ tryOnCache: cache });
                }
            }

            return null;

        } catch (error) {
            console.error('Error getting cached try-on:', error);
            return null;
        }
    }

    // Cache try-on result
    async cacheTryOnResult(cacheKey, data) {
        try {
            const result = await chrome.storage.local.get(['tryOnCache']);
            const cache = result.tryOnCache || {};

            // Limit cache size (keep max 20 entries)
            const cacheKeys = Object.keys(cache);
            if (cacheKeys.length >= 20) {
                // Remove oldest entry
                const oldestKey = cacheKeys.reduce((oldest, key) => {
                    return cache[key].timestamp < cache[oldest].timestamp ? key : oldest;
                }, cacheKeys[0]);
                delete cache[oldestKey];
                console.log(`🗑️ Removed oldest cache entry: ${oldestKey.substring(0, 20)}...`);
            }

            cache[cacheKey] = {
                data: data,
                timestamp: Date.now()
            };

            await chrome.storage.local.set({ tryOnCache: cache });
            console.log(`💾 Cached try-on result: ${cacheKey.substring(0, 20)}...`);

        } catch (error) {
            console.error('Error caching try-on result:', error);
        }
    }

    // Get setup instructions for Gemini API
    getSetupInstructions() {
        return {
            title: 'Gemini API Setup',
            steps: [
                {
                    step: 1,
                    action: 'Get API Key',
                    description: 'Visit Google AI Studio to get your free Gemini API key',
                    url: 'https://aistudio.google.com/app/apikey'
                },
                {
                    step: 2,
                    action: 'Copy API Key',
                    description: 'Create a new API key and copy it to your clipboard'
                },
                {
                    step: 3,
                    action: 'Add to Extension',
                    description: 'Paste the API key in the extension settings below'
                },
                {
                    step: 4,
                    action: 'Test Connection',
                    description: 'Click "Test Gemini API" to verify the setup'
                }
            ],
            notes: [
                'The API key is stored locally in your browser only',
                'Gemini API has a free tier with generous limits',
                'Virtual try-on uses Gemini 2.5 Flash Image Preview for actual image generation',
                'This model can generate photorealistic try-on images, not just text analysis'
            ]
        };
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeminiAPIManager;
}
