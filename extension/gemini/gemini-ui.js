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
            if (tryonTestSection) tryonTestSection.style.display = 'block';
        } else if (response.configured && !response.valid) {
            statusElement.textContent = 'Invalid Key';
            statusElement.className = 'status-indicator error';
            if (apiKeySetup) apiKeySetup.style.display = 'block';
            if (tryonTestSection) tryonTestSection.style.display = 'none';
            showNotification('Gemini API key is invalid. Please update it.', 'error');
        } else {
            statusElement.textContent = 'Not Configured';
            statusElement.className = 'status-indicator error';
            if (apiKeySetup) apiKeySetup.style.display = 'block';
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

    tryonResult.style.display = 'block';
    tryonResult.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Generating virtual try-on image...</p>
            <p class="loading-note">This may take 10-30 seconds</p>
        </div>
    `;

    try {
        // Get user photo
        const photos = await getStoredPhotos();
        const userPhoto = photos[photoIndex];

        if (!userPhoto) {
            throw new Error('Selected photo not found');
        }

        // Read clothing image
        const clothingImageData = await readFileAsDataURL(clothingFile);

        console.log('Sending try-on request...');

        // Call background script to generate try-on
        const response = await chrome.runtime.sendMessage({
            action: 'generateTryOn',
            userPhoto: userPhoto.data,
            clothingImage: clothingImageData,
            options: {
                temperature: 0.7
            }
        });

        console.log('Try-on response:', response);

        if (response.success) {
            displayTryOnResult(response, clothingImageData);
            showNotification('Try-on image generated successfully!', 'success');
        } else {
            throw new Error(response.error || 'Try-on generation failed');
        }

    } catch (error) {
        console.error('Virtual try-on error:', error);
        tryonResult.innerHTML = `
            <div class="error-result">
                <h4>❌ Try-On Failed</h4>
                <p><strong>Error:</strong> ${error.message}</p>
                <button class="retry-btn" onclick="testVirtualTryOn()">Try Again</button>
            </div>
        `;
        showNotification('Try-on failed: ' + error.message, 'error');
    } finally {
        testTryOnBtn.disabled = false;
        testTryOnBtn.textContent = 'Generate Try-On Image';
    }
}

// Display try-on result
function displayTryOnResult(response, clothingImageData) {
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
            <div class="tryon-images">
                <div class="image-container">
                    <h5>Original Clothing</h5>
                    <img src="${clothingImageData}" alt="Clothing item" class="tryon-image">
                </div>
                <div class="image-container">
                    <h5>Virtual Try-On</h5>
                    <img src="${imageUrl}" alt="Virtual try-on result" class="tryon-image generated-image">
                </div>
            </div>
        `;
    } else {
        // No generated image, display clothing preview only
        resultHTML += `
            <div class="clothing-preview">
                <img src="${clothingImageData}" alt="Clothing item" style="max-width: 200px; border-radius: 8px; margin: 10px 0;">
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

    if (response.cached) {
        resultHTML += `<p class="cache-note">📦 Retrieved from cache</p>`;
    }

    if (response.note) {
        resultHTML += `
            <div class="api-note">
                <p><strong>Note:</strong> ${response.note}</p>
            </div>
        `;
    }

    resultHTML += `</div>`;

    tryonResult.innerHTML = resultHTML;
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
