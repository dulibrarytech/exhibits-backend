# Integration Tests

## Overview

This directory contains integration tests for the Exhibits backend. Each test exercises the full request-response flow through:

- Routes (e.g. `exhibits_routes.js`)
- Controller (e.g. `exhibits_controller.js`)
- Model (e.g. `exhibits_model.js`)

Tests use [supertest](https://github.com/ladjs/supertest) to drive an Express application that has its external dependencies (logger, auth, configs, indexer) mocked out.

## Why Jest, not Vitest

The integration suite runs on Jest while the unit suite (`test/tasks/`) runs on Vitest. The split exists because Vitest's `vi.mock` cannot intercept the transitive CommonJS `require()` chains that the source modules rely on — when a test ESM-imports a route module, the route's nested `require()` calls into the source tree are not patched. Jest patches Node's module loader directly, so its mocks apply end-to-end.

See `test/README.md` for the runner-architecture overview.

## Layout

```
test/integration/
├── README.md                        # this file
├── exhibits_integration.test.js
├── exhibits_model.test.js
├── grid_integration.test.js
├── grid_model.test.js
├── headings_integration.test.js
├── headings_model.test.js
├── items_integration.test.js
├── items_model.test.js
├── timelines_integration.test.js
└── timelines_model.test.js
```

Configuration lives at the project root (the `test/` directory is gitignored, so anything Jest needs at startup must live outside it):

- `jest.integration.config.js` — Jest config, scopes to `test/integration/**/*.test.js`.
- `jest.integration.setup.js` — `setupFilesAfterEnv` file (custom matchers, globals, hooks).

## Running Tests

From the project root:

```bash
# Run the full integration suite
npm run test:integration

# Or invoke Jest directly
npx jest --config jest.integration.config.js

# Single file
npx jest --config jest.integration.config.js exhibits_integration.test.js

# With coverage
npx jest --config jest.integration.config.js --coverage

# Watch mode
npx jest --config jest.integration.config.js --watch
```

## Test Categories

### CRUD Operations
- Create, read, update, delete for exhibits, headings, items, grids, timelines.

### State Management
- Publish, suppress, unlock.

### Media Operations
- Get and delete media on exhibits.
- Item-level media-delete tests are currently skipped — see "Skipped Tests" below.

### Token Verification
- `POST /api/exhibits/v2/token/verify`

### Security Tests
- Security header validation
- Input validation (UUID format, length limits, path traversal patterns)
- Authorization checks

## Mocking Strategy

Integration tests mock external dependencies while still exercising the real route → controller → model code paths.

### Mocked
- `libs/log4` — Logger
- `libs/tokens` — Token verification
- `auth/authorize` — Authorization
- `config/rate_limits_loader` — Rate limiting
- `config/webservices_config` — Web services configuration
- The model under test (database operations are stubbed at the model interface)

### Not Mocked
- Express routes
- Controller logic
- Request validation middleware
- Error handling middleware

## Test Utilities

Provided by `jest.integration.setup.js`:

### Globals
```javascript
global.TEST_UUID                       // valid test UUID
global.TEST_USER_UID                   // valid test user UID
global.generateTestExhibit(overrides)  // exhibit test-data factory
global.generateTestUser(overrides)     // user test-data factory
```

### Custom Matchers
```javascript
expect(response).toBeSuccessResponse()
expect(response).toBeErrorResponse(404)
expect(uuid).toBeValidUUID()
```

## Skipped Tests

7 tests are currently skipped, all with documented reasons:

- **`items_integration.test.js` (5 tests)** — covered `CONTROLLER.delete_item_media`, which has been removed from `items_controller.js`. The corresponding route registration was removed and the `describe` block is `describe.skip`'d pending a replacement endpoint or test deletion.
- **`exhibits_model.test.js` (1 test)** — `should process media files when provided`. The media pipeline was refactored from `process_uploaded_media` to `bind_hero_image` / `bind_thumbnail`; the original assertion no longer matches the source.
- **`grid_model.test.js` (1 test)** — `should process media files`. Same media-pipeline refactor.

## Common Patterns

### Success
```javascript
test('should create exhibit successfully', async () => {
    mockExhibitsModel.create_exhibit_record.mockResolvedValue({
        status: 201,
        message: 'Exhibit record created',
        data: TEST_UUID
    });

    const response = await request(app)
        .post('/api/exhibits/v2/exhibit')
        .send({ title: 'Test' })
        .expect(201);

    expect(response.body.status).toBe(201);
});
```

### Error
```javascript
test('should return 403 when unauthorized', async () => {
    AUTHORIZE.check_permission.mockResolvedValue(false);

    const response = await request(app)
        .post('/api/exhibits/v2/exhibit')
        .send({ title: 'Test' })
        .expect(403);

    expect(response.body.success).toBe(false);
});
```

### Validation
```javascript
test('should return 400 for invalid input', async () => {
    const response = await request(app)
        .get('/api/exhibits/v2/exhibit/%20')
        .expect(400);

    expect(response.body.message).toBe('Valid exhibit ID is required');
});
```

## Troubleshooting

### Tests Fail When Run Together
If tests pass individually but fail when run as a suite:
1. Confirm `jest.clearAllMocks()` is called in `beforeEach` (it is, in the setup file).
2. Look for shared state between tests (module-level variables in source).
3. Verify mock implementations are reset where needed.

### Timeout Errors
The integration timeout is 30 seconds (`jest.integration.config.js`). If tests time out:
1. Look for unresolved promises in mock implementations.
2. Confirm every model method called in the test path has a `mockResolvedValue` / `mockRejectedValue`.
3. Re-run with `--detectOpenHandles` to surface async leaks.

### Mock Not Applying
1. The `jest.mock(...)` call must appear before the `require()` of the module under test (Jest hoists `jest.mock` to the top of the file at parse time, but be defensive).
2. The mock path must match the path the source code uses (relative paths must resolve to the same absolute file).
3. If a previous test polluted module state, try `jest.resetModules()` in `beforeEach`.

### URL Encoding and Path Traversal Tests
Express decodes URL-encoded characters before routing:
- `%2F` becomes `/` and can break route matching.
- `%20` becomes a space.
- For path-traversal security tests, use patterns like `test..invalid` instead of `../etc/passwd` so the request still matches the route and the controller's validation catches it.

```javascript
// Won't match route:
'/api/exhibits/v2/exhibit/../../../etc/passwd/publish'

// Matches route, validation rejects:
'/api/exhibits/v2/exhibit/test..invalid/publish'
```

### Open Handles Warning
Diagnosed 2026-04-25: the suite has no actual leaked handles. `forceExit` was removed from the Jest config and the suite still exits cleanly under `--detectOpenHandles`. If you see new open-handles warnings after a future change, run with `--detectOpenHandles` and fix the source — don't reach for `forceExit: true` first.

## Contributing

When adding integration tests:
1. Follow existing patterns (one of the `*_integration.test.js` files is the closest reference).
2. Cover both success and error paths.
3. Add at least one security-related case (input validation, auth, or boundary).
4. Update `test/TEST_SUMMARY.md` with the new per-file count.
5. Keep tests isolated — no cross-test state.
