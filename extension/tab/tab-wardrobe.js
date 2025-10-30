// tab-wardrobe.js
// Handles wardrobe authentication and data display

console.log('👗 Wardrobe module loaded');

// Authentication UI Management
let currentAuthState = null;

// Tab switching
document.getElementById('loginTabBtn')?.addEventListener('click', () => {
  showLoginForm();
});

document.getElementById('signupTabBtn')?.addEventListener('click', () => {
  showSignupForm();
});

function showLoginForm() {
  document.getElementById('loginForm').style.display = 'flex';
  document.getElementById('signupForm').style.display = 'none';
  document.getElementById('loginTabBtn').classList.add('active');
  document.getElementById('signupTabBtn').classList.remove('active');
  clearAuthError();
}

function showSignupForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('signupForm').style.display = 'flex';
  document.getElementById('loginTabBtn').classList.remove('active');
  document.getElementById('signupTabBtn').classList.add('active');
  clearAuthError();
}

// Login handler
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAuthError('Please enter email and password');
    return;
  }

  const loginBtn = document.getElementById('loginBtn');
  const originalText = loginBtn.textContent;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  try {
    console.log('🔐 Sending login request...');
    const response = await chrome.runtime.sendMessage({
      action: 'firebaseLogin',
      email: email,
      password: password
    });

    console.log('Login response:', response);

    if (response.success) {
      console.log('✅ Login successful');
      showConnectedState(response.user);
      await loadWardrobeData();
    } else {
      console.error('❌ Login failed:', response.error);
      showAuthError(response.error);
      loginBtn.disabled = false;
      loginBtn.textContent = originalText;
    }
  } catch (error) {
    console.error('❌ Login error:', error);
    showAuthError('Login failed. Please try again.');
    loginBtn.disabled = false;
    loginBtn.textContent = originalText;
  }
});

// Sign up handler
document.getElementById('signupBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  if (!email || !password) {
    showAuthError('Please enter email and password');
    return;
  }

  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }

  const signupBtn = document.getElementById('signupBtn');
  const originalText = signupBtn.textContent;
  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating account...';

  try {
    console.log('📝 Sending sign up request...');
    const response = await chrome.runtime.sendMessage({
      action: 'firebaseSignUp',
      email: email,
      password: password,
      displayName: name
    });

    console.log('Sign up response:', response);

    if (response.success) {
      console.log('✅ Sign up successful');
      showConnectedState(response.user);
      await loadWardrobeData();
    } else {
      console.error('❌ Sign up failed:', response.error);
      showAuthError(response.error);
      signupBtn.disabled = false;
      signupBtn.textContent = originalText;
    }
  } catch (error) {
    console.error('❌ Sign up error:', error);
    showAuthError('Sign up failed. Please try again.');
    signupBtn.disabled = false;
    signupBtn.textContent = originalText;
  }
});

// Logout handler
document.getElementById('wardrobeLogoutBtn')?.addEventListener('click', async () => {
  try {
    console.log('🚪 Logging out...');
    await chrome.runtime.sendMessage({ action: 'firebaseLogout' });
    showLoginState();
  } catch (error) {
    console.error('❌ Logout failed:', error);
  }
});

// Check authentication status on load
async function checkAuthStatus() {
  try {
    console.log('🔍 Checking auth status...');
    const response = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });
    console.log('Auth status:', response);

    if (response.authenticated && response.user) {
      console.log('✅ User is authenticated');
      showConnectedState(response.user);
      await loadWardrobeData();
    } else {
      console.log('ℹ️ User is not authenticated');
      showLoginState();
    }
  } catch (error) {
    console.error('❌ Failed to check auth status:', error);
    showLoginState();
  }
}

function showLoginState() {
  document.getElementById('wardrobeLogin').style.display = 'block';
  document.getElementById('wardrobeConnected').style.display = 'none';
}

function showConnectedState(user) {
  document.getElementById('wardrobeLogin').style.display = 'none';
  document.getElementById('wardrobeConnected').style.display = 'block';

  document.getElementById('connectedUserName').textContent = user.displayName || 'User';
  document.getElementById('connectedUserEmail').textContent = user.email;
}

function showAuthError(message) {
  const errorEl = document.getElementById('authError');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function clearAuthError() {
  const errorEl = document.getElementById('authError');
  errorEl.style.display = 'none';
}

async function loadWardrobeData() {
  try {
    console.log('📦 Loading wardrobe data...');

    // Get cached data first for instant display
    const cachedResponse = await chrome.runtime.sendMessage({
      action: 'getCachedWardrobe'
    });

    console.log('Cached wardrobe data:', cachedResponse);

    if (cachedResponse.success) {
      const itemCount = cachedResponse.data.items.length;
      const lookCount = cachedResponse.data.looks.length;
      
      console.log(`📊 Wardrobe contains: ${itemCount} items, ${lookCount} looks`);
      
      updateWardrobeStats(cachedResponse.data);
      displayCategoryItems(cachedResponse.data.items);

      // Show helpful message if no data
      if (itemCount === 0 && lookCount === 0) {
        console.log('ℹ️ No wardrobe data found. This is normal if you just created your account.');
      }
    }
  } catch (error) {
    console.error('❌ Failed to load wardrobe data:', error);
  }
}

function updateWardrobeStats(data) {
  document.getElementById('itemCount').textContent = data.items.length;
  document.getElementById('lookCount').textContent = data.looks.length;
}

 

function displayCategoryItems(items) {
  const topsGrid = document.getElementById('topsGrid');
  const bottomsGrid = document.getElementById('bottomsGrid');
  const shoesGrid = document.getElementById('shoesGrid');

  if (!topsGrid || !bottomsGrid || !shoesGrid) return;

  const normalizeCategory = (item) => {
    const raw = (item.category || item.type || item.category_name || '').toString().toLowerCase();
    if (!raw) return 'other';
    if (/(^|\b)(top|shirt|tee|t\-?shirt|blouse|sweater|hoodie|jacket|coat|cardigan)s?(\b|$)/.test(raw)) return 'tops';
    if (/(^|\b)(bottom|pant|trouser|jean|short|skirt|legging)s?(\b|$)/.test(raw)) return 'bottoms';
    if (/(^|\b)(shoe|sneaker|boot|heel|flat|sandal|loafer)s?(\b|$)/.test(raw)) return 'shoes';
    return 'other';
  };

  const toCard = (item) => {
    const hasAnalysis = item.aiAnalysis && typeof item.aiAnalysis === 'object';
    return `
      <div class="wardrobe-item-card">
        <img src="${item.thumbnailUrl || item.imageUrl || ''}" alt="${item.name || ''}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23e5e7eb%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 fill=%22%236b7280%22 font-size=%2212%22 text-anchor=%22middle%22 dy=%22.3em%22>No Image</text></svg>'">
        ${hasAnalysis ? `
          <details class="item-analysis">
            <summary class="analysis-header">🤖 AI Analysis</summary>
            <div class="analysis-details">
              ${item.aiAnalysis.colors && typeof item.aiAnalysis.colors === 'object' ? `
                <div class="analysis-row">
                  <strong>Colors:</strong>
                  <span class="analysis-value">
                    ${item.aiAnalysis.colors.primary || 'unknown'}
                    ${item.aiAnalysis.colors.secondary ? `, ${item.aiAnalysis.colors.secondary}` : ''}
                    ${item.aiAnalysis.colors.tertiary ? `, ${item.aiAnalysis.colors.tertiary}` : ''}
                  </span>
                </div>
              ` : ''}
              ${item.aiAnalysis.style && item.aiAnalysis.style.length > 0 ? `
                <div class="analysis-row">
                  <strong>Style:</strong>
                  <span class="analysis-value">${item.aiAnalysis.style.join(', ')}</span>
                </div>
              ` : ''}
              ${item.aiAnalysis.pattern ? `
                <div class="analysis-row">
                  <strong>Pattern:</strong>
                  <span class="analysis-value">${item.aiAnalysis.pattern}</span>
                </div>
              ` : ''}
              ${item.aiAnalysis.formality ? `
                <div class="analysis-row">
                  <strong>Formality:</strong>
                  <span class="analysis-value">${item.aiAnalysis.formality}</span>
                </div>
              ` : ''}
              ${item.aiAnalysis.season && item.aiAnalysis.season.length > 0 ? `
                <div class="analysis-row">
                  <strong>Season:</strong>
                  <span class="analysis-value">${item.aiAnalysis.season.join(', ')}</span>
                </div>
              ` : ''}
              ${item.aiAnalysis.versatility_score !== undefined ? `
                <div class="analysis-row">
                  <strong>Versatility:</strong>
                  <span class="analysis-value">${item.aiAnalysis.versatility_score}/10</span>
                </div>
              ` : ''}
              ${item.aiAnalysis.description ? `
                <div class="analysis-row description">
                  <p>${item.aiAnalysis.description}</p>
                </div>
              ` : ''}
            </div>
          </details>
        ` : `
          <div class="item-analysis no-analysis">
            <span class="analysis-pending">⏳ Analysis pending...</span>
          </div>
        `}
      </div>
    `;
  };

  const tops = [];
  const bottoms = [];
  const shoes = [];

  (items || []).forEach(item => {
    const cat = normalizeCategory(item);
    if (cat === 'tops') tops.push(item);
    else if (cat === 'bottoms') bottoms.push(item);
    else if (cat === 'shoes') shoes.push(item);
  });

  topsGrid.innerHTML = tops.length ? tops.map(toCard).join('') : '<p style="text-align: center; color: #6b7280;">No tops yet</p>';
  bottomsGrid.innerHTML = bottoms.length ? bottoms.map(toCard).join('') : '<p style="text-align: center; color: #6b7280;">No bottoms yet</p>';
  shoesGrid.innerHTML = shoes.length ? shoes.map(toCard).join('') : '<p style="text-align: center; color: #6b7280;">No shoes yet</p>';
}

// Listen for real-time wardrobe updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'wardrobeDataUpdated') {
    console.log('🔄 Wardrobe data updated:', message.type, `(${message.count} items)`);
    loadWardrobeData();
  }
});

// Firebase Connection Test
document.getElementById('testFirebaseBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('testFirebaseBtn');
  const resultDiv = document.getElementById('firebaseTestResult');

  btn.disabled = true;
  btn.textContent = 'Testing...';
  resultDiv.style.display = 'block';
  resultDiv.classList.remove('error');
  resultDiv.innerHTML = 'Testing Firebase connection...';

  try {
    const response = await chrome.runtime.sendMessage({ action: 'testFirebaseConnection' });

    if (response.success) {
      resultDiv.innerHTML = `
        <strong>✅ Firebase Connected</strong>
        <pre>${JSON.stringify(response, null, 2)}</pre>
      `;
    } else {
      resultDiv.classList.add('error');
      resultDiv.innerHTML = `
        <strong>❌ Firebase Connection Failed</strong>
        <pre>${JSON.stringify(response, null, 2)}</pre>
      `;
    }
  } catch (error) {
    resultDiv.classList.add('error');
    resultDiv.innerHTML = `<strong>❌ Error:</strong> ${error.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test Firebase Connection';
  }
});

// Query Wardrobe Stats Button
document.getElementById('queryWardrobeBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('queryWardrobeBtn');
  const resultDiv = document.getElementById('wardrobeQueryResult');

  btn.disabled = true;
  btn.textContent = 'Querying...';
  resultDiv.style.display = 'block';
  resultDiv.classList.remove('error');
  resultDiv.innerHTML = '📊 Querying Firestore for items and looks...';

  try {
    console.log('🔍 Querying wardrobe stats...');

    // Get auth status first
    const authResponse = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });
    console.log('Auth status:', authResponse);

    if (!authResponse.authenticated) {
      throw new Error('Not authenticated. Please log in first.');
    }

    // Query items directly
    const itemsResponse = await chrome.runtime.sendMessage({ 
      action: 'getWardrobeItems',
      filters: {}
    });
    console.log('Items response:', itemsResponse);

    // Query looks directly
    const looksResponse = await chrome.runtime.sendMessage({ 
      action: 'getLooks'
    });
    console.log('Looks response:', looksResponse);

    // Get cached data
    const cachedResponse = await chrome.runtime.sendMessage({
      action: 'getCachedWardrobe'
    });
    console.log('Cached data:', cachedResponse);

    // Display results
    const itemCount = itemsResponse.success ? itemsResponse.items.length : 0;
    const lookCount = looksResponse.success ? looksResponse.looks.length : 0;
    const cachedItemCount = cachedResponse.success ? cachedResponse.data.items.length : 0;
    const cachedLookCount = cachedResponse.success ? cachedResponse.data.looks.length : 0;

    resultDiv.innerHTML = `
      <div style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #10b981;">
        <h4 style="margin-top: 0; color: #10b981;">✅ Wardrobe Data Retrieved</h4>
        
        <div style="margin: 15px 0; padding: 10px; background: #f3f4f6; border-radius: 6px;">
          <strong>📦 Direct Query Results:</strong>
          <div style="margin-top: 8px;">
            <div style="font-size: 24px; font-weight: bold; color: #667eea;">
              ${itemCount} Items
            </div>
            <div style="font-size: 24px; font-weight: bold; color: #667eea; margin-top: 5px;">
              ${lookCount} Looks
            </div>
          </div>
        </div>

        <div style="margin: 15px 0; padding: 10px; background: #f3f4f6; border-radius: 6px;">
          <strong>💾 Cached Data:</strong>
          <div style="margin-top: 8px;">
            <div style="font-size: 18px; color: #6b7280;">
              ${cachedItemCount} Items (cached)
            </div>
            <div style="font-size: 18px; color: #6b7280; margin-top: 5px;">
              ${cachedLookCount} Looks (cached)
            </div>
          </div>
        </div>

        <details style="margin-top: 15px;">
          <summary style="cursor: pointer; color: #667eea; font-weight: 500;">Show Full Response</summary>
          <pre style="margin-top: 10px; padding: 10px; background: #1f2937; color: #10b981; border-radius: 4px; overflow: auto; max-height: 300px; font-size: 11px;">${JSON.stringify({
            auth: authResponse,
            items: itemsResponse,
            looks: looksResponse,
            cached: cachedResponse
          }, null, 2)}</pre>
        </details>
      </div>
    `;

    // Update the stats cards too
    updateWardrobeStats({ items: itemsResponse.items || [], looks: looksResponse.looks || [] });

  } catch (error) {
    console.error('❌ Query failed:', error);
    resultDiv.classList.add('error');
    resultDiv.innerHTML = `
      <div style="background: #fee; padding: 15px; border-radius: 8px; border: 2px solid #ef4444;">
        <strong style="color: #ef4444;">❌ Query Failed</strong>
        <p style="margin: 10px 0 0 0; color: #991b1b;">${error.message}</p>
      </div>
    `;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Query Wardrobe Data';
  }
});

// ========================================
// WARDROBE PATH: Photo Upload & Style Profile
// (Same functionality as main upload path)
// ========================================

// Photo upload event listeners
const wardrobeUploadArea = document.getElementById('wardrobeUploadArea');
const wardrobePhotoInput = document.getElementById('wardrobePhotoInput');
const wardrobeAnalyzeBtn = document.getElementById('wardrobeAnalyzeBtn');
const wardrobeClearAllBtn = document.getElementById('wardrobeClearAllBtn');
const wardrobeClearProfileBtn = document.getElementById('wardrobeClearProfileBtn');

if (wardrobeUploadArea && wardrobePhotoInput) {
  wardrobeUploadArea.addEventListener('click', () => {
    wardrobePhotoInput.click();
  });
  
  wardrobePhotoInput.addEventListener('change', handleWardrobeFileSelect);
  
  wardrobeUploadArea.addEventListener('dragover', handleWardrobeDragOver);
  wardrobeUploadArea.addEventListener('dragleave', handleWardrobeDragLeave);
  wardrobeUploadArea.addEventListener('drop', handleWardrobeDrop);
}

if (wardrobeAnalyzeBtn) {
  wardrobeAnalyzeBtn.addEventListener('click', analyzeWardrobeStyle);
}

if (wardrobeClearAllBtn) {
  wardrobeClearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all photos? This cannot be undone.')) {
      clearAllWardrobePhotos();
    }
  });
}

if (wardrobeClearProfileBtn) {
  wardrobeClearProfileBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your style profile? This cannot be undone.')) {
      clearWardrobeStyleProfile();
    }
  });
}

function handleWardrobeFileSelect(event) {
  const files = Array.from(event.target.files);
  processWardrobeFiles(files);
}

function handleWardrobeDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('dragover');
}

function handleWardrobeDragLeave(event) {
  event.currentTarget.classList.remove('dragover');
}

function handleWardrobeDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('dragover');
  
  const files = Array.from(event.dataTransfer.files);
  processWardrobeFiles(files.filter(file => file.type.startsWith('image/')));
}

async function processWardrobeFiles(files) {
  const existingPhotos = await getWardrobeStoredPhotos();
  const maxPhotos = 5;
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  // Check total photo limit
  if (existingPhotos.length + files.length > maxPhotos) {
    console.warn(`Maximum ${maxPhotos} photos allowed. You can upload ${maxPhotos - existingPhotos.length} more.`);
    return;
  }
  
  let processedCount = 0;
  let errorCount = 0;
  
  for (const file of files) {
    // Validate file type
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      console.warn(`${file.name} is not supported. Please use JPG, PNG, or WebP format.`);
      errorCount++;
      continue;
    }
    
    // If file is large, compress like non-logged in flow
    if (file.size > maxSize) {
      try {
        const compressedDataUrl = await compressImage(file, maxSize);
        await addWardrobePhoto(compressedDataUrl, file.name);
        processedCount++;
      } catch (error) {
        console.error(`Failed to compress ${file.name}:`, error);
        errorCount++;
      }
      continue;
    }
    
    // Process valid file as-is
    await addWardrobePhoto(file);
    processedCount++;
  }
  
  if (processedCount > 0) {
    console.log(`✅ Successfully processed ${processedCount} photo${processedCount > 1 ? 's' : ''}!`);
  }
  
  updateWardrobeAnalyzeButton();
}

async function addWardrobePhoto(fileOrDataUrl, originalName = null) {
  return new Promise((resolve) => {
    // Support data URL input (from compression) similar to non-logged-in flow
    if (typeof fileOrDataUrl === 'string') {
      const photoData = {
        id: Date.now() + Math.random(),
        name: originalName || 'compressed_image.jpg',
        data: fileOrDataUrl,
        timestamp: Date.now()
      };
      saveWardrobePhoto(photoData).then(() => {
        displayWardrobePhoto(photoData);
        resolve();
      });
      return;
    }

    // Otherwise treat as File and read as DataURL
    const reader = new FileReader();
    reader.onload = async (e) => {
      const photoData = {
        id: Date.now() + Math.random(),
        name: fileOrDataUrl.name,
        data: e.target.result,
        timestamp: Date.now()
      };
      
      await saveWardrobePhoto(photoData);
      displayWardrobePhoto(photoData);
      resolve();
    };
    reader.readAsDataURL(fileOrDataUrl);
  });
}

function displayWardrobePhoto(photo) {
  const gallery = document.getElementById('wardrobePhotoGallery');
  if (!gallery) return;
  
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
    removeWardrobePhoto(photo.id);
  });
  
  gallery.appendChild(photoItem);
}

async function removeWardrobePhoto(photoId) {
  // Remove from storage
  const photos = await getWardrobeStoredPhotos();
  const updatedPhotos = photos.filter(p => String(p.id) !== String(photoId));
  await chrome.storage.local.set({ wardrobeUserPhotos: updatedPhotos });
  
  // Remove from display
  const photoElement = document.querySelector(`#wardrobePhotoGallery [data-photo-id="${photoId}"]`);
  if (photoElement) {
    photoElement.remove();
  }
  
  updateWardrobeAnalyzeButton();
}

async function saveWardrobePhoto(photo) {
  const photos = await getWardrobeStoredPhotos();
  photos.push(photo);
  await chrome.storage.local.set({ wardrobeUserPhotos: photos });
}

async function getWardrobeStoredPhotos() {
  const result = await chrome.storage.local.get(['wardrobeUserPhotos']);
  return result.wardrobeUserPhotos || [];
}

async function loadWardrobeSavedPhotos() {
  const photos = await getWardrobeStoredPhotos();
  photos.forEach(photo => displayWardrobePhoto(photo));
  updateWardrobeAnalyzeButton();
}

async function clearAllWardrobePhotos() {
  // Clear from storage
  await chrome.storage.local.set({ wardrobeUserPhotos: [] });
  
  // Clear from display
  const gallery = document.getElementById('wardrobePhotoGallery');
  if (gallery) {
    gallery.innerHTML = '';
  }
  
  // Update UI
  updateWardrobeAnalyzeButton();
  console.log('🗑️ All wardrobe photos cleared!');
}

async function updateWardrobeAnalyzeButton() {
  const photos = await getWardrobeStoredPhotos();
  const analyzeBtn = document.getElementById('wardrobeAnalyzeBtn');
  const clearAllBtn = document.getElementById('wardrobeClearAllBtn');
  const clearProfileBtn = document.getElementById('wardrobeClearProfileBtn');
  
  // Check if style profile already exists
  const result = await chrome.storage.local.get(['wardrobeStyleProfile']);
  const hasExistingProfile = !!result.wardrobeStyleProfile;
  
  // Check if elements exist before modifying them
  if (analyzeBtn) {
    analyzeBtn.disabled = photos.length === 0;
    
    if (photos.length > 0) {
      if (hasExistingProfile) {
        analyzeBtn.textContent = `Re-analyze My Style (${photos.length} photos)`;
      } else {
        analyzeBtn.textContent = `Analyze My Style (${photos.length} photos)`;
      }
    } else {
      analyzeBtn.textContent = hasExistingProfile ? 'Re-analyze My Style' : 'Analyze My Style';
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

async function loadWardrobeSavedStyleProfile() {
  try {
    const result = await chrome.storage.local.get(['wardrobeStyleProfile']);
    if (result.wardrobeStyleProfile) {
      console.log('Loading saved wardrobe style profile:', result.wardrobeStyleProfile);
      displayWardrobeStyleProfile(result.wardrobeStyleProfile);
    }
  } catch (error) {
    console.error('Failed to load saved wardrobe style profile:', error);
  }
}

async function analyzeWardrobeStyle() {
  const analyzeBtn = document.getElementById('wardrobeAnalyzeBtn');
  const analysisContent = document.getElementById('wardrobeAnalysisContent');
  
  if (!analyzeBtn || !analysisContent) {
    console.error('Required DOM elements not found for wardrobe style analysis');
    return;
  }
  
  // Update button state
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';
  
  // Show loading state with realistic time estimate
  analysisContent.innerHTML = `
    <div class="analysis-loading">
      <div class="loading-spinner"></div>
      <h3>Analyzing Your Style...</h3>
      <p>AI is examining your photos to create your personalized style profile. This may take up to 10 minutes — please stay on this page.</p>
      <p style="font-size: 0.9em; color: #667eea; margin-top: 8px;">⏱️ This may take up to 10 minutes</p>
      <div class="loading-steps">
        <div class="step active">📸 Compressing photos for AI analysis</div>
        <div class="step">🎨 Analyzing colors & patterns</div>
        <div class="step">👗 Determining style preferences</div>
        <div class="step">✨ Creating your profile</div>
      </div>
    </div>
  `;
  
  try {
    const photos = await getWardrobeStoredPhotos();
    
    if (photos.length === 0) {
      throw new Error('No photos available for analysis');
    }
    
    console.log(`Starting wardrobe style analysis for ${photos.length} photos`);
    
    // Perform AI-powered style analysis
    const analysisResult = await performMultiPhotoStyleAnalysis(photos);
    
    if (analysisResult.success) {
      // Display the analysis results
      displayWardrobeStyleProfile(analysisResult.profile);
      console.log(`✅ Style analysis complete! Generated profile from ${photos.length} photos.`);
      
      // Save the profile
      await chrome.storage.local.set({ wardrobeStyleProfile: analysisResult.profile });
      
    } else {
      throw new Error(analysisResult.error || 'Style analysis failed');
    }
    
  } catch (error) {
    console.error('Wardrobe style analysis failed:', error);
    
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
          <button class="retry-btn" onclick="analyzeWardrobeStyle()">🔄 Try Again</button>
        </div>
      </div>
    `;
  } finally {
    // Reset button
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Re-analyze Style';
    }
  }
}

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
        temperature: 0,
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
  const photoDescriptions = photos.map((photo, index) => 
    `Photo ${index + 1}: ${photo.name} (uploaded ${new Date(photo.timestamp).toLocaleDateString()})`
  ).join('\n');
  
  return `You are an expert fashion stylist and personal style consultant. I have uploaded ${photoCount} photos of myself in different outfits. Please analyze these photos and create a comprehensive personal style profile.

IMPORTANT: Respond with ONLY a valid JSON object in the exact format specified below. Do not include any markdown formatting, explanations, or text outside the JSON.

Based on the photos, analyze and provide:

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

function displayWardrobeStyleProfile(profile) {
  const analysisContent = document.getElementById('wardrobeAnalysisContent');
  
  if (!analysisContent) return;
  
  const isAnimated = !profile.fallback;
  
  analysisContent.innerHTML = `
    <div class="style-profile ${isAnimated ? 'fade-in' : ''}">
      <div class="profile-header">
        <h3>✨ Your Personal Style Profile</h3>
        <p class="analysis-summary">${profile.analysis_summary}</p>
        ${profile.fallback ? '<p class="fallback-note">⚠️ Generated from fallback data - AI parsing incomplete</p>' : ''}
      </div>
      
      <div class="profile-sections">
        <!-- Color Palette Section -->
        <div class="profile-section">
          <h4>🎨 Color Palette</h4>
          <div class="color-section">
            <div class="color-group">
              <strong>Best Colors:</strong>
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
          <h4>👗 Style Categories</h4>
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
          <h4>👤 Fit & Silhouette</h4>
          <div class="body-analysis">
            <div class="fit-group">
              <strong>Recommended Silhouettes:</strong>
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
        <p class="generated-info">Generated on ${new Date(profile.generated_at).toLocaleDateString()} • Version ${profile.version}</p>
        <p class="source-info">📦 Based on ${profile.itemCount || 'your'} wardrobe items</p>
      </div>
    </div>
  `;
}

async function clearWardrobeStyleProfile() {
  // Clear from storage
  await chrome.storage.local.remove(['wardrobeStyleProfile']);
  
  // Reset analysis section to placeholder state
  const analysisContent = document.getElementById('wardrobeAnalysisContent');
  if (analysisContent) {
    analysisContent.innerHTML = `
      <div class="placeholder-state">
        <span class="placeholder-icon">🎨</span>
        <p>Upload photos to generate your AI-powered style profile</p>
        <button id="wardrobeAnalyzeBtn" class="analyze-btn" disabled>
          Analyze My Style
        </button>
      </div>
    `;
    
    // Re-attach analyze button event listener
    const newAnalyzeBtn = document.getElementById('wardrobeAnalyzeBtn');
    if (newAnalyzeBtn) {
      newAnalyzeBtn.addEventListener('click', analyzeWardrobeStyle);
    }
  }
  
  // Update UI
  updateWardrobeAnalyzeButton();
  console.log('🗑️ Wardrobe style profile cleared!');
}

// Helper function to parse AI response (reuse from tab.js)
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
    
    console.log('Successfully parsed wardrobe style profile:', profileData);
    return profileData;
    
  } catch (error) {
    console.error('Failed to parse wardrobe style analysis response:', error);
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
      color_reasoning: "These versatile colors work well for most people",
      avoid_colors: ["Neon colors"]
    },
    style_categories: [
      {
        name: "Classic",
        confidence: "medium",
        description: "Timeless and versatile pieces"
      },
      {
        name: "Casual",
        confidence: "medium", 
        description: "Comfortable everyday wear"
      },
      {
        name: "Modern",
        confidence: "medium",
        description: "Contemporary styling"
      }
    ],
    body_type_analysis: {
      silhouettes: ["Tailored", "Relaxed", "Structured"],
      fits: ["Well-fitted", "Comfortable", "Flattering"],
      recommendations: "Focus on pieces that make you feel confident"
    },
    pattern_preferences: {
      recommended_patterns: ["Solid colors", "Subtle textures", "Classic stripes"],
      pattern_reasoning: "Simple patterns are versatile and timeless",
      avoid_patterns: ["Overly busy prints"]
    },
    overall_aesthetic: {
      keywords: ["Versatile", "Classic", "Confident"],
      description: "A classic and versatile style that can adapt to different occasions",
      style_personality: "Confident and adaptable"
    },
    shopping_recommendations: {
      key_pieces: ["Well-fitted jeans", "Classic blazer", "Quality basics"],
      brands_to_consider: ["Universal brands with good fit"],
      style_tips: ["Focus on fit", "Invest in quality basics", "Choose versatile pieces"]
    },
    generated_at: Date.now(),
    version: '1.0',
    fallback: true,
    raw_response: rawResponse
  };
}

// Refresh AI Analysis Button Handler
document.getElementById('refreshAnalysisBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('refreshAnalysisBtn');
  const progressDiv = document.getElementById('analysisProgress');
  const progressTitle = document.getElementById('progressTitle');
  const progressMessage = document.getElementById('progressMessage');
  const progressCount = document.getElementById('progressCount');

  // Check if user is logged in
  try {
    const authResponse = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });
    if (!authResponse.authenticated) {
      alert('Please log in first to refresh AI analysis');
      return;
    }

    // Confirm action
    const confirmed = confirm(
      'This will clear all existing AI analysis and re-analyze all wardrobe items.\n\n' +
      'This process may take a few minutes depending on the number of items.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    // Disable button and show progress
    btn.disabled = true;
    btn.textContent = '⏳ Processing...';
    progressDiv.style.display = 'block';
    progressTitle.textContent = 'Refreshing AI Analysis...';
    progressMessage.textContent = 'Clearing existing analysis...';
    progressCount.textContent = '';

    // Step 1: Clear all existing AI analysis
    console.log('🧹 Clearing existing AI analysis...');
    const clearResponse = await chrome.runtime.sendMessage({
      action: 'clearAllAIAnalysis'
    });

    if (!clearResponse.success) {
      throw new Error(clearResponse.error || 'Failed to clear analysis');
    }

    console.log(`✅ Cleared analysis for ${clearResponse.clearedCount} items`);
    progressMessage.textContent = `Cleared ${clearResponse.clearedCount} items. Starting fresh analysis...`;

    // Step 2: Trigger re-analysis
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
    progressMessage.textContent = 'Analyzing all wardrobe items...';

    const analyzeResponse = await chrome.runtime.sendMessage({
      action: 'reanalyzeAllItems'
    });

    if (!analyzeResponse.success) {
      throw new Error(analyzeResponse.error || 'Failed to start analysis');
    }

    console.log(`🔄 Started analysis for ${analyzeResponse.itemCount} items`);

    // Poll for progress
    let analysisComplete = false;
    let pollCount = 0;
    const maxPolls = 120; // 2 minutes max

    while (!analysisComplete && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      pollCount++;

      // Reload wardrobe data to check progress
      const wardrobeResponse = await chrome.runtime.sendMessage({
        action: 'getCachedWardrobe'
      });

      if (wardrobeResponse.success) {
        const items = wardrobeResponse.data.items;
        const analyzedCount = items.filter(item => item.aiAnalysis).length;
        const totalCount = items.length;

        progressCount.textContent = `Progress: ${analyzedCount} / ${totalCount} items analyzed`;

        if (analyzedCount === totalCount) {
          analysisComplete = true;
        }
      }
    }

    if (analysisComplete) {
      progressTitle.textContent = '✅ Analysis Complete!';
      progressMessage.textContent = 'All items have been analyzed successfully.';
      progressCount.textContent = '';

      // Reload the display
      await loadWardrobeData();

      // Hide progress after 3 seconds
      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 3000);
    } else {
      progressTitle.textContent = '⏳ Analysis In Progress';
      progressMessage.textContent = 'Analysis is taking longer than expected. It will continue in the background.';

      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 5000);
    }

  } catch (error) {
    console.error('❌ Refresh analysis failed:', error);
    alert(`Failed to refresh analysis: ${error.message}`);
    progressDiv.style.display = 'none';
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Refresh AI Analysis';
  }
});

// Initialize wardrobe photo upload on page load
loadWardrobeSavedPhotos();
loadWardrobeSavedStyleProfile();

// Initialize on page load
console.log('👗 Initializing wardrobe module...');
checkAuthStatus();
