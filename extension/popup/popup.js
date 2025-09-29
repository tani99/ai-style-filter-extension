document.addEventListener('DOMContentLoaded', function() {
    const openDashboardBtn = document.getElementById('openDashboard');
    const statusText = document.getElementById('statusText');
    
    // Handle opening the style dashboard
    openDashboardBtn.addEventListener('click', function() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('tab/tab.html')
        });
        
        // Close popup after opening dashboard
        window.close();
    });
    
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
            statusText.textContent = 'Ready to get started!';
        }
    }
});