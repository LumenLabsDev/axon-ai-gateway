#!/usr/bin/env ts-node
/**
 * Build script for frontend assets
 * Copies all frontend files from src/public to build/public
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

const SOURCE_DIR = 'src/public';
const BUILD_DIR = 'build/public';

/**
 * Recursively copy directory contents
 */
function copyDirectory(source: string, destination: string): void {
  // Create destination directory if it doesn't exist
  if (!existsSync(destination)) {
    mkdirSync(destination, { recursive: true });
  }

  // Read all items in source directory
  const items = readdirSync(source);

  for (const item of items) {
    const sourcePath = join(source, item);
    const destPath = join(destination, item);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      // Recursively copy subdirectory
      copyDirectory(sourcePath, destPath);
      console.log(`📁 Copied directory: ${sourcePath} → ${destPath}`);
    } else {
      // Ensure destination directory exists
      const destDir = dirname(destPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      // Copy file
      copyFileSync(sourcePath, destPath);
      console.log(`📄 Copied file: ${sourcePath} → ${destPath}`);
    }
  }
}

/**
 * Main build function
 */
function buildFrontend(): void {
  console.log('🚀 Building frontend assets...\n');

  try {
    // Check if source directory exists
    if (!existsSync(SOURCE_DIR)) {
      console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
      process.exit(1);
    }

    // Create build directory if it doesn't exist
    if (!existsSync(BUILD_DIR)) {
      mkdirSync(BUILD_DIR, { recursive: true });
      console.log(`📁 Created build directory: ${BUILD_DIR}\n`);
    }

    // Copy all files
    copyDirectory(SOURCE_DIR, BUILD_DIR);

    console.log('\n✅ Frontend build complete!');
    console.log(`📦 Files copied from ${SOURCE_DIR} to ${BUILD_DIR}`);
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build
buildFrontend();
