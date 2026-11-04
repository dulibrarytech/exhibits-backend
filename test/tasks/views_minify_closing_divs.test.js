/**
 * Guard: minifying a view must never add `</div>` tags.
 *
 * Copyright 2026 University of Denver
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier');

const VIEWS_DIR = path.resolve(__dirname, '..', '..', 'views');

const MINIFY_OPTIONS = { collapseWhitespace: true };

const source_views = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
        return entry.name === 'dist' ? [] : source_views(full);
    }

    return entry.name.endsWith('.ejs') ? [full] : [];
});

const count_closing_divs = (html) => (html.match(/<\/div\s*>/gi) || []).length;

test('minifying the source views adds no </div> tags', () => {
    const views = source_views(VIEWS_DIR);

    const gained_divs = views.filter((view) => {
        const source = fs.readFileSync(view, 'utf8');
        return count_closing_divs(minify(source, MINIFY_OPTIONS)) > count_closing_divs(source);
    }).map((view) => path.relative(VIEWS_DIR, view));

    expect(views.length).toBeGreaterThan(50);
    expect(gained_divs).toEqual([]);
});
