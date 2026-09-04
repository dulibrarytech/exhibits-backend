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

Two naming conventions, one file per area (`ls test/integration` for the current list):

- `*_integration.test.js` — drive real HTTP requests through the routes with supertest (e.g. `exhibits_integration.test.js`, `items_integration.test.js`, `headings_controller_integration.test.js`).
- `*_model.test.js` — call model functions directly with the task classes mocked (e.g. `exhibits_model.test.js`, `grid_model.test.js`, `items_model.test.js`, `timelines_model.test.js`).

Plus focused suites for cross-cutting concerns: auth and page auth (`dashboard_page_auth`, `auth_rate_limit`), permissions (`permissions_matrix_integration`, `authorize_check_permission_integration`, `media_library_permissions_integration`), media handling (`media_upload_route`, `media_uploaded_thumbnail`, `transparent_png_flatten`), publish state (`preview_publish_state`, `publish_suppress_item_integration`), and services (`indexer_manage_route`, `repo_service_tn`, `iiif_pdf_rendering`, `recycle_route`, `client_endpoints_parity`).

Configuration lives at the project root:

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
- Get and delete media on exhibits; media-library binding (`bind_media`), upload routes, and thumbnail handling.

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

Shared scaffolding lives in `helpers/mocks.js`; `jest.integration.setup.js` only sets the timeout and the global mock-reset hooks.

### Constants
```javascript
const { APP_PATH, TEST_UUID, TEST_USER_UID } = require('./helpers/mocks');
```
Requiring the helper also pins `process.env.APP_PATH` (the real endpoints modules read it at require time), so require it before any source module in suites that mount real routers.

### jest.mock factories
Plain functions, callable from inside a hoisted `jest.mock` factory (which may only reference `mock`-prefixed locals or things it requires itself):
```javascript
jest.mock('../../libs/log4', () => require('./helpers/mocks').log4_factory());
jest.mock('../../libs/tokens', () => require('./helpers/mocks').tokens_factory({ decoded: { sub: 'curator' }, require_header: true }));
jest.mock('../../auth/authorize', () => require('./helpers/mocks').authorize_factory({ check_permission: (...args) => mockCheckPermission(...args) }));
jest.mock('../../config/rate_limits_loader', () => require('./helpers/mocks').rate_limits_factory(['read_operations', 'write_operations']));
jest.mock('../../config/db_tables_config', () => require('./helpers/mocks').db_tables_factory({ exhibit_records: 'tbl_exhibits' }));
```
`tokens_factory` options: `decoded` (default `{ sub: TEST_USER_UID }`, `null` to leave the request untouched), `user` (sets `req.user` instead), `require_header` (401 without `x-access-token`), `methods` (default `['verify']`), `wrap` (default `true` — `jest.fn` so tests can `mockImplementation`), `extra` (merged members such as `create`, `verify_shared`). `rate_limits_factory()` with no list answers every limiter name through a Proxy.

### Test-side helpers
```javascript
const { path_for, mock_model } = require('./helpers/mocks');

path_for(ENDPOINTS.grid_records.get.endpoint, { exhibit_id, grid_id });   // ':param' substitution, segment-anchored
mock_model(['get_record', 'update_record']);                                // one jest.fn() per name
mock_model(['get_record'], { update_record: true }, { create_uuid: 'x' }); // resolves / returns maps
mock_model({ get_record: {}, update_record: true });                        // every method resolves
```

## Skipped Tests

None. If a source refactor invalidates a test, rewrite it against the new code path in the same change rather than leaving it `.skip`'d — long-lived skips in this suite have historically outlived the comments explaining them.

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
