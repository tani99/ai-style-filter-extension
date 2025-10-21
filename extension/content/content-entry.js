// Main entry point for bundled content script
// This file imports all modular components and initializes the content script

// Import configuration
import { SUPPORTED_SITES } from './config/SiteConfigurations.js';

// Import core modules
import { SiteDetector } from './core/SiteDetector.js';
import { PageTypeDetector } from './core/PageTypeDetector.js';
import { ContentScriptManager } from './core/ContentScriptManager.js';

// Import AI modules
import { AIAnalysisEngine } from './ai/AIAnalysisEngine.js';
import { AltTextAnalyzer } from './ai/AltTextAnalyzer.js';
import { ImageClassifier } from './ai/ImageClassifier.js';
import { ProductAnalyzer } from './ai/ProductAnalyzer.js';

// Import detection modules
import { ImageDetector } from './detection/ImageDetector.js';
import { QuickExclusion } from './detection/QuickExclusion.js';
import { CandidateFinder } from './detection/CandidateFinder.js';
import { VisibilityChecker } from './detection/VisibilityChecker.js';

// Import UI modules
import { VisualIndicators } from './ui/VisualIndicators.js';
import { DebugInterface } from './ui/DebugInterface.js';
import { LoadingAnimations } from './ui/LoadingAnimations.js';
import { FilterControls } from './ui/FilterControls.js';

// Import utility modules
import { DOMUtils } from './utils/DOMUtils.js';
import { GeometryUtils } from './utils/GeometryUtils.js';
import { EventListeners } from './utils/EventListeners.js';
import { FilterStateManager } from './utils/FilterStateManager.js';

// Export to window for compatibility
window.SUPPORTED_SITES = SUPPORTED_SITES;
window.SiteDetector = SiteDetector;
window.PageTypeDetector = PageTypeDetector;
window.ContentScriptManager = ContentScriptManager;
window.AIAnalysisEngine = AIAnalysisEngine;
window.AltTextAnalyzer = AltTextAnalyzer;
window.ImageClassifier = ImageClassifier;
window.ProductAnalyzer = ProductAnalyzer;
window.ImageDetector = ImageDetector;
window.QuickExclusion = QuickExclusion;
window.CandidateFinder = CandidateFinder;
window.VisibilityChecker = VisibilityChecker;
window.VisualIndicators = VisualIndicators;
window.DebugInterface = DebugInterface;
window.LoadingAnimations = LoadingAnimations;
window.FilterControls = FilterControls;
window.DOMUtils = DOMUtils;
window.GeometryUtils = GeometryUtils;
window.EventListeners = EventListeners;
window.FilterStateManager = FilterStateManager;

// Initialize the content script
console.log('🚀 Initializing AI Style Filter content script...');

// Create content script manager instance
const contentScriptManager = new ContentScriptManager();

// Expose to window for debugging
window.contentScript = contentScriptManager;

// Start the content script
contentScriptManager.initialize();

console.log('✅ Content script initialized and ready!');
