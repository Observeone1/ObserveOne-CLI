#!/usr/bin/env node

/**
 * Basic ObserveOne CLI Usage Examples
 *
 * This file demonstrates common usage patterns for the ObserveOne CLI.
 * Run these examples to see how the CLI works in practice.
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Helper function to run CLI commands
function runCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options,
    });
    return result;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    return null;
  }
}

// Example 1: Basic authentication and setup
console.log('🔐 Example 1: Authentication and Setup');
console.log('=====================================');

// Check if user is authenticated
const authCheck = runCommand('obs ai-check list');
if (authCheck?.includes('Not authenticated')) {
  console.log('❌ Not authenticated. Please run: obs login');
} else {
  console.log('✅ Authentication successful');
}

// Example 2: Initialize project
console.log('\n🚀 Example 2: Project Initialization');
console.log('===================================');

// Create a sample config file
const sampleConfig = {
  project: {
    name: 'Sample Project',
    description: 'A sample project for ObserveOne CLI',
  },
  apiUrl: 'https://api.observeone.com',
  defaultOptions: {
    timeout: 300000,
    retries: 3,
    verbose: false,
  },
};

fs.writeFileSync('.obs.config.json', JSON.stringify(sampleConfig, null, 2));
console.log('✅ Sample configuration created');

// Example 3: List available tests
console.log('\n📋 Example 3: Listing Tests');
console.log('===========================');

const testList = runCommand('obs ai-check list');
if (testList) {
  console.log('Available tests:');
  console.log(testList);
} else {
  console.log('❌ Failed to list tests');
}

// Example 4: Running tests
console.log('\n🧪 Example 4: Running Tests');
console.log('===========================');

// Example of running a test (this would fail if no tests exist)
const testResult = runCommand('obs ai-check --help');
if (testResult) {
  console.log('✅ CLI help command works');
} else {
  console.log('❌ CLI help command failed');
}

// Example 5: Ad-hoc testing
console.log('\n⚡ Example 5: Ad-hoc Testing');
console.log('===========================');

const adhocCommand =
  'obs ai-check --url https://example.com --prompt "Navigate to the homepage" --name "Homepage Test" --adhoc';
console.log(`Command: ${adhocCommand}`);
console.log('Note: This would run an ad-hoc test if authenticated');

// Example 6: CI/CD Integration
console.log('\n🔄 Example 6: CI/CD Integration');
console.log('=============================');

const ciCommand = 'obs ai-check my-test --reporter junit --output results.xml';
console.log(`CI Command: ${ciCommand}`);
console.log('This would generate a JUnit XML report for CI systems');

// Example 7: Watch mode
console.log('\n👀 Example 7: Watch Mode');
console.log('=======================');

const watchCommand = 'obs watch test1 test2 --pattern "**/*.js" --max-runs 5';
console.log(`Watch Command: ${watchCommand}`);
console.log('This would watch for file changes and run tests automatically');

// Cleanup
console.log('\n🧹 Cleanup');
console.log('==========');

if (fs.existsSync('.obs.config.json')) {
  fs.unlinkSync('.obs.config.json');
  console.log('✅ Sample configuration removed');
}

console.log('\n✨ Examples completed!');
console.log('For more information, run: obs --help');
