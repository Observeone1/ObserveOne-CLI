#!/usr/bin/env node

/**
 * Build script for ObserveOne CLI
 *
 * This script handles the build process, including:
 * - TypeScript compilation
 * - Copying necessary files
 * - Setting executable permissions
 * - Running tests
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.log('🔨 Building ObserveOne CLI...');

try {
  // Clean dist directory
  if (fs.existsSync('dist')) {
    console.log('🧹 Cleaning dist directory...');
    fs.rmSync('dist', { recursive: true, force: true });
  }

  // Create dist directory
  fs.mkdirSync('dist', { recursive: true });

  // Compile TypeScript
  console.log('📦 Compiling TypeScript...');
  execSync('tsc', { stdio: 'inherit' });

  // Copy package.json to dist
  console.log('📋 Copying package.json...');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Remove devDependencies and scripts from dist package.json
  const distPackageJson = {
    ...packageJson,
    devDependencies: undefined,
    scripts: {
      start: 'node index.js'
    }
  };
  
  fs.writeFileSync('dist/package.json', JSON.stringify(distPackageJson, null, 2));

  // Set executable permissions on the main file
  console.log('🔧 Setting executable permissions...');
  const mainFile = path.join('dist', 'index.js');
  if (fs.existsSync(mainFile)) {
    // Owner/group read+execute only — no "others" bits (S2612: avoid
    // world-accessible file permissions on a shipped executable).
    fs.chmodSync(mainFile, 0o750);
  }

  // Copy README to dist
  if (fs.existsSync('README.md')) {
    console.log('📖 Copying README...');
    fs.copyFileSync('README.md', 'dist/README.md');
  }

  console.log('✅ Build completed successfully!');
  console.log('📁 Output directory: dist/');
  console.log('🚀 Ready for publishing!');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
