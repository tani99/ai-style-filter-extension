# Quick Start - Build and Development

## Setup (First Time)

```bash
# 1. Install dependencies
npm install

# 2. Build the extension
npm run build

# 3. Load in Chrome
# - Go to chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the /extension folder
```

## Development Workflow

```bash
# Option 1: Manual build after changes
npm run build
# Then reload extension in Chrome

# Option 2: Watch mode (auto-rebuild)
npm run watch
# Keeps running, rebuilds on file save
# Still need to reload extension in Chrome
```

## File Structure

### ✅ Edit These (Source Files)
```
extension/content/
├── content.js          # Entry point
├── ai/                 # AI modules
├── detection/          # Detection modules
├── core/               # Core modules
├── ui/                 # UI modules
└── utils/              # Utilities
```

### ❌ Don't Edit These
```
extension/content/
├── content-bundled.js      # AUTO-GENERATED from build
└── content-consolidated.js # DEPRECATED (old version)
```

## Making Changes

```bash
# 1. Edit source files
vim extension/content/detection/ImageDetector.js

# 2. Build
npm run build

# 3. Reload extension
# chrome://extensions/ → Click reload icon

# 4. Test
# Visit zara.com/hm.com/nike.com
```

## Common Commands

```bash
npm run build   # Build once
npm run watch   # Auto-rebuild on changes
npm install     # Install dependencies
```

## Troubleshooting

**Extension not loading?**
- Run `npm run build`
- Check `extension/content/content-bundled.js` exists
- Reload extension in chrome://extensions/

**Changes not appearing?**
- Make sure you ran `npm run build`
- Reload extension in Chrome
- Hard refresh page (Cmd+Shift+R)

**Import errors?**
- Check you're editing source files, not bundled output
- Make sure file paths are correct

## Documentation

- **BUILD_AND_DEVELOPMENT.md** - Complete development guide
- **MIGRATION_COMPLETE.md** - Architecture changes
- **IMAGE_DETECTION_AND_SCORING_FLOW.md** - How detection works
- **ARCHITECTURE_COMPARISON.md** - Monolithic vs modular