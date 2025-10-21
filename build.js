const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const watchMode = process.argv.includes('--watch');

// Build configuration
const buildOptions = {
  entryPoints: ['extension/content/content-entry.js'],
  bundle: true,
  outfile: 'extension/content/content.generated.js',
  format: 'iife',
  platform: 'browser',
  target: 'chrome128',
  banner: {
    js: '// AUTO-GENERATED - DO NOT EDIT\n// Generated from modular source files in content/ folder\n// To make changes: Edit source files, then run: npm run build\n'
  },
  logLevel: 'info'
};

async function build() {
  try {
    console.log('🔨 Building content script...');

    if (watchMode) {
      console.log('👀 Watch mode enabled - will rebuild on changes');
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log('✅ Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('✅ Build complete!');
      console.log('📦 Generated: extension/content/content.generated.js');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
