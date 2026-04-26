/**
 * Jest Configuration for Exhibit Record Tasks Unit Tests
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Coverage configuration
  collectCoverage: false, // Set to true when running coverage tests
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'exhibits/tasks/**/*.js',
    'users/tasks/**/*.js',
    'indexer/tasks/**/*.js',
    'test/tasks/exhibit_*.js', // In case source files are in test/tasks
    'test/tasks/users_*.js',
    'test/tasks/indexer_*.js',
    '!**/*.test.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test file patterns
  testMatch: [
    '**/test/tasks/**/*.test.js'
  ],

  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],

  // Module paths
  modulePaths: [
    '<rootDir>'
  ],

  // Setup files
  setupFilesAfterEnv: [],

  // Timeout configuration
  testTimeout: 10000,

  // Display configuration
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],

  // Error handling
  bail: 0, // Continue running tests after failures
  errorOnDeprecated: true,

  // Performance
  maxWorkers: '50%',

  // Transform configuration (if needed for ES6)
  transform: {},

  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined,

  // Notification configuration
  notify: false,
  notifyMode: 'failure-change',

  // Watch configuration
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ]
};