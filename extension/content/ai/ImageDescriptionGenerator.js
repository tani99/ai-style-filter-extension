/**
 * Generate a concise, human-friendly description of an image using
 * Chrome's built-in Prompt API (Gemini Nano).
 *
 * Reference: https://developer.chrome.com/docs/ai/prompt-api
 *
 * @param {HTMLImageElement} imgElement
 * @returns {Promise<string|null>} Description text or null on failure/unavailability
 */
export async function generateImageDescription(imgElement) {
    try {
        if (!imgElement) {
            return null;
        }

        console.log('🤖 PromptAPI: starting image description generation');

        // Ensure the image is ready for drawing
        if (!imgElement.complete || imgElement.naturalWidth === 0) {
            try {
                if (typeof imgElement.decode === 'function') {
                    await imgElement.decode();
                }
            } catch (_) {
                // Fallback: small delay if decode() is not supported or fails
                await new Promise(r => setTimeout(r, 50));
            }
        }

        // Check model availability
        const sessionOptions = {
            expectedInputs: [{ type: 'image' }],
            outputLanguage: 'en'
        };
        const availability = await LanguageModel.availability(sessionOptions);
        console.log('🤖 PromptAPI: availability =', availability);
        if (availability === 'unavailable') {
            console.warn('🤖 PromptAPI: model unavailable');
            return null;
        }

        // Create a session
        const session = await LanguageModel.create(sessionOptions);
        console.log('🤖 PromptAPI: session created');

        // Prefer background fetch to avoid CORS-tainted canvas
        let blob = null;
        const imageUrl = (imgElement.currentSrc || imgElement.src || '').trim();
        if (imageUrl && imageUrl.startsWith('http')) {
            try {
                console.log('🤖 PromptAPI: requesting image via background', imageUrl);
                const result = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'fetchImageAsBase64', imageUrl }, resolve);
                });
                if (result && result.success && typeof result.dataUrl === 'string') {
                    const resp = await fetch(result.dataUrl);
                    blob = await resp.blob();
                    console.log('🤖 PromptAPI: received blob from background', blob.type, blob.size);
                }
            } catch (bgErr) {
                console.warn('🤖 PromptAPI: background fetch failed, will try canvas fallback', bgErr);
            }
        }

        // Fallback: use canvas only if background fetch not available
        if (!blob) {
            blob = await new Promise(resolve => {
                const canvas = document.createElement('canvas');
                canvas.width = imgElement.naturalWidth || imgElement.width || 0;
                canvas.height = imgElement.naturalHeight || imgElement.height || 0;

                const ctx = canvas.getContext('2d');
                if (canvas.width > 0 && canvas.height > 0 && ctx) {
                    try {
                        ctx.drawImage(imgElement, 0, 0);
                        canvas.toBlob(resolve, 'image/png');
                    } catch (e) {
                        console.warn('🤖 PromptAPI: canvas draw/toBlob failed (likely CORS)', e);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        }

        if (!blob) {
            try { session.destroy(); } catch (_) {}
            console.warn('🤖 PromptAPI: failed to capture image blob');
            return null;
        }

        // Provide the image as context, then prompt for a short description
        await session.append([
            {
                role: 'user',
                content: [
                    { type: 'text', value: 'You are an assistant that describes product photos for shoppers.' },
                    { type: 'image', value: blob }
                ]
            }
        ]);
        console.log('🤖 PromptAPI: context appended');

        const description = await session.prompt(
            'Describe the image in one short sentence, focusing on the visible clothing or product details.'
        );
        console.log('🤖 PromptAPI: prompt completed');

        try { session.destroy(); } catch (_) {}
        console.log('🤖 PromptAPI: session destroyed');
        return typeof description === 'string' ? description.trim() : null;
    } catch (error) {
        console.error('🤖 PromptAPI: error while generating description', error);
        return null;
    }
}


