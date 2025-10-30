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

    // ============================================
    // PRIVATE HELPER METHODS FOR generateTryOn
    // ============================================

    /**
     * Get and validate API key from storage
     * @private
     * @returns {Promise<string>} The API key
     * @throws {Error} If API key is not configured
     */
    async _getAPIKey() {
        const result = await chrome.storage.local.get(['geminiAPIKey']);
        if (!result.geminiAPIKey) {
            throw new Error('Gemini API key not configured. Please add your API key in settings.');
        }
        return result.geminiAPIKey;
    }

    /**
     * Validate and prepare images for API
     * @private
     * @param {string} userPhoto - User photo data URL or base64
     * @param {string} clothingImage - Clothing image data URL or base64
     * @returns {Object} Object containing prepared image data and MIME types
     * @throws {Error} If image data is invalid
     */
    _validateAndPrepareImages(userPhoto, clothingImage) {
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

        return {
            userPhotoData,
            clothingImageData,
            userPhotoMimeType,
            clothingImageMimeType
        };
    }

    /**
     * Build the image generation request body
     * @private
     * @param {string} userPhotoData - Clean base64 user photo data
     * @param {string} clothingImageData - Clean base64 clothing image data
     * @param {string} userPhotoMimeType - User photo MIME type
     * @param {string} clothingImageMimeType - Clothing image MIME type
     * @param {Object} options - Generation options (e.g., outfitDescription)
     * @returns {Object} The request body for Gemini API
     */
    _buildImageGenerationRequest(userPhotoData, clothingImageData, userPhotoMimeType, clothingImageMimeType, options) {
        const prompt = this.createImageGenerationPrompt(options);

        return {
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
    }

    /**
     * Make API request to Gemini
     * @private
     * @param {Object} requestBody - The request body
     * @param {string} apiKey - The API key
     * @returns {Promise<Object>} The API response data
     * @throws {Error} If API request fails
     */
    async _makeAPIRequest(requestBody, apiKey) {
        const url = `${GEMINI_IMAGE_GENERATION_ENDPOINT}:generateContent`;

        console.log('📤 Sending request to Gemini API...');
        console.log('🔍 MODEL:', url.split('/').pop().split(':')[0]);
        console.log('🔍 FULL URL:', url);
        console.log('🔍 Request body structure:', {
            contentsLength: requestBody.contents.length,
            partsLength: requestBody.contents[0].parts.length,
            partTypes: requestBody.contents[0].parts.map(p => p.text ? 'text' : 'image'),
            config: requestBody.generationConfig,
            imagesSizes: [
                requestBody.contents[0].parts[0].inline_data.data.length,
                requestBody.contents[0].parts[1].inline_data.data.length
            ]
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
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
        console.log('🔍 Full API Response:', JSON.stringify(data, null, 2));

        return data;
    }

    /**
     * Validate API response structure and check for errors
     * @private
     * @param {Object} data - The API response data
     * @throws {Error} If response is invalid or contains errors
     */
    _validateAPIResponse(data) {
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

        // Check for content parts
        const parts = data.candidates?.[0]?.content?.parts;
        if (!parts || parts.length === 0) {
            console.error('❌ No parts found in response. Full data:', JSON.stringify(data, null, 2));
            throw new Error(`No content parts in Gemini response. Full candidate: ${JSON.stringify(data.candidates?.[0])}`);
        }

        console.log(`🔍 Found ${parts.length} parts in response`);
    }

    /**
     * Extract generated image and text from response parts
     * @private
     * @param {Array} parts - The response parts from Gemini API
     * @returns {Object} Object containing generatedImageBase64 and responseText
     */
    _extractResponseContent(parts) {
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

        return { generatedImageBase64, responseText };
    }

    /**
     * Validate that generated image is different from input images
     * @private
     * @param {string} generatedImageBase64 - The generated image data
     * @param {string} userPhotoData - The original user photo data
     * @param {string} clothingImageData - The original clothing image data
     * @throws {Error} If generated image is identical to inputs
     */
    _validateGeneratedImage(generatedImageBase64, userPhotoData, clothingImageData) {
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

        console.log('✅ Verified: Generated image is different from both input images');
    }

    /**
     * Build the success result object
     * @private
     * @param {string} generatedImageBase64 - The generated image data
     * @param {string} responseText - The optional text response
     * @param {Array} parts - The response parts (for MIME type detection)
     * @returns {Object} The result object
     * @throws {Error} If no content was generated
     */
    _buildSuccessResult(generatedImageBase64, responseText, parts) {
        const result_data = {
            success: true,
            message: 'Try-on image generated successfully'
        };

        if (generatedImageBase64) {
            // Get the actual MIME type from the response (might be PNG, not JPEG)
            const responseMimeType = parts[0].inlineData?.mimeType || parts[0].inline_data?.mime_type || 'image/png';
            console.log('🔍 Generated image MIME type:', responseMimeType);

            // Convert to data URL with correct MIME type
            result_data.imageUrl = `data:${responseMimeType};base64,${generatedImageBase64}`;
            result_data.imageBase64 = generatedImageBase64;
            result_data.mimeType = responseMimeType;
            console.log('🎨 Virtual try-on image generated successfully');
        }

        if (responseText) {
            result_data.description = responseText;
        }

        if (!generatedImageBase64 && !responseText) {
            throw new Error('No image or text response from Gemini API');
        }

        return result_data;
    }

    // ============================================
    // MAIN PUBLIC METHOD
    // ============================================

    /**
     * Generate virtual try-on image/analysis
     *
     * This is the main orchestration method that coordinates the entire try-on generation process.
     * It delegates specific responsibilities to focused helper methods for better maintainability.
     *
     * @param {string} userPhoto - User photo data URL or base64
     * @param {string} clothingImage - Clothing image data URL or base64
     * @param {Object} options - Generation options (e.g., outfitDescription)
     * @returns {Promise<Object>} Result object with success status and generated image
     */
    async generateTryOn(userPhoto, clothingImage, options = {}) {
        try {
            console.log('🎨 Generating virtual try-on image...');

            // Log outfit description if provided
            if (options.outfitDescription) {
                console.log('👗 Using outfit description:', options.outfitDescription.substring(0, 100) + '...');
            }

            // Step 1: Get and validate API key
            const apiKey = await this._getAPIKey();

            // Step 2: Validate and prepare images
            const { userPhotoData, clothingImageData, userPhotoMimeType, clothingImageMimeType } =
                this._validateAndPrepareImages(userPhoto, clothingImage);

            // Step 3: Build API request
            const requestBody = this._buildImageGenerationRequest(
                userPhotoData,
                clothingImageData,
                userPhotoMimeType,
                clothingImageMimeType,
                options
            );

            // Step 4: Make API call
            const data = await this._makeAPIRequest(requestBody, apiKey);

            // Step 5: Validate response structure
            this._validateAPIResponse(data);

            // Step 6: Extract content from response
            const parts = data.candidates[0].content.parts;
            const { generatedImageBase64, responseText } = this._extractResponseContent(parts);

            // Step 7: Validate generated image (if present)
            if (generatedImageBase64) {
                this._validateGeneratedImage(generatedImageBase64, userPhotoData, clothingImageData);
            }

            // Step 8: Build and return success result
            return this._buildSuccessResult(generatedImageBase64, responseText, parts);

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
        const { outfitDescription } = options;

        // Base prompt
        let prompt = `The first image is an image of me. Generate an image of me wearing the clothing item in the second image.`;

        // Add detailed outfit description if available
        if (outfitDescription) {
            prompt += `\n\nThe clothing item is: ${outfitDescription}`;
            prompt += `\n\nPlease accurately recreate all the details mentioned in the description, including colors, patterns, style, cut, and design features.`;
        }

        return prompt;
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
