// Gemini API UI Module
// Handles all UI interactions for Virtual Try-On features
// Separated from Chrome AI Prompt API UI

// ========================================
// Gemini API Virtual Try-On UI Functions
// ========================================

// Check Gemini API status
async function checkGeminiAPIStatus() {
    const statusElement = document.getElementById('geminiStatus');
    const apiKeySetup = document.getElementById('apiKeySetup');
    const tryonTestSection = document.getElementById('tryonTestSection');
    const tryonPhotoSection = document.getElementById('tryonPhotoSection');

    if (!statusElement) return;

    statusElement.textContent = 'Checking...';
    statusElement.className = 'status-indicator loading';

    try {
        const response = await chrome.runtime.sendMessage({ action: 'checkGeminiAPI' });

        console.log('Gemini API check:', response);

        if (response.configured && response.valid) {
            statusElement.textContent = 'Ready';
            statusElement.className = 'status-indicator ready';
            if (apiKeySetup) apiKeySetup.style.display = 'none';
            if (tryonPhotoSection) tryonPhotoSection.style.display = 'block';
            if (tryonTestSection) tryonTestSection.style.display = 'block';

            // Load saved try-on photo if exists
            loadTryonPhoto();
        } else if (response.configured && !response.valid) {
            statusElement.textContent = 'Invalid Key';
            statusElement.className = 'status-indicator error';
            if (apiKeySetup) apiKeySetup.style.display = 'block';
            if (tryonPhotoSection) tryonPhotoSection.style.display = 'none';
            if (tryonTestSection) tryonTestSection.style.display = 'none';
            showNotification('Gemini API key is invalid. Please update it.', 'error');
        } else {
            statusElement.textContent = 'Not Configured';
            statusElement.className = 'status-indicator error';
            if (apiKeySetup) apiKeySetup.style.display = 'block';
            if (tryonPhotoSection) tryonPhotoSection.style.display = 'none';
            if (tryonTestSection) tryonTestSection.style.display = 'none';
        }

    } catch (error) {
        console.error('Failed to check Gemini API status:', error);
        statusElement.textContent = 'Error';
        statusElement.className = 'status-indicator error';
    }
}

// Save Gemini API key
async function saveGeminiAPIKey() {
    const apiKeyInput = document.getElementById('geminiAPIKeyInput');
    const saveBtn = document.getElementById('saveAPIKeyBtn');

    if (!apiKeyInput || !saveBtn) return;

    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showNotification('Please enter an API key', 'error');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'setGeminiAPIKey',
            apiKey: apiKey
        });

        if (response.success) {
            showNotification('Gemini API key saved successfully!', 'success');
            apiKeyInput.value = '';
            checkGeminiAPIStatus();
        } else {
            showNotification('Failed to save API key: ' + response.error, 'error');
        }

    } catch (error) {
        console.error('Error saving API key:', error);
        showNotification('Error saving API key: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save API Key';
    }
}

// Update user photo select dropdown
async function updateUserPhotoSelect() {
    const userPhotoSelect = document.getElementById('userPhotoSelect');
    if (!userPhotoSelect) return;

    const photos = await getStoredPhotos();

    // Clear existing options except the first one
    userPhotoSelect.innerHTML = '<option value="">Select a photo...</option>';

    // Add photo options
    photos.forEach((photo, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `Photo ${index + 1} - ${photo.name}`;
        userPhotoSelect.appendChild(option);
    });
}

// Update try-on button state
function updateTryOnButton() {
    const testTryOnBtn = document.getElementById('testTryOnBtn');
    const userPhotoSelect = document.getElementById('userPhotoSelect');
    const clothingImageInput = document.getElementById('clothingImageInput');

    if (!testTryOnBtn || !userPhotoSelect || !clothingImageInput) return;

    const hasUserPhoto = userPhotoSelect.value !== '';
    const hasClothingImage = clothingImageInput.files.length > 0;

    testTryOnBtn.disabled = !(hasUserPhoto && hasClothingImage);
}

// Test virtual try-on
async function testVirtualTryOn() {
    const testTryOnBtn = document.getElementById('testTryOnBtn');
    const userPhotoSelect = document.getElementById('userPhotoSelect');
    const clothingImageInput = document.getElementById('clothingImageInput');
    const tryonResult = document.getElementById('tryonResult');

    if (!testTryOnBtn || !userPhotoSelect || !clothingImageInput || !tryonResult) return;

    const photoIndex = parseInt(userPhotoSelect.value);
    const clothingFile = clothingImageInput.files[0];

    if (isNaN(photoIndex) || !clothingFile) {
        showNotification('Please select both a user photo and clothing image', 'error');
        return;
    }

    testTryOnBtn.disabled = true;
    testTryOnBtn.textContent = 'Generating...';

    try {
        // Get user photo
        const photos = await getStoredPhotos();
        const userPhoto = photos[photoIndex];

        if (!userPhoto) {
            throw new Error('Selected photo not found');
        }

        // Read clothing image
        const clothingImageData = await readFileAsDataURL(clothingFile);

        // Try to extract outfit description from detected products on the page
        // This checks if the uploaded image matches any detected product
        let outfitDescription = null;
        try {
            // Query all detected clothing items on the current page
            const detectedImages = document.querySelectorAll('[data-clothing-item-detected="true"][data-ai-outfit-description]');

            // Try to match the uploaded image with detected products by comparing image data
            // (This is a simple approach; a more sophisticated matching could be implemented)
            for (const detectedImg of detectedImages) {
                if (detectedImg.dataset.aiOutfitDescription) {
                    // For now, use the first detected product's description as a fallback
                    // A better approach would be to let the user select which detected product to try on
                    outfitDescription = detectedImg.dataset.aiOutfitDescription;
                    console.log('📝 Found outfit description from detected product:', outfitDescription.substring(0, 100) + '...');
                    break;
                }
            }
        } catch (error) {
            console.log('Could not find outfit description from detected products:', error);
        }

        // Show the 3-column layout immediately with loading animation in the 3rd spot
        tryonResult.style.display = 'block';
        tryonResult.innerHTML = `
            <div class="tryon-success">
                <h4>✨ Virtual Try-On Result</h4>
                ${outfitDescription ? `<p class="outfit-description-hint">💡 Using AI-generated outfit description for better quality</p>` : ''}
                <div class="tryon-images-three">
                    <div class="image-container">
                        <h5>Your Photo</h5>
                        <img src="${userPhoto.data}" alt="User photo" class="tryon-image">
                    </div>
                    <div class="image-container">
                        <h5>Clothing Item</h5>
                        <img src="${clothingImageData}" alt="Clothing item" class="tryon-image">
                    </div>
                    <div class="image-container highlight loading-container">
                        <h5>Virtual Try-On Result</h5>
                        <div class="tryon-loading">
                            <div class="loading-spinner-inline"></div>
                            <p class="loading-text">Generating...</p>
                            <p class="loading-subtext">This may take 10-30 seconds</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        console.log('Sending try-on request...');

        // Call background script to generate try-on
        const response = await chrome.runtime.sendMessage({
            action: 'generateTryOn',
            userPhoto: userPhoto.data,
            clothingImage: clothingImageData,
            options: {
                temperature: 0,
                outfitDescription: outfitDescription  // Include outfit description if available
            }
        });

        console.log('Try-on response:', response);

        if (response.success) {
            // Update the result with the generated image
            displayTryOnResult(response, userPhoto.data, clothingImageData);
            showNotification('Try-on image generated successfully!', 'success');
        } else {
            throw new Error(response.error || 'Try-on generation failed');
        }

    } catch (error) {
        console.error('Virtual try-on error:', error);
        console.error('Full error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        tryonResult.innerHTML = `
            <div class="error-result-detailed">
                <h4>❌ Image Generation Failed</h4>
                <div class="error-box">
                    <p><strong>Error Message:</strong></p>
                    <pre class="error-message">${error.message}</pre>
                </div>
                <div class="error-help">
                    <p><strong>What this might mean:</strong></p>
                    <ul>
                        <li>The Gemini API may have blocked the content due to safety filters</li>
                        <li>The images may not be suitable for virtual try-on generation</li>
                        <li>The API key may have quota/rate limit issues</li>
                        <li>There may be a network or API error</li>
                    </ul>
                    <p><strong>Check the browser console</strong> (F12) for detailed API response logs.</p>
                </div>
                <button class="retry-btn" onclick="testVirtualTryOn()">Try Again</button>
            </div>
        `;
        showNotification('Image generation failed - check console for details', 'error');
    } finally {
        testTryOnBtn.disabled = false;
        testTryOnBtn.textContent = 'Generate Try-On Image';
    }
}

// Display try-on result
function displayTryOnResult(response, userPhotoData, clothingImageData) {
    const tryonResult = document.getElementById('tryonResult');
    if (!tryonResult) return;

    let resultHTML = `
        <div class="tryon-success">
            <h4>✨ Virtual Try-On Result</h4>
    `;

    // Check if we have a generated image
    if (response.imageUrl || response.imageBase64) {
        const imageUrl = response.imageUrl || `data:image/jpeg;base64,${response.imageBase64}`;

        resultHTML += `
            <div class="tryon-images-three">
                <div class="image-container">
                    <h5>Your Photo</h5>
                    <img src="${userPhotoData}" alt="User photo" class="tryon-image">
                </div>
                <div class="image-container">
                    <h5>Clothing Item</h5>
                    <img src="${clothingImageData}" alt="Clothing item" class="tryon-image">
                </div>
                <div class="image-container highlight">
                    <h5>Virtual Try-On Result</h5>
                    <img src="${imageUrl}" alt="Virtual try-on result" class="tryon-image generated-image">
                </div>
            </div>
            <div class="result-actions">
                <button id="regenerateTryOnBtn" class="regenerate-btn">🔄 Regenerate (Try Again)</button>
                <p class="regenerate-note">Each generation produces unique results. Click to try again if you're not satisfied.</p>
            </div>
        `;
    } else {
        // No generated image, display both input images only
        resultHTML += `
            <div class="tryon-images">
                <div class="image-container">
                    <h5>Your Photo</h5>
                    <img src="${userPhotoData}" alt="User photo" class="tryon-image">
                </div>
                <div class="image-container">
                    <h5>Clothing Item</h5>
                    <img src="${clothingImageData}" alt="Clothing item" class="tryon-image">
                </div>
            </div>
        `;
    }

    // Parse the description if it's JSON (for analysis data)
    let analysisData;
    if (response.description) {
        try {
            const descriptionText = response.description;
            const jsonMatch = descriptionText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisData = JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.log('Could not parse JSON from response, using raw text');
        }

        if (analysisData) {
            // Display structured analysis
            resultHTML += `
                <div class="analysis-details">
                    <div class="score-section">
                        <strong>Compatibility Score:</strong>
                        <span class="score-badge ${analysisData.compatibility_score >= 7 ? 'high' : analysisData.compatibility_score >= 4 ? 'medium' : 'low'}">
                            ${analysisData.compatibility_score}/10
                        </span>
                    </div>

                    <div class="analysis-item">
                        <strong>Fit Analysis:</strong>
                        <p>${analysisData.fit_analysis}</p>
                    </div>

                    <div class="analysis-item">
                        <strong>Color Match:</strong>
                        <p>${analysisData.color_match}</p>
                    </div>

                    <div class="analysis-item">
                        <strong>Style Match:</strong>
                        <p>${analysisData.style_match}</p>
                    </div>

                    ${analysisData.styling_suggestions ? `
                        <div class="analysis-item">
                            <strong>Styling Suggestions:</strong>
                            <ul>
                                ${analysisData.styling_suggestions.map(s => `<li>${s}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    <div class="analysis-item recommendation">
                        <strong>Overall Recommendation:</strong>
                        <p>${analysisData.overall_recommendation}</p>
                    </div>
                </div>
            `;
        } else if (!response.imageUrl && !response.imageBase64) {
            // Display raw description only if we don't have an image
            resultHTML += `
                <div class="analysis-description">
                    <pre>${response.description}</pre>
                </div>
            `;
        }
    }

    // Removed cache indicator - caching is now disabled

    if (response.note) {
        resultHTML += `
            <div class="api-note">
                <p><strong>Note:</strong> ${response.note}</p>
            </div>
        `;
    }

    resultHTML += `</div>`;

    tryonResult.innerHTML = resultHTML;

    // Add event listener for regenerate button if it exists
    const regenerateBtn = document.getElementById('regenerateTryOnBtn');
    if (regenerateBtn) {
        console.log('Adding event listener to regenerate button');
        regenerateBtn.addEventListener('click', () => {
            console.log('Regenerate button clicked');
            testVirtualTryOn();
        });
    }
}

// Read file as data URL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Image compression function (reused from tab.js)
async function compressImage(file, maxSize) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = function() {
            // Calculate new dimensions while maintaining aspect ratio
            let { width, height } = img;
            const maxDimension = 1200; // Max width or height

            if (width > height) {
                if (width > maxDimension) {
                    height = (height * maxDimension) / width;
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = (width * maxDimension) / height;
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);

            // Try different quality levels until we get under maxSize
            let quality = 0.8;
            let dataUrl;

            const tryCompress = () => {
                dataUrl = canvas.toDataURL('image/jpeg', quality);
                const size = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3/4);

                if (size <= maxSize || quality <= 0.1) {
                    resolve(dataUrl);
                } else {
                    quality -= 0.1;
                    setTimeout(tryCompress, 10);
                }
            };

            tryCompress();
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(file);
    });
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ========================================
// Try-On Photo Management Functions
// ========================================

// Load saved try-on photo
async function loadTryonPhoto() {
    try {
        const result = await chrome.storage.local.get(['tryonPhoto']);

        if (result.tryonPhoto) {
            displayTryonPhoto(result.tryonPhoto);
        }
    } catch (error) {
        console.error('Failed to load try-on photo:', error);
    }
}

// Display try-on photo
function displayTryonPhoto(photoData) {
    const placeholder = document.getElementById('tryonPhotoPlaceholder');
    const preview = document.getElementById('tryonPhotoPreview');
    const image = document.getElementById('tryonPhotoImage');

    if (placeholder && preview && image) {
        placeholder.style.display = 'none';
        preview.style.display = 'block';
        image.src = photoData;
    }
}

// Handle try-on photo upload
async function handleTryonPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 20 * 1024 * 1024; // 20MB (Gemini API limit)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    // Validate file type
    if (!allowedTypes.includes(file.type.toLowerCase())) {
        showNotification('Please upload a JPG, PNG, or WebP image', 'error');
        return;
    }

    try {
        let photoData;

        // Compress image if it's too large
        if (file.size > maxSize) {
            showNotification(`Image is large (${formatFileSize(file.size)}) - compressing...`, 'info');
            try {
                photoData = await compressImage(file, maxSize);
                showNotification('Try-on photo compressed and uploaded successfully!', 'success');
            } catch (error) {
                console.error('Failed to compress image:', error);
                showNotification('Image is too large and compression failed. Please try a smaller image.', 'error');
                return;
            }
        } else {
            // Read the file without compression
            photoData = await readFileAsDataURL(file);
            showNotification('Try-on photo uploaded successfully!', 'success');
        }

        // Save to storage
        await chrome.storage.local.set({ tryonPhoto: photoData });

        // Display the photo
        displayTryonPhoto(photoData);

    } catch (error) {
        console.error('Failed to upload try-on photo:', error);
        showNotification('Failed to upload photo: ' + error.message, 'error');
    }
}

// Remove try-on photo
async function removeTryonPhoto() {
    try {
        // Remove from storage
        await chrome.storage.local.remove(['tryonPhoto']);

        // Update UI
        const placeholder = document.getElementById('tryonPhotoPlaceholder');
        const preview = document.getElementById('tryonPhotoPreview');
        const image = document.getElementById('tryonPhotoImage');
        const input = document.getElementById('tryonPhotoInput');

        if (placeholder && preview && image && input) {
            placeholder.style.display = 'flex';
            preview.style.display = 'none';
            image.src = '';
            input.value = '';
        }

        showNotification('Try-on photo removed', 'info');
    } catch (error) {
        console.error('Failed to remove try-on photo:', error);
        showNotification('Failed to remove photo: ' + error.message, 'error');
    }
}

// Helper function to get stored photos (needs to be available)
async function getStoredPhotos() {
    const result = await chrome.storage.local.get(['userPhotos']);
    return result.userPhotos || [];
}

// Helper function to show notifications (needs to be available)
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// ========================================
// Initialize Gemini UI Event Listeners
// ========================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGeminiUI);
} else {
    // DOM already loaded
    initializeGeminiUI();
}

function initializeGeminiUI() {
    console.log('Initializing Gemini API UI...');

    // Check Gemini API status on load
    checkGeminiAPIStatus();

    // Update user photo dropdown
    updateUserPhotoSelect();

    // Event listeners for API key management
    const saveAPIKeyBtn = document.getElementById('saveAPIKeyBtn');
    if (saveAPIKeyBtn) {
        saveAPIKeyBtn.addEventListener('click', saveGeminiAPIKey);
    }

    // Toggle API key visibility
    const showAPIKeyBtn = document.getElementById('showAPIKeyBtn');
    const apiKeyInput = document.getElementById('geminiAPIKeyInput');
    if (showAPIKeyBtn && apiKeyInput) {
        showAPIKeyBtn.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                showAPIKeyBtn.textContent = '🔒';
            } else {
                apiKeyInput.type = 'password';
                showAPIKeyBtn.textContent = '👁️';
            }
        });
    }

    // Event listeners for try-on photo upload
    const tryonPhotoUploadArea = document.getElementById('tryonPhotoUploadArea');
    const tryonPhotoInput = document.getElementById('tryonPhotoInput');
    const removeTryonPhotoBtn = document.getElementById('removeTryonPhotoBtn');

    if (tryonPhotoUploadArea && tryonPhotoInput) {
        tryonPhotoUploadArea.addEventListener('click', () => {
            tryonPhotoInput.click();
        });
        tryonPhotoInput.addEventListener('change', handleTryonPhotoUpload);
    }

    if (removeTryonPhotoBtn) {
        removeTryonPhotoBtn.addEventListener('click', removeTryonPhoto);
    }

    // Event listeners for try-on functionality
    const userPhotoSelect = document.getElementById('userPhotoSelect');
    const clothingImageInput = document.getElementById('clothingImageInput');
    const testTryOnBtn = document.getElementById('testTryOnBtn');

    if (userPhotoSelect) {
        userPhotoSelect.addEventListener('change', updateTryOnButton);
    }

    if (clothingImageInput) {
        clothingImageInput.addEventListener('change', updateTryOnButton);
    }

    if (testTryOnBtn) {
        testTryOnBtn.addEventListener('click', testVirtualTryOn);
    }

    // Listen for photo changes to update dropdown
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.userPhotos) {
            updateUserPhotoSelect();
        }
    });

    console.log('Gemini API UI initialized successfully');
}
