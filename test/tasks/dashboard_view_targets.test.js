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

/*
 * Guard: every sidebar nav icon must be a FontAwesome class.
 *
 * FontAwesome is the dashboard's only icon font. Bootstrap Icons and Themify
 * were removed on 2026-09-04 after a sweep of `views/` and `public/app`
 * reported zero usages — but NAV_CONFIGS lives in this controller, in neither
 * of those trees, and it held 14 of them. Every sidebar icon vanished. The
 * sweep was the bug; this test is the guard that makes the sweep unnecessary.
 *
 * The two shapes differ because the template does:
 *   links:  <i class="menu-icon <%= link.icon %>">        -> needs "fa fa-x"
 *   back:   <i class="menu-icon fa <%= nav.back.icon %>"> -> needs "fa-x" only
 */
describe('dashboard nav icons use the one icon font', () => {

    const nav_configs = () => {
        const seen = new Map();
        for (const page of CONTROLLER.PAGES) {
            if (page.nav && !seen.has(page.nav)) {
                seen.set(page.nav, page.handler);
            }
        }
        return [...seen.entries()];
    };

    test('every link icon carries the full FontAwesome class, or inline SVG', () => {
        const offenders = [];

        for (const [nav, handler] of nav_configs()) {
            for (const link of nav.links || []) {
                /* A link declares exactly one of `icon` or `icon_svg`. */
                if (typeof link.icon_svg === 'string') {
                    continue;
                }
                if (typeof link.icon !== 'string' || !/^fa fa-[a-z0-9-]+/.test(link.icon)) {
                    offenders.push(`${handler} -> ${link.label}: ${JSON.stringify(link.icon)}`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });

    test('an inline SVG icon is self-contained and inherits colour', () => {
        const offenders = [];

        for (const [nav, handler] of nav_configs()) {
            for (const link of nav.links || []) {
                if (typeof link.icon_svg !== 'string') {
                    continue;
                }
                const label = `${handler} -> ${link.label}`;

                if (link.icon !== undefined) {
                    offenders.push(`${label}: declares both icon and icon_svg`);
                }
                if (!/^<svg[\s>]/.test(link.icon_svg.trim()) || !link.icon_svg.includes('</svg>')) {
                    offenders.push(`${label}: icon_svg is not a complete <svg> element`);
                }
                /* currentColor is what makes it match the font icons' colour
                   and hover state; a hard-coded fill would not. */
                if (!link.icon_svg.includes('currentColor')) {
                    offenders.push(`${label}: icon_svg does not use currentColor`);
                }
                /* Sized in CSS (.menu-icon-svg svg) so it tracks the nav's
                   font-size; an inline width/height would defeat that. */
                if (/\sstyle=/.test(link.icon_svg)) {
                    offenders.push(`${label}: icon_svg carries inline styles`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });

    test('every back icon is a bare fa-* class (the template supplies the fa prefix)', () => {
        const offenders = [];

        for (const [nav, handler] of nav_configs()) {
            if (!nav.back || nav.back.icon === undefined) {
                continue;
            }
            if (typeof nav.back.icon !== 'string' || !/^fa-[a-z0-9-]+$/.test(nav.back.icon)) {
                offenders.push(`${handler} -> back: ${JSON.stringify(nav.back.icon)}`);
            }
        }

        expect(offenders).toEqual([]);
    });

    test('no nav icon references a removed icon font', () => {
        const removed = /(^|\s)(bi|ti)-|(^|\s)bi\s/;
        const offenders = [];

        for (const [nav, handler] of nav_configs()) {
            const icons = (nav.links || []).map((l) => l.icon).filter((i) => typeof i === 'string');
            if (nav.back && nav.back.icon) {
                icons.push(nav.back.icon);
            }
            for (const icon of icons) {
                if (typeof icon === 'string' && removed.test(icon)) {
                    offenders.push(`${handler}: ${icon}`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });
});
