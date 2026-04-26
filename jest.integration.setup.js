/**
 * Jest Setup for Integration Tests
 *
 * This file runs before each test file and sets up the testing environment.
 *
 * Lives at the project root (not under test/) because test/ is gitignored,
 * and the Jest config must be able to locate this file on every checkout.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test constants
global.TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
global.TEST_USER_UID = '660e8400-e29b-41d4-a716-446655440001';

// Suppress console output during tests (optional - comment out for debugging)
// global.console = {
//     ...console,
//     log: jest.fn(),
//     debug: jest.fn(),
//     info: jest.fn(),
//     warn: jest.fn(),
//     error: jest.fn()
// };

// Custom matchers for API responses
expect.extend({
    /**
     * Check if response is a valid API success response
     */
    toBeSuccessResponse(received) {
        const pass = received.body &&
            received.body.success === true &&
            received.status >= 200 &&
            received.status < 300;

        return {
            pass,
            message: () => pass
                ? `Expected response NOT to be a success response`
                : `Expected response to be a success response, got status ${received.status} with body ${JSON.stringify(received.body)}`
        };
    },

    /**
     * Check if response is a valid API error response
     */
    toBeErrorResponse(received, expectedStatus) {
        const pass = received.body &&
            received.body.success === false &&
            received.status === expectedStatus;

        return {
            pass,
            message: () => pass
                ? `Expected response NOT to be an error response with status ${expectedStatus}`
                : `Expected error response with status ${expectedStatus}, got status ${received.status} with body ${JSON.stringify(received.body)}`
        };
    },

    /**
     * Check if UUID is valid format
     */
    toBeValidUUID(received) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const pass = uuidRegex.test(received);

        return {
            pass,
            message: () => pass
                ? `Expected ${received} NOT to be a valid UUID`
                : `Expected ${received} to be a valid UUID`
        };
    }
});

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

// Utility function for generating test data
global.generateTestExhibit = (overrides = {}) => ({
    title: 'Test Exhibit',
    description: 'Test Description',
    type: 'standard',
    banner_template: 'default',
    page_layout: 'standard',
    is_published: 0,
    is_featured: 0,
    ...overrides
});

// Utility function for generating test user
global.generateTestUser = (overrides = {}) => ({
    id: global.TEST_USER_UID,
    role: 'admin',
    permissions: ['add_exhibit', 'update_exhibit', 'delete_exhibit', 'publish_exhibit'],
    ...overrides
});
