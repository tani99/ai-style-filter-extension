// Tab JavaScript for AI Style Dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('AI Style Dashboard loaded');
    
    // Initialize dashboard
    initializeDashboard();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up navigation listeners
    setupNavigationListeners();
    
    // Check AI status
    checkAIStatus();

    

    // Load existing photos and style profile
    loadSavedPhotos();
    loadSavedStyleProfile();
    
    // Check if user is already logged in to wardrobe
    checkInitialWardrobeStatus();
    
    // HEIC support temporarily disabled
    // checkHeicSupport();
});

function initializeDashboard() {
    console.log('Initializing dashboard...');
}

function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const photoInput = document.getElementById('photoInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    // Upload area click
    uploadArea.addEventListener('click', () => {
        photoInput.click();
    });
    
    // File input change
    photoInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Analyze button
    analyzeBtn.addEventListener('click', analyzeStyle);
    
    // Clear all photos button
    const clearAllBtn = document.getElementById('clearAllBtn');
    clearAllBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all photos? This cannot be undone.')) {
            clearAllPhotos();
        }
    });
    
    // Clear style profile button
    const clearProfileBtn = document.getElementById('clearProfileBtn');
    clearProfileBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your style profile? This cannot be undone.')) {
            clearStyleProfile();
        }
    });
    
    // Test AI button
    const testAIBtn = document.getElementById('testAIBtn');
    testAIBtn.addEventListener('click', testChromeAI);
    
    // Add event delegation for dynamically created buttons
    document.addEventListener('click', function(event) {
        // Handle regenerate profile button clicks
        if (event.target && event.target.id === 'regenerateProfileBtn') {
            console.log('Regenerate button clicked via delegation');
            regenerateStyleProfile();
        }
        
        // Handle profile editing buttons
        if (event.target && event.target.id === 'editProfileBtn') {
            enableProfileEditing();
        }
        
        if (event.target && event.target.id === 'saveProfileBtn') {
            saveProfileEdits();
        }
        
        if (event.target && event.target.id === 'cancelEditBtn') {
            cancelProfileEditing();
        }
        
        // Handle other dynamic buttons
        if (event.target && event.target.classList.contains('retry-btn')) {
            if (event.target.id === 'checkAIStatusBtn' || event.target.id === 'recheckAIStatusBtn') {
                checkAIStatus();
            } else if (event.target.id === 'retryAnalysisBtn') {
                analyzeStyle();
            } else if (event.target.id === 'retryRegenerateBtn') {
                regenerateStyleProfile();
            }
        }
        
        if (event.target && event.target.id === 'hideSetupBtn') {
            hideAISetupInstructions();
        }
    });
    

    
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    processFiles(files);
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = Array.from(event.dataTransfer.files);
    processFiles(files.filter(file => file.type.startsWith('image/')));
}

async function processFiles(files) {
    const existingPhotos = await getStoredPhotos();
    const maxPhotos = 5;
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    // HEIC support temporarily disabled
    // const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    // const needsConversion = ['image/heic', 'image/heif'];
    
    // Check total photo limit
    if (existingPhotos.length + files.length > maxPhotos) {
        showNotification(`Maximum ${maxPhotos} photos allowed. You can upload ${maxPhotos - existingPhotos.length} more.`, 'error');
        return;
    }
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
        // Validate file type
        if (!allowedTypes.includes(file.type.toLowerCase())) {
            showNotification(`${file.name} is not supported. Please use JPG, PNG, or WebP format.`, 'error');
            errorCount++;
            continue;
        }
        
        // HEIC conversion logic temporarily disabled
        /*
        // Detect file type (check extension for HEIC files since browser might not set MIME type correctly)
        let fileType = file.type.toLowerCase();
        if (!fileType && file.name) {
            const extension = file.name.split('.').pop().toLowerCase();
            if (extension === 'heic' || extension === 'heif') {
                fileType = `image/${extension}`;
            }
        }
        
        // Handle HEIC files
        if (needsConversion.includes(fileType)) {
            showNotification(`${file.name} is HEIC format. Converting to JPEG...`, 'warning');
            try {
                const convertedFile = await convertHeicToJpeg(file);
                if (convertedFile.size > maxSize) {
                    const compressedFile = await compressImage(convertedFile, maxSize);
                    await addPhoto(compressedFile, file.name.replace(/\.(heic|heif)$/i, '.jpg'));
                } else {
                    await addPhoto(convertedFile, file.name.replace(/\.(heic|heif)$/i, '.jpg'));
                }
                processedCount++;
            } catch (error) {
                showNotification(`Failed to convert ${file.name}. HEIC conversion requires a modern browser. Try converting to JPEG first.`, 'error');
                errorCount++;
            }
            continue;
        }
        */
        
        // Validate file size
        if (file.size > maxSize) {
            showNotification(`${file.name} is large (${formatFileSize(file.size)}) - compressing...`, 'info');
            try {
                const compressedFile = await compressImage(file, maxSize);
                await addPhoto(compressedFile, file.name);
                processedCount++;
            } catch (error) {
                showNotification(`Failed to compress ${file.name}. Please try a smaller image.`, 'error');
                errorCount++;
            }
            continue;
        }
        
        // Process valid file
        await addPhoto(file);
        processedCount++;
    }
    
    // Show final success message
    if (processedCount > 0) {
        const hasLargeFiles = files.some(f => f.size > maxSize);
        const message = hasLargeFiles 
            ? `Successfully processed ${processedCount} photo${processedCount > 1 ? 's' : ''} (compressed as needed)!`
            : `Successfully uploaded ${processedCount} photo${processedCount > 1 ? 's' : ''}!`;
        showNotification(message, 'success');
    }
    
    updateAnalyzeButton();
}

async function addPhoto(file, originalName = null) {
    return new Promise((resolve) => {
        if (typeof file === 'string') {
            // File is already a data URL (from compression)
            const photoData = {
                id: Date.now() + Math.random(),
                name: originalName || 'compressed_image.jpg',
                data: file,
                timestamp: Date.now()
            };
            
            savePhoto(photoData).then(() => {
                displayPhoto(photoData);
                resolve();
            });
        } else {
            // File is a File object
            const reader = new FileReader();
            reader.onload = async (e) => {
                const photoData = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    data: e.target.result,
                    timestamp: Date.now()
                };
                
                await savePhoto(photoData);
                displayPhoto(photoData);
                resolve();
            };
            reader.readAsDataURL(file);
        }
    });
}

function displayPhoto(photo) {
    const gallery = document.getElementById('photoGallery');
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.dataset.photoId = photo.id;
    
    photoItem.innerHTML = `
        <img src="${photo.data}" alt="${photo.name}" />
        <button class="photo-remove">×</button>
    `;
    
    // Add event listener for remove button
    const removeBtn = photoItem.querySelector('.photo-remove');
    removeBtn.addEventListener('click', () => {
        removePhoto(photo.id);
    });
    
    gallery.appendChild(photoItem);
}

async function removePhoto(photoId) {
    // Remove from storage
    const photos = await getStoredPhotos();
    const updatedPhotos = photos.filter(p => String(p.id) !== String(photoId));
    await chrome.storage.local.set({ userPhotos: updatedPhotos });
    
    // Remove from display
    const photoElement = document.querySelector(`[data-photo-id="${photoId}"]`);
    if (photoElement) {
        photoElement.remove();
    }
    
    updateAnalyzeButton();
}

async function savePhoto(photo) {
    const photos = await getStoredPhotos();
    photos.push(photo);
    await chrome.storage.local.set({ userPhotos: photos });
}

async function getStoredPhotos() {
    const result = await chrome.storage.local.get(['userPhotos']);
    return result.userPhotos || [];
}

async function loadSavedPhotos() {
    const photos = await getStoredPhotos();
    photos.forEach(photo => displayPhoto(photo));
    updateAnalyzeButton();
    updateUserPhotoSelect();
}

async function loadSavedStyleProfile() {
    try {
        const result = await chrome.storage.local.get(['styleProfile']);
        if (result.styleProfile) {
            console.log('Loading saved style profile:', result.styleProfile);
            displayStyleProfile(result.styleProfile);
            showNotification('Welcome back! Your style profile has been restored.', 'success');
        }
    } catch (error) {
        console.error('Failed to load saved style profile:', error);
    }
}

async function clearAllPhotos() {
    // Clear from storage
    await chrome.storage.local.set({ userPhotos: [] });
    
    // Clear from display
    const gallery = document.getElementById('photoGallery');
    gallery.innerHTML = '';
    
    // Update UI
    updateAnalyzeButton();
    showNotification('All photos cleared!', 'info');
}

async function clearStyleProfile() {
    // Clear from storage
    await chrome.storage.local.remove(['styleProfile']);
    
    // Reset analysis section to placeholder state
    const analysisContent = document.getElementById('analysisContent');
    if (analysisContent) {
        analysisContent.innerHTML = `
            <div class="placeholder-state">
                <span class="placeholder-icon">🎨</span>
                <p>Upload photos to generate your AI-powered style profile</p>
                <button id="analyzeBtn" class="analyze-btn" disabled>
                    Analyze My Style
                </button>
            </div>
        `;
        
        // Re-attach analyze button event listener
        const newAnalyzeBtn = document.getElementById('analyzeBtn');
        if (newAnalyzeBtn) {
            newAnalyzeBtn.addEventListener('click', analyzeStyle);
        }
    }
    
    // Update UI
    updateAnalyzeButton();
    showNotification('Style profile cleared!', 'info');
}

// Storage quota management removed - using simple 5-photo limit instead

// Multi-Photo Style Analysis Functions


async function performMultiPhotoStyleAnalysis(photos) {
    try {
        console.log('Performing multi-photo style analysis with actual images...');
        console.log(`Analyzing ${photos.length} photos`);

        // Convert photo data URLs to image URLs that can be fetched
        const photoUrls = photos.map(photo => photo.data);

        console.log(`Successfully prepared ${photoUrls.length} photo data URLs for analysis`);

        // Send to background script for AI processing with images
        const response = await chrome.runtime.sendMessage({
            action: 'aiStyleProfileWithImages',
            photoDataUrls: photoUrls,
            photoCount: photos.length,
            options: {
                temperature: 0.7,
                maxRetries: 3
            }
        });

        if (response.success) {
            // Parse the AI response into structured data
            const profileData = parseStyleAnalysisResponse(response.response);

            return {
                success: true,
                profile: profileData,
                rawResponse: response.response
            };
        } else {
            return {
                success: false,
                error: response.error || 'AI analysis failed'
            };
        }

    } catch (error) {
        console.error('Multi-photo analysis error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

function createStyleAnalysisPrompt(photos) {
    const photoCount = photos.length;

    return `You are an expert fashion stylist and personal style consultant. I have uploaded ${photoCount} photos showing different outfits. Please analyze the ACTUAL IMAGES provided and create a comprehensive personal style profile based on what you SEE.

IMPORTANT INSTRUCTIONS:
1. Look carefully at each image and analyze the clothing, colors, patterns, and overall style visible in the photos
2. Base your analysis on the VISUAL CONTENT of the images, not assumptions
3. Identify specific colors, patterns, silhouettes, and style elements you can see
4. Respond with ONLY a valid JSON object in the exact format specified below. Do not include any markdown formatting, explanations, or text outside the JSON.

Based on analyzing the ${photoCount} images provided, create a detailed style profile:

{
  "analysis_summary": "Brief overview of the style analysis",
  "color_palette": {
    "best_colors": ["color1", "color2", "color3"],
    "color_reasoning": "Why these colors work well",
    "avoid_colors": ["color1", "color2"]
  },
  "style_categories": [
    {
      "name": "Primary style category",
      "confidence": "high/medium/low",
      "description": "Why this style suits them"
    },
    {
      "name": "Secondary style category", 
      "confidence": "high/medium/low",
      "description": "Additional style that works"
    },
    {
      "name": "Tertiary style category",
      "confidence": "high/medium/low", 
      "description": "Third style option"
    }
  ],
  "body_type_analysis": {
    "silhouettes": ["silhouette1", "silhouette2", "silhouette3"],
    "fits": ["fit1", "fit2", "fit3"],
    "recommendations": "Specific fit and silhouette advice"
  },
  "pattern_preferences": {
    "recommended_patterns": ["pattern1", "pattern2", "pattern3"],
    "pattern_reasoning": "Why these patterns work",
    "avoid_patterns": ["pattern1", "pattern2"]
  },
  "overall_aesthetic": {
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "description": "Complete aesthetic summary",
    "style_personality": "Brief personality description"
  },
  "shopping_recommendations": {
    "key_pieces": ["piece1", "piece2", "piece3"],
    "brands_to_consider": ["brand1", "brand2", "brand3"],
    "style_tips": ["tip1", "tip2", "tip3"]
  }
}

Photos to analyze:
${photoDescriptions}

Remember: Respond with ONLY the JSON object, no additional text or formatting.`;
}

function parseStyleAnalysisResponse(response) {
    try {
        // Clean the response - remove any markdown formatting or extra text
        let cleanResponse = response.trim();
        
        // Remove markdown code blocks if present
        cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Find JSON object (look for opening and closing braces)
        const jsonStart = cleanResponse.indexOf('{');
        const jsonEnd = cleanResponse.lastIndexOf('}');
        
        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('No valid JSON found in AI response');
        }
        
        const jsonString = cleanResponse.substring(jsonStart, jsonEnd + 1);
        const profileData = JSON.parse(jsonString);
        
        // Validate required fields
        if (!profileData.analysis_summary || !profileData.color_palette || !profileData.style_categories) {
            throw new Error('Invalid style profile structure');
        }
        
        // Add metadata
        profileData.generated_at = Date.now();
        profileData.version = '1.0';
        
        console.log('Successfully parsed style profile:', profileData);
        return profileData;
        
    } catch (error) {
        console.error('Failed to parse style analysis response:', error);
        console.log('Raw response:', response);
        
        // Return fallback profile
        return createFallbackProfile(response);
    }
}

function createFallbackProfile(rawResponse) {
    return {
        analysis_summary: "Style analysis completed, but response formatting needs improvement.",
        color_palette: {
            best_colors: ["Classic Navy", "Crisp White", "Soft Gray"],
            color_reasoning: "These versatile colors work well for most people and are universally flattering",
            avoid_colors: ["Neon colors"]
        },
        style_categories: [
            {
                name: "Classic",
                confidence: "medium",
                description: "Timeless and versatile pieces that work with many body types"
            },
            {
                name: "Casual",
                confidence: "medium",
                description: "Comfortable everyday wear that suits most lifestyles"
            },
            {
                name: "Modern",
                confidence: "medium",
                description: "Contemporary styling with universal appeal"
            }
        ],
        body_type_analysis: {
            observed_features: ["Unable to analyze - using defaults"],
            silhouettes: ["Tailored", "Relaxed", "Structured"],
            fits: ["Well-fitted", "Comfortable", "Flattering"],
            recommendations: "Focus on pieces that make you feel confident and comfortable. Try different silhouettes to find what works best for your body type."
        },
        pattern_preferences: {
            recommended_patterns: ["Solid colors", "Subtle textures", "Classic stripes"],
            pattern_reasoning: "Simple patterns are versatile and tend to be universally flattering",
            avoid_patterns: ["Overly busy prints"]
        },
        overall_aesthetic: {
            keywords: ["Versatile", "Classic", "Confident"],
            description: "A classic and versatile style that can adapt to different occasions and body types",
            style_personality: "Confident and adaptable"
        },
        shopping_recommendations: {
            key_pieces: ["Well-fitted jeans", "Classic blazer", "Quality basics"],
            brands_to_consider: ["Universal brands with good fit"],
            style_tips: ["Focus on fit and comfort", "Invest in quality basics", "Choose versatile pieces that can be mixed and matched"]
        },
        generated_at: Date.now(),
        version: '1.0',
        fallback: true,
        raw_response: rawResponse
    };
}

function displayStyleProfile(profile) {
    const analysisContent = document.getElementById('analysisContent');
    
    const isAnimated = !profile.fallback; // Don't animate fallback profiles
    
    analysisContent.innerHTML = `
        <div class="style-profile ${isAnimated ? 'fade-in' : ''}">
            <div class="profile-header">
                <h3>✨ What Looks Best On You</h3>
                <p class="analysis-summary">${profile.analysis_summary}</p>
                ${profile.fallback ? '<p class="fallback-note">⚠️ Generated from fallback data - AI parsing incomplete</p>' : ''}
            </div>
            
            <div class="profile-sections">
                <!-- Color Palette Section -->
                <div class="profile-section">
                    <h4>🎨 Colors That Flatter You</h4>
                    <div class="color-section">
                        <div class="color-group">
                            <strong>Recommended Colors:</strong>
                            <div class="color-list">
                                ${profile.color_palette.best_colors.map(color => 
                                    `<span class="color-tag best">${color}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <p class="color-reasoning">${profile.color_palette.color_reasoning}</p>
                        ${profile.color_palette.avoid_colors && profile.color_palette.avoid_colors.length > 0 ? `
                            <div class="color-group">
                                <strong>Colors to Avoid:</strong>
                                <div class="color-list">
                                    ${profile.color_palette.avoid_colors.map(color => 
                                        `<span class="color-tag avoid">${color}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Style Categories Section -->
                <div class="profile-section">
                    <h4>👗 Styles That Suit You</h4>
                    <div class="style-categories">
                        ${profile.style_categories.map((category, index) => `
                            <div class="style-category ${category.confidence}">
                                <div class="category-header">
                                    <span class="category-name">${category.name}</span>
                                    <span class="confidence-badge ${category.confidence}">${category.confidence}</span>
                                </div>
                                <p class="category-description">${category.description}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Body Type Analysis Section -->
                <div class="profile-section">
                    <h4>👤 Body Type & Proportions</h4>
                    <div class="body-analysis">
                        ${profile.body_type_analysis.observed_features ? `
                            <div class="fit-group">
                                <strong>Observed Features:</strong>
                                <div class="tag-list">
                                    ${profile.body_type_analysis.observed_features.map(feature =>
                                        `<span class="fit-tag">${feature}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <div class="fit-group">
                            <strong>Flattering Silhouettes:</strong>
                            <div class="tag-list">
                                ${profile.body_type_analysis.silhouettes.map(silhouette =>
                                    `<span class="fit-tag">${silhouette}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="fit-group">
                            <strong>Best Fits:</strong>
                            <div class="tag-list">
                                ${profile.body_type_analysis.fits.map(fit =>
                                    `<span class="fit-tag">${fit}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <p class="fit-recommendations">${profile.body_type_analysis.recommendations}</p>
                    </div>
                </div>
                
                <!-- Pattern Preferences Section -->
                <div class="profile-section">
                    <h4>🔶 Pattern Preferences</h4>
                    <div class="pattern-section">
                        <div class="pattern-group">
                            <strong>Recommended Patterns:</strong>
                            <div class="tag-list">
                                ${profile.pattern_preferences.recommended_patterns.map(pattern => 
                                    `<span class="pattern-tag recommended">${pattern}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <p class="pattern-reasoning">${profile.pattern_preferences.pattern_reasoning}</p>
                        ${profile.pattern_preferences.avoid_patterns && profile.pattern_preferences.avoid_patterns.length > 0 ? `
                            <div class="pattern-group">
                                <strong>Patterns to Avoid:</strong>
                                <div class="tag-list">
                                    ${profile.pattern_preferences.avoid_patterns.map(pattern => 
                                        `<span class="pattern-tag avoid">${pattern}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Overall Aesthetic Section -->
                <div class="profile-section">
                    <h4>✨ Overall Aesthetic</h4>
                    <div class="aesthetic-section">
                        <div class="aesthetic-keywords">
                            <div class="tag-list">
                                ${profile.overall_aesthetic.keywords.map(keyword => 
                                    `<span class="aesthetic-tag">${keyword}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <p class="aesthetic-description">${profile.overall_aesthetic.description}</p>
                        <p class="style-personality"><strong>Style Personality:</strong> ${profile.overall_aesthetic.style_personality}</p>
                    </div>
                </div>
                
                <!-- Shopping Recommendations Section -->
                <div class="profile-section">
                    <h4>🛍️ Shopping Recommendations</h4>
                    <div class="shopping-section">
                        <div class="shopping-group">
                            <strong>Key Pieces to Look For:</strong>
                            <ul class="recommendation-list">
                                ${profile.shopping_recommendations.key_pieces.map(piece => 
                                    `<li>${piece}</li>`
                                ).join('')}
                            </ul>
                        </div>
                        <div class="shopping-group">
                            <strong>Brands to Consider:</strong>
                            <div class="tag-list">
                                ${profile.shopping_recommendations.brands_to_consider.map(brand => 
                                    `<span class="brand-tag">${brand}</span>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="shopping-group">
                            <strong>Style Tips:</strong>
                            <ul class="tip-list">
                                ${profile.shopping_recommendations.style_tips.map(tip => 
                                    `<li>${tip}</li>`
                                ).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="profile-footer">
                <div class="edit-controls">
                    <button class="edit-btn" id="editProfileBtn">✏️ Edit Profile</button>
                    <button class="save-btn" id="saveProfileBtn" style="display: none;">💾 Save Changes</button>
                    <button class="cancel-btn" id="cancelEditBtn" style="display: none;">❌ Cancel</button>
                </div>
                <p class="generated-info">Generated on ${new Date(profile.generated_at).toLocaleDateString()} • Version ${profile.version}</p>
                <button class="regenerate-btn" id="regenerateProfileBtn">🔄 Regenerate Recommendations</button>
            </div>
        </div>
    `;
    
    // Add event listener for regenerate button using direct DOM manipulation
    // Wait for next tick to ensure DOM is updated
    requestAnimationFrame(() => {
        const regenerateBtn = document.getElementById('regenerateProfileBtn');
        if (regenerateBtn) {
            console.log('Adding event listener to regenerate button');
            regenerateBtn.addEventListener('click', regenerateStyleProfile);
        } else {
            console.error('Regenerate button not found in DOM');
        }
    });
}

// Separate function for regenerating profiles that doesn't depend on main UI elements
async function regenerateStyleProfile() {
    console.log('Regenerating style profile...');
    
    try {
        // Get the analysis content area
        const analysisContent = document.getElementById('analysisContent');
        if (!analysisContent) {
            console.error('Analysis content area not found');
            showNotification('Cannot regenerate profile - UI error', 'error');
            return;
        }
        
        // Get photos
        const photos = await getStoredPhotos();
        if (photos.length === 0) {
            showNotification('No photos available for analysis', 'error');
            return;
        }
        
        console.log(`Regenerating style analysis for ${photos.length} photos`);
        
        // Show regenerating state
        analysisContent.innerHTML = `
            <div class="analysis-loading">
                <div class="loading-spinner"></div>
                <h3>Regenerating Your Style Recommendations...</h3>
                <p>Creating a fresh analysis of your features from ${photos.length} photo${photos.length > 1 ? 's' : ''}</p>
                <div class="loading-steps">
                    <div class="step active">🔄 Re-analyzing photos</div>
                    <div class="step">🎨 Reassessing coloring & undertones</div>
                    <div class="step">👗 Updating flattering styles</div>
                    <div class="step">✨ Generating new recommendations</div>
                </div>
            </div>
        `;
        
        // Perform AI-powered style analysis
        const analysisResult = await performMultiPhotoStyleAnalysis(photos);
        
        if (analysisResult.success) {
            // Display the new analysis results
            displayStyleProfile(analysisResult.profile);
            showNotification(`Style recommendations regenerated! Fresh analysis based on your features.`, 'success');
            
            // Save the new profile
            await chrome.storage.local.set({ styleProfile: analysisResult.profile });
            
        } else {
            throw new Error(analysisResult.error || 'Style analysis failed');
        }
        
    } catch (error) {
        console.error('Style profile regeneration failed:', error);
        
        const analysisContent = document.getElementById('analysisContent');
        if (analysisContent) {
            analysisContent.innerHTML = `
                <div class="analysis-error">
                    <h3>❌ Regeneration Failed</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <div class="error-help">
                        <p>Unable to regenerate your style profile. You can:</p>
                        <ul>
                            <li>Try regenerating again</li>
                            <li>Check your Chrome AI status</li>
                            <li>Go back to upload more photos</li>
                        </ul>
                    </div>
                    <div class="error-actions">
                        <button class="retry-btn" id="retryRegenerateBtn">🔄 Try Regenerating Again</button>
                        <button class="retry-btn" id="checkAIStatusBtn">🔍 Check AI Status</button>
                    </div>
                </div>
            `;
        }
        
        showNotification('Profile regeneration failed: ' + error.message, 'error');
    }
}

async function updateAnalyzeButton() {
    const photos = await getStoredPhotos();
    const analyzeBtn = document.getElementById('analyzeBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const clearProfileBtn = document.getElementById('clearProfileBtn');
    
    // Check if style profile already exists
    const result = await chrome.storage.local.get(['styleProfile']);
    const hasExistingProfile = !!result.styleProfile;
    
    // Check if elements exist before modifying them
    if (analyzeBtn) {
        analyzeBtn.disabled = photos.length === 0;

        if (photos.length > 0) {
            if (hasExistingProfile) {
                analyzeBtn.textContent = `Re-analyze My Features (${photos.length} photos)`;
            } else {
                analyzeBtn.textContent = `Analyze My Features (${photos.length} photos)`;
            }
        } else {
            analyzeBtn.textContent = hasExistingProfile ? 'Re-analyze My Features' : 'Analyze My Features';
        }
    }
    
    if (clearAllBtn) {
        if (photos.length > 0) {
            clearAllBtn.style.display = 'inline-block';
        } else {
            clearAllBtn.style.display = 'none';
        }
    }
    
    if (clearProfileBtn) {
        if (hasExistingProfile) {
            clearProfileBtn.style.display = 'inline-block';
        } else {
            clearProfileBtn.style.display = 'none';
        }
    }
}

async function analyzeStyle() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analysisContent = document.getElementById('analysisContent');
    
    // Check if elements exist before modifying them
    if (!analyzeBtn || !analysisContent) {
        console.error('Required DOM elements not found for style analysis');
        return;
    }
    
    // Update button state
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    
    // Show loading state
    analysisContent.innerHTML = `
        <div class="analysis-loading">
            <div class="loading-spinner"></div>
            <h3>Analyzing Your Features...</h3>
            <p>AI is examining your photos to determine what would look best on you</p>
            <div class="loading-steps">
                <div class="step active">📸 Processing photos</div>
                <div class="step">🎨 Analyzing coloring & undertones</div>
                <div class="step">👗 Determining flattering styles</div>
                <div class="step">✨ Creating your personalized recommendations</div>
            </div>
        </div>
    `;
    
    try {
        const photos = await getStoredPhotos();
        
        if (photos.length === 0) {
            throw new Error('No photos available for analysis');
        }
        
        console.log(`Starting style analysis for ${photos.length} photos`);
        
        // Perform AI-powered style analysis
        const analysisResult = await performMultiPhotoStyleAnalysis(photos);
        
        if (analysisResult.success) {
            // Display the analysis results
            displayStyleProfile(analysisResult.profile);
            showNotification(`Feature analysis complete! Here's what would look best on you.`, 'success');
            
            // Save the profile
            await chrome.storage.local.set({ styleProfile: analysisResult.profile });
            
        } else {
            throw new Error(analysisResult.error || 'Style analysis failed');
        }
        
    } catch (error) {
        console.error('Style analysis failed:', error);
        
        // Show error state with better guidance
        analysisContent.innerHTML = `
            <div class="analysis-error">
                <h3>❌ Analysis Failed</h3>
                <p><strong>Error:</strong> ${error.message}</p>
                <div class="error-help">
                    <p>This usually happens when:</p>
                    <ul>
                        <li>Chrome AI is not enabled or available</li>
                        <li>No photos have been uploaded</li>
                        <li>Network connection issues during AI processing</li>
                    </ul>
                </div>
                <div class="error-actions">
                    <button class="retry-btn" id="checkAIStatusBtn">🔍 Check AI Status</button>
                    <button class="retry-btn" id="retryAnalysisBtn">🔄 Try Again</button>
                </div>
            </div>
        `;
        
        // Event listeners handled by delegation
        
        showNotification('Style analysis failed: ' + error.message, 'error');
    } finally {
        // Reset button
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Re-analyze Features';
        }
    }
}

async function checkAIStatus() {
    const statusElement = document.getElementById('aiStatus');
    const testAIBtn = document.getElementById('testAIBtn');
    
    // Check if elements exist before modifying them
    if (!statusElement || !testAIBtn) {
        console.error('AI status elements not found');
        return;
    }
    
    statusElement.textContent = 'Checking...';
    statusElement.className = 'status-indicator loading';
    testAIBtn.disabled = true;
    
    try {
        const response = await chrome.runtime.sendMessage({ action: 'checkAIAvailability' });
        
        console.log('AI availability check:', response);
        
        if (response.available && response.status === 'readily') {
            statusElement.textContent = 'Ready';
            statusElement.className = 'status-indicator ready';
            testAIBtn.disabled = false;
        } else if (response.status === 'after-download') {
            statusElement.textContent = 'Downloading...';
            statusElement.className = 'status-indicator loading';
            testAIBtn.disabled = true;
        } else {
            statusElement.textContent = 'Not Available';
            statusElement.className = 'status-indicator error';
            testAIBtn.disabled = true;
        }
        
        // Show diagnostics in console
        if (response.diagnostics) {
            console.log('AI Diagnostics:', response.diagnostics);
        }
        
        // Show setup instructions if AI is not ready
        if (response.setupInstructions && !response.available) {
            displayAISetupInstructions(response.setupInstructions, response.message);
        }
        
    } catch (error) {
        console.error('Failed to check AI status:', error);
        statusElement.textContent = 'Error';
        statusElement.className = 'status-indicator error';
        testAIBtn.disabled = true;
    }
}

async function testChromeAI() {
    const testBtn = document.getElementById('testAIBtn');
    const resultDiv = document.getElementById('aiTestResult');
    
    // Check if elements exist before modifying them
    if (!testBtn || !resultDiv) {
        console.error('Test AI elements not found');
        return;
    }
    
    // Update button state
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    
    // Show result area
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="loading">Testing Chrome AI...</div>';
    
    try {
        // Send test prompt to background script
        const response = await chrome.runtime.sendMessage({ 
            action: 'testAI',
            prompt: 'Hello! Can you tell me a fun fact about fashion?'
        });
        
        console.log('AI test response:', response);
        
        if (response.success) {
            resultDiv.innerHTML = `
                <div class="ai-success">
                    <strong>✅ AI Test Successful!</strong>
                    <p><strong>Response:</strong> ${response.response}</p>
                </div>
            `;
            showNotification('Chrome AI test successful!', 'success');
        } else {
            resultDiv.innerHTML = `
                <div class="ai-error">
                    <strong>❌ AI Test Failed</strong>
                    <p><strong>Error:</strong> ${response.error || response.message}</p>
                </div>
            `;
            showNotification('Chrome AI test failed: ' + (response.error || response.message), 'error');
        }
        
    } catch (error) {
        console.error('AI test error:', error);
        resultDiv.innerHTML = `
            <div class="ai-error">
                <strong>❌ Test Error</strong>
                <p><strong>Error:</strong> ${error.message}</p>
            </div>
        `;
        showNotification('AI test error: ' + error.message, 'error');
    } finally {
        // Reset button
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.textContent = 'Test Chrome AI';
        }
    }
}

async function saveSetting(key, value) {
    const settings = await chrome.storage.local.get(['settings']) || {};
    settings.settings = settings.settings || {};
    settings.settings[key] = value;
    await chrome.storage.local.set(settings);
}

// HEIC support temporarily disabled
/*
function checkHeicSupport() {
    setTimeout(() => {
        if (typeof heic2any !== 'undefined') {
            console.log('✅ HEIC conversion library loaded successfully');
            showNotification('HEIC photo support enabled! 📱', 'info');
        } else {
            console.warn('⚠️ HEIC conversion library not loaded');
            showNotification('HEIC support unavailable - upload will be limited to JPG/PNG/WebP', 'warning');
        }
    }, 1000); // Wait a bit for library to load
}
*/

// Helper Functions

// HEIC conversion functions temporarily disabled
/*
// Convert HEIC to JPEG using heic2any library
async function convertHeicToJpeg(file) {
    try {
        console.log('Converting HEIC file:', file.name);
        
        // Check if heic2any is available
        if (typeof heic2any === 'undefined') {
            throw new Error('HEIC conversion library not loaded');
        }
        
        // Convert HEIC to JPEG using heic2any library
        const jpegBlob = await heic2any({
            blob: file,
            toType: 'image/jpeg',
            quality: 0.9
        });
        
        // Create a new File object from the converted blob
        const convertedFile = new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now()
        });
        
        console.log('HEIC conversion successful:', convertedFile.name, 'Size:', formatFileSize(convertedFile.size));
        return convertedFile;
        
    } catch (error) {
        console.error('HEIC conversion failed:', error);
        
        // Try fallback method for browsers with limited HEIC support
        try {
            return await convertHeicFallback(file);
        } catch (fallbackError) {
            console.error('Fallback conversion also failed:', fallbackError);
            throw new Error('HEIC conversion failed. Please try converting to JPEG manually or use a different browser.');
        }
    }
}

// Fallback HEIC conversion using browser APIs
async function convertHeicFallback(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = function() {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob(blob => {
                if (blob) {
                    const convertedFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(convertedFile);
                } else {
                    reject(new Error('Canvas conversion failed'));
                }
            }, 'image/jpeg', 0.9);
        };
        
        img.onerror = () => {
            reject(new Error('Browser cannot load HEIC files natively'));
        };
        
        img.src = URL.createObjectURL(file);
    });
}
*/

// Image compression function
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

// Show notification to user
function displayAISetupInstructions(instructions, errorMessage) {
    // Create or update setup instructions section
    let setupSection = document.getElementById('aiSetupInstructions');
    if (!setupSection) {
        setupSection = document.createElement('div');
        setupSection.id = 'aiSetupInstructions';
        setupSection.className = 'ai-setup-instructions';
        
        // Insert after AI status section
        const aiStatusSection = document.querySelector('.settings-section');
        aiStatusSection.parentNode.insertBefore(setupSection, aiStatusSection.nextSibling);
    }
    
    setupSection.innerHTML = `
        <div class="setup-header">
            <h3>🔧 ${instructions.title}</h3>
            <p class="error-message">${errorMessage}</p>
        </div>
        
        <div class="setup-steps">
            <h4>Follow these steps to enable Chrome AI:</h4>
            <ol>
                ${instructions.steps.map(step => `
                    <li>
                        <strong>${step.action}</strong>
                        <p>${step.description}</p>
                        ${step.url ? `<a href="${step.url}" target="_blank" class="setup-link">Open ${step.url.includes('chrome://') ? 'Chrome Settings' : 'Link'} →</a>` : ''}
                    </li>
                `).join('')}
            </ol>
        </div>
        
        <div class="troubleshooting">
            <h4>Troubleshooting:</h4>
            <ul>
                ${instructions.troubleshooting.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
        </div>
        
        <div class="setup-actions">
            <button class="retry-btn" id="recheckAIStatusBtn">🔄 Check AI Status Again</button>
            <button class="hide-btn" id="hideSetupBtn">Hide Instructions</button>
        </div>
    `;
    
    setupSection.style.display = 'block';
    
    // Event listeners handled by delegation
}

function hideAISetupInstructions() {
    const setupSection = document.getElementById('aiSetupInstructions');
    if (setupSection) {
        setupSection.style.display = 'none';
    }
}


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

// Profile Editing Functions

let originalProfile = null;
let editingProfile = null;

function enableProfileEditing() {
    console.log('Enabling profile editing mode');
    
    // Store original profile for restoration
    const profileDiv = document.querySelector('.style-profile');
    if (!profileDiv) return;
    
    // Get current profile from storage
    chrome.storage.local.get(['styleProfile']).then(result => {
        if (result.styleProfile) {
            originalProfile = JSON.parse(JSON.stringify(result.styleProfile));
            editingProfile = JSON.parse(JSON.stringify(result.styleProfile));
            
            // Add edit mode styling
            profileDiv.classList.add('edit-mode');
            
            // Show edit controls
            document.getElementById('editProfileBtn').style.display = 'none';
            document.getElementById('saveProfileBtn').style.display = 'inline-block';
            document.getElementById('cancelEditBtn').style.display = 'inline-block';
            
            // Make tags editable
            makeTagsEditable();
            
            showNotification('Edit mode enabled! Click on tags to modify them.', 'info');
        }
    });
}

function makeTagsEditable() {
    // Make color tags editable (both best and avoid)
    const colorTags = document.querySelectorAll('.color-tag');
    colorTags.forEach(tag => makeTagEditable(tag, 'color'));
    
    // Make pattern tags editable (both recommended and avoid)
    const patternTags = document.querySelectorAll('.pattern-tag');
    patternTags.forEach(tag => makeTagEditable(tag, 'pattern'));
    
    // Make fit tags editable
    const fitTags = document.querySelectorAll('.fit-tag');
    fitTags.forEach(tag => makeTagEditable(tag, 'fit'));
    
    // Make brand tags editable
    const brandTags = document.querySelectorAll('.brand-tag');
    brandTags.forEach(tag => makeTagEditable(tag, 'brand'));
    
    // Make aesthetic tags editable
    const aestheticTags = document.querySelectorAll('.aesthetic-tag');
    aestheticTags.forEach(tag => makeTagEditable(tag, 'aesthetic'));
}

function makeTagEditable(tag, category) {
    tag.classList.add('editable-tag');
    tag.title = 'Click to edit';
    
    tag.addEventListener('click', function() {
        if (tag.classList.contains('editing')) return;
        
        const originalText = tag.textContent;
        tag.classList.add('editing');
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalText;
        input.className = 'tag-input';
        
        tag.textContent = '';
        tag.appendChild(input);
        input.focus();
        input.select();
        
        function finishEdit(save = true) {
            if (save && input.value.trim()) {
                tag.textContent = input.value.trim();
                updateEditingProfile(category, originalText, input.value.trim());
            } else {
                tag.textContent = originalText;
            }
            tag.classList.remove('editing');
        }
        
        input.addEventListener('blur', () => finishEdit());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishEdit();
            if (e.key === 'Escape') finishEdit(false);
        });
    });
}

function updateEditingProfile(category, oldValue, newValue) {
    if (!editingProfile) return;
    
    // Update the appropriate section of the editing profile
    switch (category) {
        case 'color':
            // Check best colors first
            const bestColorIndex = editingProfile.color_palette.best_colors.indexOf(oldValue);
            if (bestColorIndex !== -1) {
                editingProfile.color_palette.best_colors[bestColorIndex] = newValue;
            } else {
                // Check avoid colors
                const avoidColorIndex = editingProfile.color_palette.avoid_colors?.indexOf(oldValue);
                if (avoidColorIndex !== -1) {
                    editingProfile.color_palette.avoid_colors[avoidColorIndex] = newValue;
                }
            }
            break;
        case 'pattern':
            // Check recommended patterns first
            const recommendedIndex = editingProfile.pattern_preferences.recommended_patterns.indexOf(oldValue);
            if (recommendedIndex !== -1) {
                editingProfile.pattern_preferences.recommended_patterns[recommendedIndex] = newValue;
            } else {
                // Check avoid patterns
                const avoidIndex = editingProfile.pattern_preferences.avoid_patterns?.indexOf(oldValue);
                if (avoidIndex !== -1) {
                    editingProfile.pattern_preferences.avoid_patterns[avoidIndex] = newValue;
                }
            }
            break;
        case 'fit':
            let fitArray = editingProfile.body_type_analysis.fits || editingProfile.body_type_analysis.silhouettes;
            const fitIndex = fitArray.indexOf(oldValue);
            if (fitIndex !== -1) {
                fitArray[fitIndex] = newValue;
            }
            break;
        case 'brand':
            const brandIndex = editingProfile.shopping_recommendations.brands_to_consider.indexOf(oldValue);
            if (brandIndex !== -1) {
                editingProfile.shopping_recommendations.brands_to_consider[brandIndex] = newValue;
            }
            break;
        case 'aesthetic':
            const aestheticIndex = editingProfile.overall_aesthetic.keywords.indexOf(oldValue);
            if (aestheticIndex !== -1) {
                editingProfile.overall_aesthetic.keywords[aestheticIndex] = newValue;
            }
            break;
    }
    
    console.log('Updated editing profile:', category, oldValue, '->', newValue);
}

async function saveProfileEdits() {
    console.log('Saving profile edits');
    
    if (!editingProfile) {
        showNotification('No changes to save', 'warning');
        return;
    }
    
    try {
        // Update metadata
        editingProfile.edited_at = Date.now();
        editingProfile.version = (parseFloat(editingProfile.version) + 0.1).toFixed(1);
        
        // Save to storage
        await chrome.storage.local.set({ styleProfile: editingProfile });
        
        // Exit edit mode
        const profileDiv = document.querySelector('.style-profile');
        if (profileDiv) {
            profileDiv.classList.remove('edit-mode');
        }
        
        // Update controls
        document.getElementById('editProfileBtn').style.display = 'inline-block';
        document.getElementById('saveProfileBtn').style.display = 'none';
        document.getElementById('cancelEditBtn').style.display = 'none';
        
        // Remove editable classes
        const editableTags = document.querySelectorAll('.editable-tag');
        editableTags.forEach(tag => {
            tag.classList.remove('editable-tag');
            tag.removeAttribute('title');
        });
        
        originalProfile = null;
        editingProfile = null;
        
        showNotification('Profile changes saved successfully!', 'success');
        
    } catch (error) {
        console.error('Failed to save profile edits:', error);
        showNotification('Failed to save changes: ' + error.message, 'error');
    }
}

function cancelProfileEditing() {
    console.log('Cancelling profile editing');
    
    // Exit edit mode
    const profileDiv = document.querySelector('.style-profile');
    if (profileDiv) {
        profileDiv.classList.remove('edit-mode');
    }
    
    // Update controls
    document.getElementById('editProfileBtn').style.display = 'inline-block';
    document.getElementById('saveProfileBtn').style.display = 'none';
    document.getElementById('cancelEditBtn').style.display = 'none';
    
    // Remove editable classes and restore original text
    const editableTags = document.querySelectorAll('.editable-tag');
    editableTags.forEach(tag => {
        tag.classList.remove('editable-tag', 'editing');
        tag.removeAttribute('title');
    });
    
    // If there were any unsaved changes, redisplay the original profile
    if (originalProfile) {
        displayStyleProfile(originalProfile);
    }
    
    originalProfile = null;
    editingProfile = null;
    
    showNotification('Edit mode cancelled', 'info');
}

// Photo deletion now handled by event listeners

// ========================================

// Navigation Functions for Onboarding

function setupNavigationListeners() {
    // Choose Upload Path
    document.getElementById('chooseUploadBtn')?.addEventListener('click', () => {
        showSection('mainContent');
    });
    
    // Choose Wardrobe Path
    document.getElementById('chooseWardrobeBtn')?.addEventListener('click', () => {
        showSection('wardrobeSection');
    });
    
    // Back buttons
    document.getElementById('backToOptionsBtn')?.addEventListener('click', () => {
        showSection('gettingStarted');
    });
    
    document.getElementById('backFromWardrobeBtn')?.addEventListener('click', () => {
        showSection('gettingStarted');
    });
    
    document.getElementById('backFromSettingsBtn')?.addEventListener('click', () => {
        showSection('gettingStarted');
    });
}

function showSection(sectionName) {
    // Hide all sections
    const gettingStarted = document.querySelector('.getting-started-section');
    const mainContent = document.getElementById('mainContent');
    const wardrobeSection = document.getElementById('wardrobeSection');
    const settingsSection = document.getElementById('settingsSection');
    
    // Hide everything first
    if (gettingStarted) gettingStarted.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (wardrobeSection) wardrobeSection.style.display = 'none';
    if (settingsSection) settingsSection.style.display = 'none';
    
    // Show requested section
    switch(sectionName) {
        case 'gettingStarted':
            if (gettingStarted) gettingStarted.style.display = 'block';
            break;
        case 'mainContent':
            if (mainContent) mainContent.style.display = 'flex';
            break;
        case 'wardrobeSection':
            if (wardrobeSection) wardrobeSection.style.display = 'block';
            break;
        case 'settingsSection':
            if (settingsSection) settingsSection.style.display = 'block';
            break;
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function checkInitialWardrobeStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });
        
        // If user is already logged in, show wardrobe section with data
        if (response.authenticated && response.user) {
            console.log('User already logged in, showing wardrobe section');
            showSection('wardrobeSection');
        }
    } catch (error) {
        console.log('No existing login found, showing onboarding');
        // User not logged in, stay on onboarding
    }
}

// ========================================

// Gemini API Virtual Try-On functions have been moved to gemini/gemini-ui.js
