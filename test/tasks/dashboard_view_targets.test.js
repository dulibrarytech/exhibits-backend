/**
 * Guard: every view the dashboard controller can render must have a source
 * view on disk.
 *
 * `test/smoke-views.js` only renders the views that EXIST, so it cannot catch a view
 * that was deleted while a controller still references it — which is exactly how the
 * timeline-items delete form went missing (the route + controller + client handler
 * survived; only the .ejs was gone, so the page 500'd at render time). This asserts
 * the controller -> view contract instead, and runs as part of `npm test`.
 *
 * The controller's 49 hand-written renderers were replaced by the PAGES table
 * (DRY review 2026-09-03, cluster O5), so the targets are read from that table
 * — the live one, required from the module, not a regex over the source — which
 * is a stronger check than scanning `res.render()` string literals ever was.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const CONTROLLER = require('../../dashboard/controller');
const VIEWS_DIR = path.join(BACKEND_ROOT, 'views');

// The controller renders `dist/<path>` (gulp builds views/dist/* from views/<path>.ejs).
// Map a render target back to its maintained SOURCE view — that is the artifact a
// developer can delete, and the root-cause invariant worth guarding.
const target_to_source = (target) => {
    const rel = target.replace(/^dist\//, '').replace(/\.ejs$/, '');
    return path.join(VIEWS_DIR, `${rel}.ejs`);
};

const render_targets = () => [...new Set(CONTROLLER.PAGES.map((page) => page.view))];

describe('dashboard controller view targets', () => {

    const targets = render_targets();

    test('the controller renders a meaningful number of views (parse sanity)', () => {
        expect(targets.length).toBeGreaterThan(20);
    });

    test('every PAGES entry is complete — a page with no view or nav would render blank', () => {
        for (const page of CONTROLLER.PAGES) {
            expect(typeof page.handler, JSON.stringify(page)).toBe('string');
            expect(typeof page.path, page.handler).toBe('string');
            expect(page.path.startsWith('/'), page.handler).toBe(true);
            expect(typeof page.view, page.handler).toBe('string');
            expect(page.nav, page.handler).toBeDefined();
            /* the table generates the named exports routes.js resolves */
            expect(typeof CONTROLLER[page.handler], page.handler).toBe('function');
        }
    });

    test('no two pages claim the same route path or export name', () => {
        const paths = CONTROLLER.PAGES.map((page) => page.path);
        const handlers = CONTROLLER.PAGES.map((page) => page.handler);

        expect(paths).toHaveLength(new Set(paths).size);
        expect(handlers).toHaveLength(new Set(handlers).size);
    });

    test('every page view resolves to a source view on disk', () => {
        const missing = targets
            .filter((target) => !fs.existsSync(target_to_source(target)))
            .map((target) => `${target}  ->  ${path.relative(BACKEND_ROOT, target_to_source(target))} (missing)`);

        expect(missing).toEqual([]);
    });

    test('the timeline-items delete form specifically exists (regression)', () => {
        expect(fs.existsSync(path.join(VIEWS_DIR, 'timeline-items', 'dashboard-timeline-items-delete-form.ejs'))).toBe(true);
    });
});
