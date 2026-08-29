# Exhibit Builder — Test Suite

Server-side test suite for the Exhibit Builder backend.

## Overview

The suite is split across three runners:

- **Vitest** owns unit tests under `test/tasks/` (server-side record tasks, indexer projections, helpers) and `test/unit-app/` (browser-side `public/app/*` client modules; each file opts into jsdom via a `// @vitest-environment jsdom` directive).
- **Jest** owns integration tests under `test/integration/`. Used because Vitest's `vi.mock` cannot intercept the transitive CommonJS `require()` chains that the source modules rely on; Jest patches `require()` directly and so its module mocks work end-to-end.
- **Playwright** owns e2e tests under `test/e2e/` — stubbed client-behavior specs in `specs/` (default mode) and full-stack workflow specs in `live/` (`PW_MODE=live`, dedicated `exhibits_e2e` DB). See `playwright.config.js` for the mode mechanics.

`npm test` runs unit then integration; `npm run test:predeploy` adds both e2e modes.

## Layout

```
test/
├── README.md                   # this file
├── TEST_SUMMARY.md             # baseline counts and coverage notes
├── setup.js                    # Vitest setup (jest→vi shim for legacy syntax)
├── smoke-views.js              # EJS view smoke checks (npm run test:views)
├── tasks/                      # server-side unit tests (Vitest)
├── unit-app/                   # browser-side client-module unit tests (Vitest + jsdom)
├── integration/                # route/controller/model tests (Jest) — see integration/README.md
└── e2e/                        # Playwright
    ├── specs/                  # stubbed client-behavior specs (default mode)
    ├── fixtures/, helpers/     # stub-mode API stubs, auth bypass, bootstrap
    └── live/                   # full-stack workflow specs (PW_MODE=live) + live fixtures
```

Configuration lives at the project root, not inside `test/`:

- `vitest.config.js` — Vitest config (scopes to `test/tasks/**` and `test/unit-app/**`).
- `jest.integration.config.js` — Jest config (scopes to `test/integration/**/*.test.js`).
- `jest.integration.setup.js` — Jest `setupFilesAfterEnv` file (custom matchers, globals).
- `playwright.config.js` — Playwright config (stub vs live mode, ports, e2e DB).

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

As of 2026-08-28:

| Runner | Files | Pass | Skip |
|--------|------:|-----:|-----:|
| Vitest (unit: tasks 34 + unit-app 19) | 53 | 1021 | 0 |
| Jest (integration)                    | 28 | 577 | 0 |
| **Total**                             | **81** | **1598** | **0** |

Playwright adds 48 stubbed specs plus 10 live specs (run separately; not part of `npm test`).

There are no unconditionally skipped tests. The only conditional skips are the two `@external` live e2e specs (`media-kaltura-import`, `media-repo-import`), which skip unless `PW_EXTERNAL=1` because they need VPN-reachable external services — run them via `npm run test:e2e:live:external`.

## Mocking

Unit tests (Vitest) use `vi.fn()` / `vi.mock()`. A small shim in `test/setup.js` exposes a `jest` global that delegates to `vi`, which keeps older Jest-style call sites working without rewrites.

Integration tests (Jest) use `jest.fn()` / `jest.mock()` directly. Jest patches Node's module loader, so mocks declared at the top of an integration test file intercept all transitive `require()` calls into the source tree.

For a deeper walkthrough of the integration mocking strategy, see `test/integration/README.md`.

## Adding Tests

- **New record-task / module unit test:** put it in `test/tasks/` and follow the patterns in the existing files. It will be picked up by Vitest automatically.
- **New client-module unit test:** put it in `test/unit-app/`, start the file with `// @vitest-environment jsdom`, and follow the existing load-and-eval pattern for `public/app/*` modules.
- **New route/controller/model integration test:** put it in `test/integration/` and follow the patterns in `exhibits_integration.test.js`. Jest will pick it up automatically.
- **New e2e spec:** stubbed client behavior goes in `test/e2e/specs/`; full-stack workflows go in `test/e2e/live/` (tag `@external` if it needs VPN-reachable services).

Avoid long-lived `test.skip` / `describe.skip`: when a refactor invalidates a test, rewrite it against the new code path in the same change. When suite shape changes materially, refresh the baseline table here and in `TEST_SUMMARY.md`.

## License

Copyright 2025 University of Denver. Licensed under the Apache License, Version 2.0.
