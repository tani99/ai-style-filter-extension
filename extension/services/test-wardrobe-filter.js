// test-wardrobe-filter.js
// Wardrobe filtering test logic

let wardrobeItems = [];
let currentUser = null;

// Check authentication on load
async function checkAuth() {
    const authSection = document.getElementById('auth-section');

    try {
        const response = await chrome.runtime.sendMessage({ action: 'getAuthStatus' });

        if (response.authenticated && response.user) {
            currentUser = response.user;
            authSection.innerHTML = `
                <h2>✅ Authenticated</h2>
                <div class="auth-info">
                    <p><strong>Email:</strong> ${response.user.email}</p>
                    <p><strong>Display Name:</strong> ${response.user.displayName || 'N/A'}</p>
                </div>
            `;

            // Load wardrobe
            await loadWardrobe();

            // Show controls
            document.getElementById('controls').style.display = 'block';
            authSection.style.display = 'none';
        } else {
            authSection.innerHTML = `
                <h2>❌ Not Authenticated</h2>
                <div class="error">
                    <p>Please log in to the extension first before running this test.</p>
                    <p>Go to the extension popup or tab page to authenticate.</p>
                </div>
            `;
        }
    } catch (error) {
        authSection.innerHTML = `
            <h2>❌ Error</h2>
            <div class="error">
                <p>Failed to check authentication: ${error.message}</p>
            </div>
        `;
    }
}

// Load wardrobe items
async function loadWardrobe() {
    const loadingEl = document.getElementById('loading');
    loadingEl.style.display = 'block';

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'getWardrobeItems',
            filters: {}
        });

        if (response.success && response.items) {
            wardrobeItems = response.items;

            // Count analyzed items
            const analyzedCount = wardrobeItems.filter(item => item.aiAnalysis).length;

            // Update stats
            document.getElementById('itemCount').textContent = wardrobeItems.length;
            document.getElementById('analyzedCount').textContent = analyzedCount;

            if (wardrobeItems.length === 0) {
                document.getElementById('results').innerHTML = `
                    <div class="error">
                        <h3>No Wardrobe Items Found</h3>
                        <p>Your wardrobe is empty. Add some items first to test the filtering.</p>
                    </div>
                `;
                document.getElementById('results').style.display = 'block';
            } else if (analyzedCount < wardrobeItems.length) {
                document.getElementById('results').innerHTML = `
                    <div class="error">
                        <h3>⚠️ Not All Items Analyzed</h3>
                        <p>${analyzedCount} out of ${wardrobeItems.length} items have AI analysis.</p>
                        <p>Please wait for background analysis to complete, or trigger it manually.</p>
                    </div>
                `;
                document.getElementById('results').style.display = 'block';
            } else {
                document.getElementById('results').innerHTML = `
                    <div class="success">
                        <h3>✅ Wardrobe Loaded Successfully</h3>
                        <p>${wardrobeItems.length} items ready for testing!</p>
                        <p>Click "Run Full Wardrobe Filter Test" to test each item against all others.</p>
                    </div>
                `;
                document.getElementById('results').style.display = 'block';
            }
        } else {
            throw new Error(response.error || 'Failed to load wardrobe items');
        }
    } catch (error) {
        document.getElementById('results').innerHTML = `
            <div class="error">
                <h3>Error Loading Wardrobe</h3>
                <p>${error.message}</p>
            </div>
        `;
        document.getElementById('results').style.display = 'block';
    } finally {
        loadingEl.style.display = 'none';
    }
}

// Run full test
async function runFullTest() {
    const resultsEl = document.getElementById('results');
    const loadingEl = document.getElementById('loading');
    const runBtn = document.getElementById('runTestBtn');

    // Filter only analyzed items
    const analyzedItems = wardrobeItems.filter(item => item.aiAnalysis);

    if (analyzedItems.length === 0) {
        resultsEl.innerHTML = `
            <div class="error">
                <h3>No Items Available for Testing</h3>
                <p>No wardrobe items have AI analysis yet.</p>
            </div>
        `;
        resultsEl.style.display = 'block';
        return;
    }

    // Disable button and show loading
    runBtn.disabled = true;
    loadingEl.style.display = 'block';
    resultsEl.innerHTML = '';
    resultsEl.style.display = 'none';

    let testResults = [];
    let completedTests = 0;

    try {
        // Test each item as the "product" against all other items
        for (let i = 0; i < analyzedItems.length; i++) {
            const testProduct = analyzedItems[i];

            console.log(`\n🧪 Testing item ${i + 1}/${analyzedItems.length}: ${testProduct.id}`);
            console.log(`   Category: ${testProduct.aiAnalysis.category}`);

            try {
                // Call the filter function
                const filterResult = await chrome.runtime.sendMessage({
                    action: 'filterWardrobeItems',
                    product: testProduct.aiAnalysis,
                    wardrobeItems: analyzedItems.map((item, idx) => ({
                        ...item.aiAnalysis,
                        originalIndex: idx,
                        id: item.id,
                        imageUrl: item.imageUrl
                    }))
                });

                testResults.push({
                    product: testProduct,
                    filterResult: filterResult,
                    wardrobeItems: analyzedItems
                });

                completedTests++;
                document.getElementById('testCount').textContent = completedTests;

                console.log(`   ✅ Shortlist: ${filterResult.shortlist.length} items`);
                console.log(`   ❌ Eliminated: ${Object.keys(filterResult.eliminated || {}).length} items`);

            } catch (error) {
                console.error(`   ❌ Test failed:`, error);
                testResults.push({
                    product: testProduct,
                    error: error.message
                });
            }
        }

        // Display results
        displayResults(testResults);

    } catch (error) {
        resultsEl.innerHTML = `
            <div class="error">
                <h3>Test Error</h3>
                <p>${error.message}</p>
            </div>
        `;
        resultsEl.style.display = 'block';
    } finally {
        runBtn.disabled = false;
        loadingEl.style.display = 'none';
    }
}

// Display test results
function displayResults(testResults) {
    const resultsEl = document.getElementById('results');
    resultsEl.innerHTML = '<h2 style="padding: 0 0 20px 0; color: #333;">📊 Filter Test Results</h2>';

    testResults.forEach((result, index) => {
        const product = result.product;
        const filterResult = result.filterResult;
        const wardrobeItems = result.wardrobeItems;

        let html = `
            <div class="test-item">
                <div class="item-header">
                    <img src="${product.imageUrl}" class="item-image" alt="${product.category}">
                    <div class="item-details">
                        <h3>Test ${index + 1}: ${product.category || 'Unknown'}</h3>
                        <div class="item-attributes">
                            <span class="attribute-tag category">${product.aiAnalysis.category || 'N/A'}</span>
                            <span class="attribute-tag">Colors: ${JSON.stringify(product.aiAnalysis.colors)}</span>
                            <span class="attribute-tag">Style: ${product.aiAnalysis.style ? product.aiAnalysis.style.join(', ') : 'N/A'}</span>
                            <span class="attribute-tag">Pattern: ${product.aiAnalysis.pattern || 'N/A'}</span>
                            <span class="attribute-tag">Formality: ${product.aiAnalysis.formality || 'N/A'}</span>
                        </div>
                    </div>
                </div>
        `;

        if (result.error) {
            html += `
                <div class="error">
                    <strong>Error:</strong> ${result.error}
                </div>
            `;
        } else {
            const shortlistItems = filterResult.shortlist.map(idx => wardrobeItems[idx]);

            html += `
                <div class="filter-results">
                    <h4>
                        ✅ Shortlisted Items
                        <span style="background: #0ea5e9; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px;">
                            ${filterResult.shortlist.length}
                        </span>
                    </h4>
                    <div class="shortlist-grid">
            `;

            shortlistItems.forEach(item => {
                html += `
                    <div class="shortlist-item">
                        <img src="${item.imageUrl}" alt="${item.category}">
                        <div class="category">${item.aiAnalysis.category || 'N/A'}</div>
                    </div>
                `;
            });

            html += `
                    </div>
            `;

            if (filterResult.eliminated && Object.keys(filterResult.eliminated).length > 0) {
                html += `
                    <div class="eliminated-section">
                        <h5>❌ Eliminated Items (${Object.keys(filterResult.eliminated).length})</h5>
                        <div class="eliminated-list">
                `;

                Object.entries(filterResult.eliminated).forEach(([idx, reason]) => {
                    const item = wardrobeItems[idx];
                    html += `
                        <div class="eliminated-item">
                            <img src="${item.imageUrl}" alt="${item.category}" class="eliminated-item-image">
                            <div class="eliminated-item-details">
                                <div class="category">${item.aiAnalysis.category || 'N/A'}</div>
                                <div class="reason">${reason}</div>
                            </div>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            }

            if (filterResult.reasoning) {
                html += `
                    <div class="reasoning-box">
                        <strong>AI Reasoning:</strong>
                        <p>${filterResult.reasoning}</p>
                    </div>
                `;
            }

            html += `
                </div>
            `;
        }

        html += `
            </div>
        `;

        resultsEl.innerHTML += html;
    });

    resultsEl.style.display = 'block';
}

// Initialize
window.addEventListener('load', () => {
    checkAuth();

    // Add event listeners to buttons
    const runTestBtn = document.getElementById('runTestBtn');
    const loadWardrobeBtn = document.getElementById('loadWardrobeBtn');

    if (runTestBtn) {
        runTestBtn.addEventListener('click', runFullTest);
    }

    if (loadWardrobeBtn) {
        loadWardrobeBtn.addEventListener('click', loadWardrobe);
    }
});
