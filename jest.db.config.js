'use strict';

/*
 * Database-backed task tests (`npm run test:db`).
 *
 * These run the REAL task classes against the REAL e2e database
 * (E2E_DB_NAME, default exhibits_e2e — the same one the live Playwright suite
 * uses), migrated and seeded by test/db/global-setup.js. Unlike the mocked-knex
 * unit tests in test/tasks, they check what a query MEANS (which rows come
 * back), not which builder methods were called — the only way to catch
 * mis-scoped WHERE clauses. Not part of `npm test`: they need MariaDB/MySQL
 * reachable with the .env credentials.
 */
module.exports = {
    testEnvironment: 'node',
    rootDir: __dirname,
    testMatch: ['<rootDir>/test/db/**/*.db.test.js'],
    globalSetup: '<rootDir>/test/db/global-setup.js',
    testPathIgnorePatterns: ['/node_modules/'],
    testTimeout: 30000,
    maxWorkers: 1,
    clearMocks: true,
    restoreMocks: true
};
