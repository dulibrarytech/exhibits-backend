# Test Suite Summary

Baseline counts and coverage notes for the Exhibit Builder backend test suite. See `README.md` for the runner architecture (Vitest for unit, Jest for integration, Playwright for e2e).

Per-file test counts are deliberately not tracked here — they rot. Run the suites for live numbers.

## Current Baseline

As of 2026-09-02:

| Runner | Files | Pass | Skip |
|--------|------:|-----:|-----:|
| Vitest — `test/tasks/` (server unit)      | 34 | —   | 0 |
| Vitest — `test/unit-app/` (client unit)   | 19 | —   | 0 |
| Vitest total                              | 54 | 997 | 0 |
| Jest — `test/integration/`                | 38 | 898 | 0 |
| **`npm test` total**                      | **92** | **1895** | **0** |

Database-backed task tests (`npm run test:db`, not part of `npm test`): `test/db/*.db.test.js` run the REAL task classes against the e2e database (`exhibits_e2e`, migrated + seeded by `test/db/global-setup.js`, shared with the live Playwright suite). They assert which ROWS a query returns, which the mocked-knex unit tests in `test/tasks` cannot. Suites (49 cases): `auth_tasks_ownership` (check_ownership; a child must belong to the exhibit named in the URL — review H3), `publish_gate_counts` (get_record_count and bulk publish/suppress skip recycled rows and other exhibits — review M3), `media_tasks_references` (find_by_storage_path claims by either column across all rows; get_published_exhibit_uuids), `roles_tasks` (role upsert, get_user_role, the update-without-row gap), `recycled_tasks_scope` (restore/purge confined to the named exhibit — review H3), `container_item_suppress` (one grid/timeline's items only — review H8). Each suite failed on the original code where the review predicted and passes after the fix. Suites create their own fixture rows and delete them in `afterAll`.

Playwright (not part of `npm test`): 56 stubbed specs in `test/e2e/specs/`, 13 live specs in `test/e2e/live/` (incl. the full create→publish→preview exhibit lifecycle). The two `@external` live specs skip unless `PW_EXTERNAL=1` (VPN-reachable Kaltura / repository services). Live publish/preview index into the LOCAL Elasticsearch index — lifecycle-style tests must suppress in teardown (apiSuppressExhibit) so those documents are removed again.

## Unit Tests (Vitest — `test/tasks/`)

Server-side modules tested in isolation:

- **Record-task classes** (`exhibit_*_record_tasks`, `user_tasks`, `auth_tasks`, `permissions_tasks`) — constructor init, table/UUID/data validation, protected-field enforcement, timeout handling, CRUD, publish/suppress, reorder, error handling.
- **Indexer** (`indexer_*`) — index task lifecycle, bulk indexing, projections (item title, media name, margins, internal-name exclusion, container child records, repo IIIF), UUID validation, index checks.
- **Services and guards** — IIIF cache/status, Kaltura thumbnail URL derivation, reindex coalescer, RTE vocabulary/DOM sanitizer, CSRF guard, SSO guard, process handlers, media create record, common-helper validators, dashboard view targets, dropped-title-column regression, API stubs sanity.

## Unit Tests (Vitest + jsdom — `test/unit-app/`)

Browser-side `public/app/*` client modules (helper, dom, exhibits form modules, grid/timeline item forms, media library helpers, upload modals, endpoints version, list displays). Each file opts into jsdom via `// @vitest-environment jsdom`.

## Integration Tests (Jest — `test/integration/`)

Full route → controller → model flows (`*_integration.test.js`) and model-layer orchestration with mocked task classes (`*_model.test.js`), plus focused suites for auth, permissions matrices, media upload/thumbnails/PNG flattening, preview/publish state, recycle bin, indexer manage route, repo thumbnail service, IIIF PDF rendering, and client-endpoint parity. See `integration/README.md` for the mocking strategy.

Every model now has a real-execution suite (`*_model.test.js`): exhibits, items, grid, timelines, recycle, and — added 2026-09-02 — users, auth, headings, indexer and media library. The model code runs for real with only the task classes (and, where needed, the upload pipeline / IIIF cache / coalescer) mocked, so status-contract bugs ("model says 404, controller sends 201") are caught without the live stack. Also added the same day: `share_routes_integration` (share-token binding) and `cleanup_orphaned_files` (the sweep against a temp storage tree with a fake DB).

Route-mounting suites (`*_routes_integration.test.js` — items, grids, timelines, headings, users, auth, media library, share) mount the REAL route files with the real endpoints module and controllers (models mocked), covering route registration, path-param mapping, and middleware ordering (rate limit → token verify → validation → authorize → model). Every route file they cover sits at 100% coverage; prefer extending them over hand-wiring an Express app when adding route-level tests.

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
