/**
 * Guard: every `res.render()` target in the dashboard controller must have a source
 * view on disk.
 *
 * `test/smoke-views.js` only renders the views that EXIST, so it cannot catch a view
 * that was deleted while a controller still references it — which is exactly how the
 * timeline-items delete form went missing (the route + controller + client handler
 * survived; only the .ejs was gone, so the page 500'd at render time). This asserts
 * the controller -> view contract instead, and runs as part of `npm test`.
 *
 * Copyright 2025 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const CONTROLLER = path.join(BACKEND_ROOT, 'dashboard', 'controller.js');
const VIEWS_DIR = path.join(BACKEND_ROOT, 'views');

// The controller renders `dist/<path>` (gulp builds views/dist/* from views/<path>.ejs).
// Map a render target back to its maintained SOURCE view — that is the artifact a
// developer can delete, and the root-cause invariant worth guarding.
const target_to_source = (target) => {
    const rel = target.replace(/^dist\//, '').replace(/\.ejs$/, '');
    return path.join(VIEWS_DIR, `${rel}.ejs`);
};

const render_targets = () => {
    const src = fs.readFileSync(CONTROLLER, 'utf8');
    const re = /res\.render\(\s*['"]([^'"]+)['"]/g;
    const targets = new Set();
    let match;
    while ((match = re.exec(src)) !== null) {
        targets.add(match[1]);
    }
    return [...targets];
};

describe('dashboard controller view targets', () => {

    const targets = render_targets();

    test('the controller renders a meaningful number of views (parse sanity)', () => {
        expect(targets.length).toBeGreaterThan(20);
    });

    test('every res.render() target resolves to a source view on disk', () => {
        const missing = targets
            .filter((target) => !fs.existsSync(target_to_source(target)))
            .map((target) => `${target}  ->  ${path.relative(BACKEND_ROOT, target_to_source(target))} (missing)`);

        expect(missing).toEqual([]);
    });

    test('the timeline-items delete form specifically exists (regression)', () => {
        expect(fs.existsSync(path.join(VIEWS_DIR, 'timeline-items', 'dashboard-timeline-items-delete-form.ejs'))).toBe(true);
    });
});
