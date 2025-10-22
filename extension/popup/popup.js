document.addEventListener('DOMContentLoaded', function() {
    const openDashboardBtn = document.getElementById('openDashboard');
    const statusText = document.getElementById('statusText');
    const myStyleToggle = document.getElementById('myStyleToggle');
    const sensitivitySlider = document.getElementById('sensitivitySlider');
    const sensitivityValue = document.getElementById('sensitivityValue');

    // Prompt mode elements
    const promptInput = document.getElementById('promptInput');
    const applyPromptBtn = document.getElementById('applyPromptBtn');
    const clearPromptBtn = document.getElementById('clearPromptBtn');
    const activeModeIndicator = document.getElementById('activeModeIndicator');
    const activeModeText = document.getElementById('activeModeText');
    const recentPromptsSection = document.getElementById('recentPrompts');
    const recentPromptsList = document.getElementById('recentPromptsList');

    // Handle opening the style dashboard
    openDashboardBtn.addEventListener('click', function() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('tab/tab.html')
        });

        // Close popup after opening dashboard
        window.close();
    });

    // Load filter state and prompt state from storage
    loadFilterState();
    loadPromptState();

    // Handle sensitivity slider changes
    sensitivitySlider.addEventListener('input', function() {
        sensitivityValue.textContent = `${sensitivitySlider.value}/10`;
    });

    sensitivitySlider.addEventListener('change', function() {
        const filterState = {
            mode: myStyleToggle.checked ? 'myStyle' : 'all',
            scoreThreshold: parseInt(sensitivitySlider.value)
        };
        saveFilterState(filterState);
        sendFilterStateToContentScript(filterState);
    });

    async function loadFilterState() {
        try {
            const result = await chrome.storage.local.get('filterState');
            if (result.filterState) {
                const state = result.filterState;
                myStyleToggle.checked = state.mode === 'myStyle';
                sensitivitySlider.value = state.scoreThreshold || 6;
                sensitivityValue.textContent = `${sensitivitySlider.value}/10`;
                console.log('Loaded filter state:', state);
            }
        } catch (error) {
            console.error('Error loading filter state:', error);
        }
    }

    async function saveFilterState(filterState) {
        try {
            await chrome.storage.local.set({ filterState });
            console.log('Saved filter state:', filterState);
        } catch (error) {
            console.error('Error saving filter state:', error);
        }
    }

    async function sendFilterStateToContentScript(filterState) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateFilterState',
                    filterState: filterState
                });
                console.log('Sent filter state to content script:', filterState);
            }
        } catch (error) {
            console.error('Error sending filter state:', error);
        }
    }

    // Prompt mode handlers

    // Enable/disable apply button based on input
    promptInput.addEventListener('input', function() {
        const hasInput = promptInput.value.trim().length > 0;
        applyPromptBtn.disabled = !hasInput;
    });

    // Apply prompt button handler
    applyPromptBtn.addEventListener('click', async function() {
        const prompt = promptInput.value.trim();
        if (!prompt) return;

        console.log('[Popup] Applying prompt:', prompt);

        try {
            // Save to storage
            await chrome.storage.local.set({
                userPrompt: prompt,
                rankingMode: 'prompt'
            });

            // Update recent prompts
            await updateRecentPrompts(prompt);

            // Send message to content script to re-analyze
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'applyPrompt',
                    prompt: prompt
                });
            }

            // Update UI
            clearPromptBtn.style.display = 'block';
            myStyleToggle.checked = false;
            updateActiveModeIndicator('prompt', prompt);

            console.log('[Popup] Prompt applied successfully');
            statusText.textContent = 'Products are being re-ranked...';
            setTimeout(() => {
                statusText.textContent = 'Ready to filter your style!';
            }, 3000);

        } catch (error) {
            console.error('[Popup] Error applying prompt:', error);
            statusText.textContent = 'Error applying prompt';
        }
    });

    // Clear prompt button handler
    clearPromptBtn.addEventListener('click', async function() {
        console.log('[Popup] Clearing prompt');

        try {
            await chrome.storage.local.set({
                userPrompt: '',
                rankingMode: 'style'
            });

            promptInput.value = '';
            clearPromptBtn.style.display = 'none';
            applyPromptBtn.disabled = true;
            updateActiveModeIndicator('all');

            // Send message to content script to switch back to style mode
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'switchToStyleMode'
                });
            }

            statusText.textContent = 'Switched back to all items';
            setTimeout(() => {
                statusText.textContent = 'Ready to filter your style!';
            }, 2000);

        } catch (error) {
            console.error('[Popup] Error clearing prompt:', error);
        }
    });

    // My Style toggle handler (updated to clear prompt when enabled)
    myStyleToggle.addEventListener('change', async function() {
        if (myStyleToggle.checked) {
            // Clear prompt mode
            await chrome.storage.local.set({
                userPrompt: '',
                rankingMode: 'style'
            });

            promptInput.value = '';
            clearPromptBtn.style.display = 'none';
            applyPromptBtn.disabled = true;
        }

        const filterState = {
            mode: myStyleToggle.checked ? 'myStyle' : 'all',
            scoreThreshold: parseInt(sensitivitySlider.value)
        };

        saveFilterState(filterState);
        sendFilterStateToContentScript(filterState);

        updateActiveModeIndicator(filterState.mode);
    });

    // Load prompt state from storage
    async function loadPromptState() {
        try {
            const result = await chrome.storage.local.get(['userPrompt', 'rankingMode', 'recentPrompts']);

            console.log('[Popup] Loaded prompt state:', result);

            // Update UI based on current mode
            if (result.rankingMode === 'prompt' && result.userPrompt) {
                promptInput.value = result.userPrompt;
                applyPromptBtn.disabled = false;
                clearPromptBtn.style.display = 'block';
                myStyleToggle.checked = false;
                updateActiveModeIndicator('prompt', result.userPrompt);
            } else if (result.rankingMode === 'style') {
                myStyleToggle.checked = true;
                updateActiveModeIndicator('style');
            } else {
                updateActiveModeIndicator('all');
            }

            // Show recent prompts if any
            if (result.recentPrompts && result.recentPrompts.length > 0) {
                displayRecentPrompts(result.recentPrompts);
            }

        } catch (error) {
            console.error('[Popup] Error loading prompt state:', error);
        }
    }

    // Update recent prompts in storage
    async function updateRecentPrompts(prompt) {
        try {
            const { recentPrompts = [] } = await chrome.storage.local.get(['recentPrompts']);

            // Remove if already exists to avoid duplicates
            const filteredPrompts = recentPrompts.filter(p => p !== prompt);

            // Add to front and limit to 5
            const updatedRecent = [prompt, ...filteredPrompts].slice(0, 5);

            await chrome.storage.local.set({ recentPrompts: updatedRecent });

            // Update UI
            displayRecentPrompts(updatedRecent);

        } catch (error) {
            console.error('[Popup] Error updating recent prompts:', error);
        }
    }

    // Display recent prompts as clickable chips
    function displayRecentPrompts(prompts) {
        if (!prompts || prompts.length === 0) {
            recentPromptsSection.style.display = 'none';
            return;
        }

        recentPromptsList.innerHTML = '';

        prompts.forEach(prompt => {
            const chip = document.createElement('div');
            chip.className = 'recent-prompt-chip';
            chip.textContent = prompt.length > 20 ? prompt.substring(0, 20) + '...' : prompt;
            chip.title = prompt; // Show full prompt on hover
            chip.addEventListener('click', () => {
                promptInput.value = prompt;
                applyPromptBtn.disabled = false;
                applyPromptBtn.click(); // Auto-apply
            });
            recentPromptsList.appendChild(chip);
        });

        recentPromptsSection.style.display = 'block';
    }

    // Update active mode indicator
    function updateActiveModeIndicator(mode, prompt = '') {
        // Remove all mode classes
        activeModeIndicator.classList.remove('prompt-mode', 'style-mode', 'all-mode');

        if (mode === 'prompt') {
            activeModeIndicator.classList.add('prompt-mode');
            const truncatedPrompt = prompt.length > 25 ? prompt.substring(0, 25) + '...' : prompt;
            activeModeText.textContent = `🔍 Search: "${truncatedPrompt}"`;
        } else if (mode === 'style' || mode === 'myStyle') {
            activeModeIndicator.classList.add('style-mode');
            activeModeText.textContent = '✨ Mode: My Style';
        } else {
            activeModeIndicator.classList.add('all-mode');
            activeModeText.textContent = 'Mode: All Items';
        }
    }

    // Check extension status
    checkExtensionStatus();

    async function checkExtensionStatus() {
        try {
            // Check if Chrome AI is available
            if (typeof chrome !== 'undefined' && chrome.ai) {
                const canCreateSession = await chrome.ai.canCreateTextSession();
                if (canCreateSession === 'readily') {
                    statusText.textContent = 'Chrome AI ready!';
                } else if (canCreateSession === 'after-download') {
                    statusText.textContent = 'Chrome AI downloading...';
                } else {
                    statusText.textContent = 'Chrome AI not available';
                }
            } else {
                statusText.textContent = 'Chrome AI not supported';
            }
        } catch (error) {
            console.log('AI status check failed:', error);
            statusText.textContent = 'Ready to filter your style!';
        }
    }
});