'use strict';

// Jest is used for integration tests because Vitest's vi.mock cannot intercept
// CommonJS require() chains in transitively-loaded source modules. Jest patches
// require() itself, so its module mocks work end-to-end across the CJS source
// tree without rewriting source code to ESM.
//
// Vitest still owns unit tests in test/tasks (see vitest.config.js).

module.exports = {
    testEnvironment: 'node',
    rootDir: __dirname,
    testMatch: ['<rootDir>/test/integration/**/*.test.js'],
    setupFilesAfterEnv: ['<rootDir>/jest.integration.setup.js'],
    testPathIgnorePatterns: ['/node_modules/', '/coverage/'],
    testTimeout: 30000,
    clearMocks: true,
    restoreMocks: true,
    maxWorkers: 1,
};
