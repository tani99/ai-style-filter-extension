// Gemini API Manager
// Handles all Gemini API integration for Virtual Try-On features
// Separated from Chrome AI Prompt API functionality

// Gemini API Configuration
// Following official documentation: https://ai.google.dev/gemini-api/docs/image-generation
// Using v1beta as per docs, with x-goog-api-key header authentication
const GEMINI_API_TEST_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash';

// Available image generation models:
// - gemini-2.5-flash-image: Production model for image generation (CORRECT ONE)
// - gemini-2.0-flash-exp: Does NOT support image generation, only multimodal understanding
// - imagen-4.0-flash-preview-0827: Imagen 4 Fast for high-quality image generation
const GEMINI_IMAGE_GENERATION_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image';

// Note: Using gemini-2.5-flash-image as confirmed by Google AI Studio
// This is the ONLY Gemini model that generates images

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

            // ALWAYS generate fresh images - no caching
            console.log('🔄 Generating fresh try-on image (caching disabled)');

            // NOTE: Caching is intentionally disabled to ensure fresh generation every time
            // This guarantees unique results for each request

            // Prepare images for API (ensure base64 format)
            const userPhotoData = this.cleanBase64Image(userPhoto);
            const clothingImageData = this.cleanBase64Image(clothingImage);

            // Validate that we have actual data
            if (!userPhotoData || userPhotoData.length === 0) {
                throw new Error('User photo data is empty or invalid');
            }
            if (!clothingImageData || clothingImageData.length === 0) {
                throw new Error('Clothing image data is empty or invalid');
            }

            // Detect MIME types from data URLs or default to jpeg
            const userPhotoMimeType = this.detectMimeType(userPhoto);
            const clothingImageMimeType = this.detectMimeType(clothingImage);

            console.log('🖼️ User photo MIME type:', userPhotoMimeType);
            console.log('🖼️ Clothing image MIME type:', clothingImageMimeType);
            console.log('🖼️ User photo data length:', userPhotoData.length);
            console.log('🖼️ Clothing image data length:', clothingImageData.length);

            // Create prompt for virtual try-on IMAGE GENERATION
            const prompt = this.createImageGenerationPrompt(options);

            // Call Gemini 2.5 Flash Image Generation API
            // Following official docs: use v1beta and x-goog-api-key header
            const url = `${GEMINI_IMAGE_GENERATION_ENDPOINT}:generateContent`;

            const requestBody = {
                contents: [{
                    parts: [
                        {
                            inline_data: {
                                mime_type: userPhotoMimeType,
                                data: userPhotoData
                            }
                        },
                        {
                            inline_data: {
                                mime_type: clothingImageMimeType,
                                data: clothingImageData
                            }
                        },
                        {
                            text: prompt
                        }
                    ]
                }],
                generationConfig: {
                    responseModalities: ["Image"],  // CRITICAL: Request image output!
                    imageConfig: {
                        aspectRatio: "3:4"  // Portrait aspect ratio for fashion photos
                    },
                    temperature: 1.0,
                    topK: 40,
                    topP: 0.95
                }
            };

            console.log('📤 Sending request to Gemini API...');
            console.log('🔍 MODEL:', url.split('/').pop().split(':')[0]);
            console.log('🔍 FULL URL:', url);
            console.log('🔍 Prompt:', prompt);
            console.log('🔍 Request body structure:', {
                contentsLength: requestBody.contents.length,
                partsLength: requestBody.contents[0].parts.length,
                partTypes: requestBody.contents[0].parts.map(p => p.text ? 'text' : 'image'),
                config: requestBody.generationConfig,
                imagesSizes: [userPhotoData.length, clothingImageData.length]
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

            // Check for safety/content filters or blocks
            if (data.promptFeedback) {
                console.log('⚠️ Prompt Feedback:', data.promptFeedback);
                if (data.promptFeedback.blockReason) {
                    throw new Error(`Content blocked by Gemini: ${data.promptFeedback.blockReason}. Safety ratings: ${JSON.stringify(data.promptFeedback.safetyRatings)}`);
                }
            }

            // Check for candidates
            if (!data.candidates || data.candidates.length === 0) {
                console.error('❌ No candidates in response. Full data:', JSON.stringify(data, null, 2));
                throw new Error(`No candidates returned from Gemini API. This might mean: content was blocked, or the model couldn't generate an image. Full response: ${JSON.stringify(data)}`);
            }

            console.log('🔍 Candidates:', data.candidates);
            console.log('🔍 First Candidate:', data.candidates?.[0]);

            // Check finish reason
            const finishReason = data.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
                console.warn('⚠️ Unusual finish reason:', finishReason);
                if (finishReason === 'SAFETY') {
                    throw new Error(`Content generation stopped due to safety filters. Finish reason: ${finishReason}. Safety ratings: ${JSON.stringify(data.candidates[0].safetyRatings)}`);
                } else if (finishReason === 'RECITATION') {
                    throw new Error('Content generation stopped due to recitation concerns.');
                } else {
                    console.warn(`Generation finished with reason: ${finishReason}`);
                }
            }

            console.log('🔍 Content:', data.candidates?.[0]?.content);
            console.log('🔍 Parts:', data.candidates?.[0]?.content?.parts);

            // Extract response parts - could contain both text and images
            const parts = data.candidates?.[0]?.content?.parts;

            if (!parts || parts.length === 0) {
                console.error('❌ No parts found in response. Full data:', JSON.stringify(data, null, 2));
                throw new Error(`No content parts in Gemini response. Full candidate: ${JSON.stringify(data.candidates?.[0])}`);
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
                // Verify this is NOT the same as input images
                const isSameAsUserPhoto = generatedImageBase64 === userPhotoData;
                const isSameAsClothing = generatedImageBase64 === clothingImageData;

                if (isSameAsUserPhoto) {
                    console.error('❌ Generated image is identical to user photo!');
                    throw new Error('Gemini API returned the input user photo instead of generating a new image. This is not a valid try-on result.');
                }

                if (isSameAsClothing) {
                    console.error('❌ Generated image is identical to clothing image!');
                    throw new Error('Gemini API returned the input clothing image instead of generating a new image. This is not a valid try-on result.');
                }

                // Get the actual MIME type from the response (might be PNG, not JPEG)
                const responseMimeType = parts[0].inlineData?.mimeType || parts[0].inline_data?.mime_type || 'image/png';
                console.log('🔍 Generated image MIME type:', responseMimeType);

                // Convert to data URL with correct MIME type
                result_data.imageUrl = `data:${responseMimeType};base64,${generatedImageBase64}`;
                result_data.imageBase64 = generatedImageBase64;
                result_data.mimeType = responseMimeType;
                console.log('🎨 Virtual try-on image generated successfully');
                console.log('✅ Verified: Generated image is different from both input images');
            }

            if (responseText) {
                result_data.description = responseText;
            }

            if (!generatedImageBase64 && !responseText) {
                throw new Error('No image or text response from Gemini API');
            }

            // NOTE: Caching disabled - always generate fresh images
            // await this.cacheTryOnResult(cacheKey, result_data);

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
    // Following Gemini API docs: "Describe the scene, don't just list keywords"
    createImageGenerationPrompt(options = {}) {
        return `The first image is an image of me. Generate an image of me wearing the clothing item in the second image.`;
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

    // Helper function to detect MIME type from data URL
    detectMimeType(imageData) {
        if (!imageData) {
            return 'image/jpeg'; // default
        }

        // Check if it's a data URL with MIME type
        if (imageData.startsWith('data:')) {
            const mimeMatch = imageData.match(/^data:([^;,]+)/);
            if (mimeMatch && mimeMatch[1]) {
                return mimeMatch[1];
            }
        }

        // Default to JPEG if we can't detect
        return 'image/jpeg';
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
