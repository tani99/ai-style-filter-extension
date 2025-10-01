document.addEventListener('DOMContentLoaded', function() {
    const openDashboardBtn = document.getElementById('openDashboard');
    const statusText = document.getElementById('statusText');
    const myStyleToggle = document.getElementById('myStyleToggle');
    const sensitivitySlider = document.getElementById('sensitivitySlider');
    const sensitivityValue = document.getElementById('sensitivityValue');

    // Handle opening the style dashboard
    openDashboardBtn.addEventListener('click', function() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('tab/tab.html')
        });

        // Close popup after opening dashboard
        window.close();
    });

    // Load filter state from storage
    loadFilterState();

    // Handle My Style Mode toggle
    myStyleToggle.addEventListener('change', function() {
        const filterState = {
            mode: myStyleToggle.checked ? 'myStyle' : 'all',
            scoreThreshold: parseInt(sensitivitySlider.value)
        };
        saveFilterState(filterState);
        sendFilterStateToContentScript(filterState);
    });

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