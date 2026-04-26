# Test Suite Summary

Per-file test counts and coverage notes for the Exhibit Builder backend test suite. See `README.md` for the dual-runner overview (Vitest for unit, Jest for integration).

## Current Baseline

| Runner | Files | Pass | Skip |
|--------|------:|-----:|-----:|
| Vitest (unit)        |  9 | 549 | 0 |
| Jest (integration)   | 10 | 524 | 7 |
| **Total**            | **19** | **1073** | **7** |

## Unit Tests (Vitest — `test/tasks/`)

| File | Pass | Notes |
|------|-----:|-------|
| `auth_tasks.test.js`                       |  ~80 | Authentication helpers |
| `exhibit_record_tasks.test.js`             |  ~64 | Main exhibit record operations |
| `exhibit_heading_record_tasks.test.js`     |  ~65 | Heading record operations |
| `exhibit_item_record_tasks.test.js`        |  ~71 | Standard item record operations |
| `exhibit_grid_record_tasks.test.js`        |  ~58 | Grid item record operations |
| `exhibit_timeline_record_tasks.test.js`    |  ~81 | Timeline item record operations |
| `indexer_index_tasks.test.js`              |  ~59 | Indexer / Elasticsearch document tasks |
| `permissions_tasks.test.js`                |  ~20 | Permission checks |
| `user_tasks.test.js`                       |  ~51 | User record operations |

Counts are approximate (derived from `test(`/`it(` call sites). Vitest reports 549 passing tests across these files in the current run.

### Coverage Areas (per record-task class)

- Constructor initialization
- Database / table validation
- UUID validation (versions 1–5)
- Data object validation and sanitization
- Protected-field enforcement (uuid, created, created_by, is_deleted)
- Timeout handling (`_with_timeout`)
- Record existence validation
- CRUD: create, read, update, soft-delete
- Publishing / suppressing (single and bulk)
- Reordering
- Timestamp updates
- Error handling and logging
- Edge cases: null/undefined, empty inputs, invalid formats

## Integration Tests (Jest — `test/integration/`)

| File | Pass | Skip |
|------|-----:|-----:|
| `exhibits_integration.test.js`   | 56 | 0 |
| `exhibits_model.test.js`         | 32 | 1 |
| `grid_integration.test.js`       | 54 | 0 |
| `grid_model.test.js`             | 50 | 1 |
| `headings_integration.test.js`   | 32 | 0 |
| `headings_model.test.js`         | 46 | 0 |
| `items_integration.test.js`      | 61 | 5 |
| `items_model.test.js`            | 65 | 0 |
| `timelines_integration.test.js`  | 46 | 0 |
| `timelines_model.test.js`        | 82 | 0 |

### Skipped Tests (7 total, all documented)

- **`items_integration.test.js` (5 skipped)** — covered the `delete_item_media` controller method, which has been removed from `items_controller.js`. The associated route registration and tests are skipped pending a replacement endpoint or test deletion.
- **`exhibits_model.test.js` (1 skipped)** — `should process media files when provided`. The media-handling pipeline was refactored from `process_uploaded_media` to `bind_hero_image` / `bind_thumbnail`; the test asserts a code path that no longer exists.
- **`grid_model.test.js` (1 skipped)** — `should process media files`. Same media-pipeline refactor as above.

### Coverage Areas (per module)

- CRUD operations through the full Route → Controller → Model flow
- State management (publish, suppress, unlock)
- Media operations (get, delete) where still applicable
- Token verification
- Authorization checks
- Input validation (UUIDs, length limits, path traversal)
- Security headers
- Error scenarios (404, 403, 400, 500)

## Test Quality Features

- ✅ External dependencies mocked (logger, tokens, authorize, configs)
- ✅ Both positive and negative test cases
- ✅ Edge case coverage
- ✅ Error scenario testing
- ✅ Integration test coverage across Route → Controller → Model
- ✅ Async operation testing
- ✅ Timeout handling
- ✅ Security testing (prototype pollution, path traversal, length limits)

## Maintenance Notes

When adding tests:

1. Put unit tests in `test/tasks/` (picked up by Vitest).
2. Put integration tests in `test/integration/` (picked up by Jest).
3. Update the per-file counts in this document.
4. Re-run `npm test` to confirm the totals.

When skipping tests, document the reason inline in the test file and add an entry to the **Skipped Tests** section above so the skip doesn't become invisible debt.

---

**Last Updated:** 2026-04-25
**License:** Apache-2.0
