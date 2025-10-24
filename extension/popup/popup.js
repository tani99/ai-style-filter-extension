document.addEventListener('DOMContentLoaded', function() {
    const openDashboardBtn = document.getElementById('openDashboard');
    const statusText = document.getElementById('statusText');
    
    // Mode selector elements
    const modeOff = document.getElementById('modeOff');
    const modeStyle = document.getElementById('modeStyle');
    const modePrompt = document.getElementById('modePrompt');
    const modeStatus = document.getElementById('modeStatus');
    const modeStatusText = document.getElementById('modeStatusText');
    
    // Prompt section elements
    const promptSection = document.getElementById('promptSection');
    const promptInput = document.getElementById('promptInput');
    const applyPromptBtn = document.getElementById('applyPromptBtn');
    const recentPromptsSection = document.getElementById('recentPrompts');
    const recentPromptsList = document.getElementById('recentPromptsList');
    
    // Sensitivity slider elements
    const sensitivitySection = document.getElementById('sensitivitySection');
    const sensitivitySlider = document.getElementById('sensitivitySlider');
    const sensitivityValue = document.getElementById('sensitivityValue');

    // Handle opening the style dashboard
    openDashboardBtn.addEventListener('click', function() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('tab/tab.html')
        });
        window.close();
    });

    // Load current state from storage
    loadCurrentState();

    // Mode selector change handlers
    modeOff.addEventListener('change', function() {
        if (modeOff.checked) {
            handleModeChange('off');
        }
    });

    modeStyle.addEventListener('change', function() {
        if (modeStyle.checked) {
            handleModeChange('style');
        }
    });

    modePrompt.addEventListener('change', function() {
        if (modePrompt.checked) {
            handleModeChange('prompt');
        }
    });

    // Handle sensitivity slider changes
    sensitivitySlider.addEventListener('input', function() {
        sensitivityValue.textContent = `${sensitivitySlider.value}/10`;
    });

    sensitivitySlider.addEventListener('change', function() {
        const filterState = {
            mode: 'myStyle', // Always myStyle when sensitivity is being used
            scoreThreshold: parseInt(sensitivitySlider.value)
        };
        saveFilterState(filterState);
        sendFilterStateToContentScript(filterState);
    });

    // Prompt input handlers
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
                rankingMode: 'prompt',
                extensionEnabled: true
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
            updateModeStatus('prompt', prompt);

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

    /**
     * Handle mode change
     */
    async function handleModeChange(mode) {
        console.log('[Popup] Mode changed to:', mode);

        try {
            if (mode === 'off') {
                // Turn off extension
                await chrome.storage.local.set({
                    extensionEnabled: false,
                    rankingMode: 'off'
                });

                // Send message to content script to disable
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'disableExtension'
                    });
                }

                updateModeStatus('off');
                statusText.textContent = 'Extension disabled';

            } else if (mode === 'style') {
                // Switch to style mode
                await chrome.storage.local.set({
                    userPrompt: '',
                    rankingMode: 'style',
                    extensionEnabled: true
                });

                // Clear prompt input
                promptInput.value = '';
                applyPromptBtn.disabled = true;

                // Send message to content script to switch to style mode
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'switchToStyleMode'
                    });
                }

                // Update filter state
                const filterState = {
                    mode: 'myStyle',
                    scoreThreshold: parseInt(sensitivitySlider.value)
                };
                saveFilterState(filterState);
                sendFilterStateToContentScript(filterState);

                updateModeStatus('style');
                statusText.textContent = 'Analyzing with your style profile...';
                setTimeout(() => {
                    statusText.textContent = 'Ready to filter your style!';
                }, 2000);

            } else if (mode === 'prompt') {
                // Show prompt section
                updateModeStatus('prompt');
                
                // If there's already a prompt, keep it
                const result = await chrome.storage.local.get(['userPrompt']);
                if (result.userPrompt) {
                    promptInput.value = result.userPrompt;
                    applyPromptBtn.disabled = false;
                    updateModeStatus('prompt', result.userPrompt);
                    
                    await chrome.storage.local.set({
                        extensionEnabled: true
                    });
                } else {
                    // No prompt yet, just show the section
                    statusText.textContent = 'Enter a search query and click Apply';
                }
            }

        } catch (error) {
            console.error('[Popup] Error changing mode:', error);
            statusText.textContent = 'Error changing mode';
        }
    }

    /**
     * Load current state from storage
     */
    async function loadCurrentState() {
        try {
            const result = await chrome.storage.local.get([
                'extensionEnabled',
                'rankingMode',
                'userPrompt',
                'recentPrompts',
                'filterState'
            ]);

            console.log('[Popup] Loaded state:', result);

            const extensionEnabled = result.extensionEnabled !== false; // Default to true
            const rankingMode = result.rankingMode || 'off';
            const userPrompt = result.userPrompt || '';

            // Set mode selector based on state
            if (!extensionEnabled || rankingMode === 'off') {
                modeOff.checked = true;
                updateModeStatus('off');
            } else if (rankingMode === 'prompt' && userPrompt) {
                modePrompt.checked = true;
                promptInput.value = userPrompt;
                applyPromptBtn.disabled = false;
                updateModeStatus('prompt', userPrompt);
            } else if (rankingMode === 'style') {
                modeStyle.checked = true;
                updateModeStatus('style');
            } else {
                // Default to off
                modeOff.checked = true;
                updateModeStatus('off');
            }

            // Load sensitivity slider
            if (result.filterState) {
                sensitivitySlider.value = result.filterState.scoreThreshold || 6;
                sensitivityValue.textContent = `${sensitivitySlider.value}/10`;
            }

            // Show recent prompts if any
            if (result.recentPrompts && result.recentPrompts.length > 0) {
                displayRecentPrompts(result.recentPrompts);
            }

        } catch (error) {
            console.error('[Popup] Error loading state:', error);
        }
    }

    /**
     * Update mode status display
     */
    function updateModeStatus(mode, prompt = '') {
        // Show/hide sections based on mode
        if (mode === 'off') {
            promptSection.style.display = 'none';
            sensitivitySection.style.display = 'none';
            modeStatus.classList.remove('active');
            modeStatusText.textContent = '⏸️ Extension is off';
        } else if (mode === 'style') {
            promptSection.style.display = 'none';
            sensitivitySection.style.display = 'block';
            modeStatus.classList.add('active');
            modeStatusText.textContent = '✨ Filtering by your style profile';
        } else if (mode === 'prompt') {
            promptSection.style.display = 'block';
            sensitivitySection.style.display = 'none';
            modeStatus.classList.add('active');
            if (prompt) {
                const truncated = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt;
                modeStatusText.textContent = `🔍 Searching: "${truncated}"`;
            } else {
                modeStatusText.textContent = '🔍 Enter a search query below';
            }
        }
    }

    /**
     * Update recent prompts in storage
     */
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

    /**
     * Display recent prompts as clickable chips
     */
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

    /**
     * Save filter state
     */
    async function saveFilterState(filterState) {
        try {
            await chrome.storage.local.set({ filterState });
            console.log('[Popup] Saved filter state:', filterState);
        } catch (error) {
            console.error('[Popup] Error saving filter state:', error);
        }
    }

    /**
     * Send filter state to content script
     */
    async function sendFilterStateToContentScript(filterState) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'updateFilterState',
                    filterState: filterState
                });
                console.log('[Popup] Sent filter state to content script:', filterState);
            }
        } catch (error) {
            console.error('[Popup] Error sending filter state:', error);
        }
    }

    /**
     * Check extension status
     */
    checkExtensionStatus();

    async function checkExtensionStatus() {
        try {
            // Check if Chrome AI is available
            if (typeof chrome !== 'undefined' && chrome.ai) {
                const canCreateSession = await chrome.ai.canCreateTextSession();
                if (canCreateSession === 'readily') {
                    statusText.textContent = '✅ Chrome AI ready!';
                } else if (canCreateSession === 'after-download') {
                    statusText.textContent = '⏳ Chrome AI downloading...';
                } else {
                    statusText.textContent = '❌ Chrome AI not available';
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
