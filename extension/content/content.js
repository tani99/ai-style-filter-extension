import { ContentScriptManager } from './core/ContentScriptManager.js';

console.log('AI Style Filter content script loaded');

// Initialize the content script manager
const styleFilter = new ContentScriptManager();

// Initialize the system
styleFilter.initialize().then(() => {
    console.log('🎉 AI Style Filter ready');
}).catch(error => {
    console.error('❌ AI Style Filter initialization failed:', error);
});

// Expose to window for debugging
window.styleFilter = styleFilter;
