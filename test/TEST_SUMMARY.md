# Test Suite Summary

Baseline counts and coverage notes for the Exhibit Builder backend test suite. See `README.md` for the runner architecture (Vitest for unit, Jest for integration, Playwright for e2e).

Per-file test counts are deliberately not tracked here — they rot. Run the suites for live numbers.

## Current Baseline

As of 2026-08-28:

| Runner | Files | Pass | Skip |
|--------|------:|-----:|-----:|
| Vitest — `test/tasks/` (server unit)      | 34 | —   | 0 |
| Vitest — `test/unit-app/` (client unit)   | 19 | —   | 0 |
| Vitest total                              | 53 | 1021 | 0 |
| Jest — `test/integration/`                | 28 | 577 | 0 |
| **`npm test` total**                      | **81** | **1598** | **0** |

Playwright (not part of `npm test`): 54 stubbed specs in `test/e2e/specs/`, 10 live specs in `test/e2e/live/`. The two `@external` live specs skip unless `PW_EXTERNAL=1` (VPN-reachable Kaltura / repository services).

## Unit Tests (Vitest — `test/tasks/`)

Server-side modules tested in isolation:

- **Record-task classes** (`exhibit_*_record_tasks`, `user_tasks`, `auth_tasks`, `permissions_tasks`) — constructor init, table/UUID/data validation, protected-field enforcement, timeout handling, CRUD, publish/suppress, reorder, error handling.
- **Indexer** (`indexer_*`) — index task lifecycle, bulk indexing, projections (item title, media name, margins, internal-name exclusion, container child records, repo IIIF), UUID validation, index checks.
- **Services and guards** — IIIF cache/status, Kaltura thumbnail URL derivation, reindex coalescer, RTE vocabulary/DOM sanitizer, CSRF guard, SSO guard, process handlers, media create record, common-helper validators, dashboard view targets, dropped-title-column regression, API stubs sanity.

## Unit Tests (Vitest + jsdom — `test/unit-app/`)

Browser-side `public/app/*` client modules (helper, dom, exhibits form modules, grid/timeline item forms, media library helpers, upload modals, endpoints version, list displays). Each file opts into jsdom via `// @vitest-environment jsdom`.

## Integration Tests (Jest — `test/integration/`)

Full route → controller → model flows (`*_integration.test.js`) and model-layer orchestration with mocked task classes (`*_model.test.js`), plus focused suites for auth, permissions matrices, media upload/thumbnails/PNG flattening, preview/publish state, recycle bin, indexer manage route, repo thumbnail service, IIIF PDF rendering, and client-endpoint parity. See `integration/README.md` for the mocking strategy.

Route-mounting suites (`*_routes_integration.test.js` — grids, timelines, headings, users, auth) mount the REAL route files with the real endpoints module and controllers (models mocked), covering route registration, path-param mapping, and middleware ordering (rate limit → token verify → validation → authorize → model). Every route file they cover sits at 100% coverage; prefer extending them over hand-wiring an Express app when adding route-level tests.

### Coverage Areas

- CRUD through the full route → controller → model flow
- State management (publish, suppress, preview, unlock)
- Media-library binding (`bind_media` for hero image / thumbnail roles) and uploads
- Token verification and authorization checks (RBAC matrices)
- Input validation (UUIDs, length limits, path traversal)
- Security headers and rate limiting
- Error scenarios (404, 403, 400, 500)

## Skipped Tests

None unconditionally skipped. Policy: when a source refactor invalidates a test, rewrite it against the new code path in the same change instead of `.skip`'ing it.

## Test Quality Features

- ✅ External dependencies mocked (logger, tokens, authorize, configs)
- ✅ Both positive and negative test cases
- ✅ Regression guards for previously shipped bugs (dropped title column, margins projection, internal-name indexing, transparent-PNG flattening, APP_PATH cold-cache auth)

---

**Last Updated:** 2026-08-28
**License:** Apache-2.0
