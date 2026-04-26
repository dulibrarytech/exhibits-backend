#!/usr/bin/env node
/* Smoke-render every EJS view to catch missing includes / parse errors at commit time.
 * Rendering uses empty locals; ReferenceError (undefined locals) is ignored because the
 * purpose is to verify template structure, not data-binding. Any other error fails CI. */
'use strict';
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const VIEWS_DIR = path.resolve(__dirname, '..', 'views');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
});

const files = walk(VIEWS_DIR).filter((f) => f.endsWith('.ejs') && !/[\\/]partials[\\/]/.test(f));
let failed = 0;
for (const file of files) {
    try {
        ejs.render(fs.readFileSync(file, 'utf8'), {}, { filename: file, cache: false, compileDebug: false });
    } catch (err) {
        if (err instanceof ReferenceError) continue;
        failed++;
        console.error(`FAIL  ${path.relative(VIEWS_DIR, file)}\n      ${String(err.message).split('\n')[0]}`);
    }
}
if (failed) { console.error(`\n${failed}/${files.length} templates failed`); process.exit(1); }
console.log(`OK: ${files.length} templates rendered (or cleared include/parse checks)`);
