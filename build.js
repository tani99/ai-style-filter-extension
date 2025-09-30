const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['extension/content/content.js'],
  bundle: true,
  outfile: 'extension/content/content.generated.js',
  format: 'iife',
  platform: 'browser',
  target: ['chrome128'],
  logLevel: 'info',
  banner: {
    js: '// AUTO-GENERATED - DO NOT EDIT\n// Generated from modular source files in content/ folder\n// To make changes: Edit source files, then run: npm run build\n'
  }
};

async function build() {
  try {
    if (isWatch) {
      const context = await esbuild.context(buildOptions);
      await context.watch();
      console.log('👀 Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('✅ Build complete!');
      console.log('📦 Output: extension/content/content.generated.js');
      console.log('');
      console.log('Next steps:');
      console.log('1. Reload extension in chrome://extensions/');
      console.log('2. Test on e-commerce site');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();