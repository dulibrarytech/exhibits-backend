'use strict';

/**
 * No raw control characters in server-side source.
 *
 * Written after a real incident: a regex intended to read
 * `/[\u0000-\u001f\u007f-\u009f]/` was authored through tooling that decoded
 * those escape sequences, so the file ended up holding the actual NUL, 0x1F and
 * 0x7F BYTES. The regex still behaved identically and every test passed — the
 * only symptom was `git diff` reporting `Bin 1877 -> 5199 bytes`, because git
 * classifies a file containing NUL as binary.
 *
 * That failure mode is invisible in review (the source renders normally in an
 * editor) and it costs the file its diffs, its blame and its merge behaviour.
 * A byte-level scan is the only thing that catches it.
 *
 * Tab, newline and carriage return are allowed — they are ordinary whitespace.
 * Everything else in C0, plus DEL and the C1 range, is not.
 *
 * Scope is the server-side tree. public/ is excluded: it holds generated and
 * minified bundles, which are not hand-authored source.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

const SOURCE_ROOTS = [
    'libs',
    'media-library',
    'exhibits',
    'users',
    'auth',
    'indexer',
    'config',
    'tools',
    'migrations',
    'test'
];

/* C0 except tab (0x09), LF (0x0a) and CR (0x0d), plus DEL (0x7f). */
const FORBIDDEN_BYTES = new Set([
    ...Array.from({ length: 9 }, (unused, i) => i),
    0x0b,
    0x0c,
    ...Array.from({ length: 18 }, (unused, i) => 0x0e + i),
    0x7f
]);

/**
 * Recursively collects .js files, skipping node_modules.
 * @param {string} directory - Absolute directory path
 * @returns {string[]} Absolute file paths
 */
const collect_js_files = (directory) => {

    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {

        const full_path = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            return entry.name === 'node_modules' ? [] : collect_js_files(full_path);
        }

        return entry.name.endsWith('.js') ? [full_path] : [];
    });
};

/**
 * Finds forbidden control characters in a file's bytes.
 * @param {Buffer} bytes - File contents
 * @returns {string[]} Human-readable descriptions of what was found
 */
const find_control_characters = (bytes) => {

    const found = new Set();

    for (let i = 0; i < bytes.length; i++) {

        if (FORBIDDEN_BYTES.has(bytes[i])) {
            found.add(`0x${bytes[i].toString(16).padStart(2, '0')}`);
        }

        /* C1 (U+0080-U+009F) encodes as 0xc2 followed by 0x80-0x9f. */
        if (bytes[i] === 0xc2 && i + 1 < bytes.length && bytes[i + 1] >= 0x80 && bytes[i + 1] <= 0x9f) {
            found.add(`U+00${bytes[i + 1].toString(16)}`);
        }
    }

    return Array.from(found);
};

describe('server-side source files', () => {

    const files = SOURCE_ROOTS.flatMap((root) => collect_js_files(path.join(PROJECT_ROOT, root)));

    it('scans a meaningful number of files (the walk is not silently empty)', () => {
        expect(files.length).toBeGreaterThan(100);
    });

    it('contain no raw control characters', () => {

        const offenders = files
            .map((file) => ({
                file: path.relative(PROJECT_ROOT, file),
                found: find_control_characters(fs.readFileSync(file))
            }))
            .filter((result) => result.found.length > 0)
            .map((result) => `${result.file} contains ${result.found.join(', ')}`);

        expect(offenders).toEqual([]);
    });
});
