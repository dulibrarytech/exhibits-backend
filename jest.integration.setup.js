/**
 * Jest Setup for Integration Tests
 *
 * This file runs before each test file and sets up the testing environment.
 *
 * Lives at the project root (not under test/) because test/ is gitignored,
 * and the Jest config must be able to locate this file on every checkout.
 *
 * Shared constants (TEST_UUID, TEST_USER_UID, APP_PATH) and the jest.mock
 * factories live in test/integration/helpers/mocks.js and are imported
 * explicitly by each suite; nothing is injected as a global here.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console output during tests (optional - comment out for debugging)
// global.console = {
//     ...console,
//     log: jest.fn(),
//     debug: jest.fn(),
//     info: jest.fn(),
//     warn: jest.fn(),
//     error: jest.fn()
// };

// Global beforeAll - runs once before all tests
beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';

    // Any global setup needed
});

// Global afterAll - runs once after all tests
afterAll(async () => {
    // Allow any pending async operations to complete
    await new Promise(resolve => setImmediate(resolve));

    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 200));

    // Clear any remaining timers
    jest.clearAllTimers();
});

// Global beforeEach - runs before each test
beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
});

// Global afterEach - runs after each test
afterEach(() => {
    // Cleanup any test-specific resources
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
