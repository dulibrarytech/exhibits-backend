/**
 * Loads a browser-side public/app module into the jsdom test global.
 *
 * The public/app modules are plain scripts, not CommonJS/ESM: each one is
 * a top-level `const xModule = (function () { ... }());` IIFE that the
 * dashboard pages pull in via <script> tags. To exercise them under
 * Vitest we read the source, rewrite that one `const` to a
 * `globalThis.` assignment (a `const` inside eval'd code would be scoped
 * to the eval block and discarded), and run it through INDIRECT eval —
 * `(0, eval)` — so the script executes in the global scope exactly as a
 * <script> tag would, regardless of which module calls this helper.
 *
 * Every module reads its collaborators (helperModule, domModule,
 * authModule, ...) off the global scope at call time, so callers must
 * assign any stubs to globalThis BEFORE loading (see ./stubs.js).
 */

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

/* test/unit-app/helpers -> exhibits-backend root */
const BACKEND_ROOT = resolve(__dirname, '..', '..', '..');

/**
 * @param {string} relative_path  path from the backend root, e.g.
 *                                'public/app/utils/dom.module.js'
 * @param {string} export_name    the module's top-level const, e.g. 'domModule'
 * @returns {*} globalThis[export_name] after the script has run
 */
function load_browser_module(relative_path, export_name) {
    const src = readFileSync(resolve(BACKEND_ROOT, relative_path), 'utf8');
    const patched = src.replace(
        new RegExp(`^const\\s+${export_name}\\s*=`, 'm'),
        `globalThis.${export_name} =`,
    );
    // eslint-disable-next-line no-eval
    (0, eval)(patched);
    return globalThis[export_name];
}

module.exports = { load_browser_module };
