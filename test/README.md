# Exhibit Builder — Test Suite

Server-side test suite for the Exhibit Builder backend.

## Overview

The suite is split across two runners:

- **Vitest** owns unit tests under `test/tasks/`. Fast, in-process, used for record-task and other isolated module tests.
- **Jest** owns integration tests under `test/integration/`. Used because Vitest's `vi.mock` cannot intercept the transitive CommonJS `require()` chains that the source modules rely on; Jest patches `require()` directly and so its module mocks work end-to-end.

Both runners are wired together by the top-level `npm test` script.

## Layout

```
test/
├── README.md                   # this file
├── TEST_SUMMARY.md             # per-file test counts and coverage notes
├── setup.js                    # Vitest setup (jest→vi shim for legacy syntax)
├── tasks/                      # unit tests (Vitest)
│   ├── auth_tasks.test.js
│   ├── exhibit_record_tasks.test.js
│   ├── exhibit_heading_record_tasks.test.js
│   ├── exhibit_item_record_tasks.test.js
│   ├── exhibit_grid_record_tasks.test.js
│   ├── exhibit_timeline_record_tasks.test.js
│   ├── indexer_index_tasks.test.js
│   ├── permissions_tasks.test.js
│   └── user_tasks.test.js
└── integration/                # integration tests (Jest) — see integration/README.md
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

Configuration lives at the project root, not inside `test/` (which is gitignored):

- `vitest.config.js` — Vitest config (scopes to `test/tasks/**/*.test.js`).
- `jest.integration.config.js` — Jest config (scopes to `test/integration/**/*.test.js`).
- `jest.integration.setup.js` — Jest `setupFilesAfterEnv` file (custom matchers, globals).

## Running Tests

From the project root:

```bash
# Run everything (unit then integration)
npm test

# Run only the Vitest unit suite
npm run test:unit

# Run only the Jest integration suite
npm run test:integration

# Single integration file
npx jest --config jest.integration.config.js exhibits_integration.test.js

# Single unit file
npx vitest --run test/tasks/exhibit_record_tasks.test.js
```

## Current Baseline

| Runner | Files | Pass | Skip |
|--------|------:|-----:|-----:|
| Vitest (unit)        |  9 | 549 | 0 |
| Jest (integration)   | 10 | 524 | 7 |
| **Total**            | **19** | **1073** | **7** |

The 7 skipped tests are explicitly documented in their files:

- 5 in `items_integration.test.js` — covered the removed `delete_item_media` controller method.
- 1 in `exhibits_model.test.js` and 1 in `grid_model.test.js` — covered `process_uploaded_media`, which was refactored into `bind_hero_image` / `bind_thumbnail` paths.

## Mocking

Unit tests (Vitest) use `vi.fn()` / `vi.mock()`. A small shim in `test/setup.js` exposes a `jest` global that delegates to `vi`, which keeps older Jest-style call sites working without rewrites.

Integration tests (Jest) use `jest.fn()` / `jest.mock()` directly. Jest patches Node's module loader, so mocks declared at the top of an integration test file intercept all transitive `require()` calls into the source tree.

For a deeper walkthrough of the integration mocking strategy, see `test/integration/README.md`.

## Adding Tests

- **New record-task / module unit test:** put it in `test/tasks/` and follow the patterns in the existing files. It will be picked up by Vitest automatically.
- **New route/controller/model integration test:** put it in `test/integration/` and follow the patterns in `exhibits_integration.test.js`. Jest will pick it up automatically.

When adding tests, update `TEST_SUMMARY.md` so the per-file counts stay accurate.

## License

Copyright 2025 University of Denver. Licensed under the Apache License, Version 2.0.
