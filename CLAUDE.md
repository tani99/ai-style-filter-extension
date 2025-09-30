# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Manifest V3 extension that creates an AI-powered style-based shopping filter with virtual try-on capabilities. The extension uses Chrome's built-in AI APIs for style analysis and product detection on e-commerce sites (Zara, H&M, Nike).

## Architecture

### Core Components

- **Background Service Worker** (`background/background.js`): Handles extension lifecycle, storage, and inter-component messaging
- **Content Script** (`content/content-consolidated.js`): Modular architecture injected into e-commerce sites for product detection and filtering
- **Extension Tab** (`tab/`): Full-page dashboard for style profile management and photo uploads
- **Popup Interface** (`popup/`): Quick access toolbar popup

### AI Integration Architecture

The extension uses a multi-layered AI detection system:

1. **Quick Exclusion**: Fast non-AI checks for obvious UI elements
2. **AI Alt Text Analysis**: Chrome's language model analyzes image descriptions
3. **AI Image Classification**: Chrome's vision model analyzes actual pixels
4. **Smart Context Analysis**: Fallback context detection

### Data Flow

1. User uploads photos via extension tab → stored in `chrome.storage.local`
2. Chrome AI analyzes photos → generates style profile with confidence scores
3. Content script detects current e-commerce site → applies site-specific selectors
4. AI-powered product detection runs on page images → visual indicators added
5. Background service worker coordinates between components

## Development Commands

### Extension Loading and Testing
```bash
# Load extension in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select /extension folder

# Test content script functionality (in browser console on supported sites)
window.contentScript.detectProductImages()
window.contentScript.enableDebugMode()
window.contentScript.debugPageStructure()
```

### Testing Specific Features
```bash
# Test AI availability (in extension popup/tab console)
window.ai.canCreateTextSession()

# Test image detection with logging
window.contentScript.detectProductImages()  # Shows detailed per-image analysis

# Clear all detection indicators
window.contentScript.clearProductDetection()

# Get detection statistics
window.contentScript.getDetectionStats()
```

## Key Technical Concepts

### Site Detection System
The content script automatically detects supported e-commerce sites using hostname matching and applies site-specific CSS selectors for product images, cards, and links. Each site has customized detection patterns stored in `supportedSites` configuration.

### AI-Powered Image Detection
Unlike traditional keyword-based detection, the system uses Chrome's built-in AI APIs:
- **Language Model**: Analyzes alt text to understand image content
- **Image Classifier**: Performs visual analysis of actual image pixels
- **Style Matching**: AI-powered compatibility analysis comparing products to user style profiles
- **Confidence Scoring**: Provides percentage confidence for decisions across all AI analyses

### Visual Indicator System
Product images are marked with positioned overlay elements (not CSS box-shadows) to avoid cropping issues. Overlays use absolute positioning and update on scroll/resize events.

### Style Profile Persistence
User photos and generated style profiles persist across browser sessions using `chrome.storage.local`. The style analysis generates categories with confidence scores and color palettes.

## File Structure Context

```
/extension/
├── manifest.json                    # Manifest V3 configuration with site permissions
├── background/
│   └── background.js               # Service worker for lifecycle & messaging
├── content/
│   ├── content-consolidated.js     # Main consolidated content script file
│   ├── content.js.backup           # LEGACY: Pre-refactor monolithic code (DO NOT USE)
│   ├── ai/                        # AI analysis modules
│   │   ├── AIAnalysisEngine.js    # Core AI processing engine
│   │   ├── AltTextAnalyzer.js     # Alt text analysis
│   │   ├── ImageClassifier.js     # Visual image classification
│   │   ├── StyleMatcher.js        # Style matching logic
│   │   └── AnalysisCache.js       # Analysis result caching
│   ├── core/                      # Core functionality modules
│   │   ├── ContentScriptManager.js # Main content script coordination
│   │   ├── SiteDetector.js        # E-commerce site detection
│   │   └── PageTypeDetector.js    # Page type classification
│   ├── config/
│   │   └── SiteConfigurations.js  # Site-specific configurations
│   ├── detection/                 # Product detection modules
│   ├── ui/                        # User interface modules
│   │   ├── VisualIndicators.js    # Visual overlay management
│   │   ├── DebugInterface.js      # Debug mode interface
│   │   └── LoadingAnimations.js   # Loading state animations
│   └── utils/                     # Utility modules
│       ├── DOMUtils.js            # DOM manipulation utilities
│       ├── GeometryUtils.js       # Geometry calculations
│       └── EventListeners.js      # Event handling
├── popup/                         # Toolbar popup interface
├── tab/                          # Full dashboard (photo upload, style analysis)
├── icons/                        # Extension icons
└── lib/
    └── heic2any.min.js           # HEIC image format support
```

### Content Script Refactoring History

The `content.js.backup` file contains the original monolithic content script code before the modular refactoring. This file is **kept for reference only** and is **not loaded by the extension**.

**All active functionality is now in:**
- `content-consolidated.js` (main entry point)
- Modular components in `ai/`, `core/`, `detection/`, `ui/`, `utils/`, and `config/` directories

The refactoring separated concerns into specialized modules for better maintainability, testability, and code organization. When making changes to the content script functionality, **always modify the modular files**, never the backup file.

### Content Script Architecture
The modular content script architecture includes:

- **ContentScriptManager**: Main coordination and lifecycle management
- **SiteDetector & PageTypeDetector**: E-commerce site recognition and page classification
- **AIAnalysisEngine**: Core AI processing with multi-layered analysis pipeline
- **StyleMatcher**: AI-powered style compatibility analysis using user profiles
- **ImageClassifier & AltTextAnalyzer**: Specialized AI modules for visual and text analysis
- **VisualIndicators**: Overlay management with absolute positioning
- **AnalysisCache**: Performance optimization through result caching
- **DebugInterface**: Comprehensive logging and debugging tools

### Storage Schema
```javascript
{
  userPhotos: [],           // Base64 encoded uploaded photos
  styleProfile: {           // AI-generated style analysis
    categories: [...],      // Style categories with confidence
    colors: [...],          // Dominant color palette
    reasoning: "..."        // AI explanation
  },
  firstInstall: boolean
}
```

## Development Context

This extension is built following a detailed implementation plan (`virtual-tryon-extension-plan.md`) with specific phases and testing criteria. The current implementation includes:

- ✅ Phase 1: Extension foundation and structure
- ✅ Phase 2: Photo upload and storage system  
- ✅ Phase 3: Style profile generation and display
- ✅ Phase 4.1: Content script injection system
- ✅ Phase 4.2: AI-powered product image detection

The project emphasizes defensive security practices, local AI processing (no external API calls), and robust error handling with fallback detection methods.

## Testing Approach

Test the extension on supported sites (zara.com, hm.com, nike.com) by:
1. Loading extension and uploading style photos
2. Navigating to e-commerce sites
3. Observing green borders around detected clothing images
4. Using browser console commands for detailed debugging
5. Enabling debug mode to see rejection reasons

The detection system provides comprehensive logging showing alt text, decision reasoning, confidence scores, and method breakdown for each analyzed image.