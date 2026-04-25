import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        // Vitest owns unit tests under test/tasks. Integration tests under
        // test/integration are run by Jest (see jest.integration.config.js)
        // because vi.mock cannot intercept transitive CJS require() chains.
        include: ['test/tasks/**/*.test.js'],
        exclude: ['public/**', 'node_modules/**', 'test/**/node_modules/**', 'test/integration/**', 'test/**/*._todo.js'],
        setupFiles: ['test/setup.js'],
        testTimeout: 30000,
        clearMocks: true,
        restoreMocks: true,
    },
});
