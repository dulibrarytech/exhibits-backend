#!/usr/bin/env node
'use strict';

/**
 * Installs the jQuery / Popper.js / Bootstrap dist files into
 * `public/libs/` at the paths referenced by modified-40's
 * `views/partials/exhibits-libs-common.ejs`.
 *
 * Run once after applying the modified-40 EJS patches:
 *
 *     node tools/install-cdn-libs.js
 *
 * Pulls the packages with `npm install --no-save` so they don't
 * pollute `package.json`. After copying the dist files into
 * `public/libs/`, leaves the temporary `node_modules` entries
 * in place (they're harmless; remove with `npm prune` if desired).
 *
 * Idempotent — re-running just re-copies the files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGES = [
    {
        spec: 'jquery@3.7.0',
        src: 'jquery/dist/jquery.min.js',
        dest: 'public/libs/jquery-3.x/jquery-3.7.0.min.js',
    },
    {
        spec: 'popper.js@1.16.1',
        src: 'popper.js/dist/umd/popper.min.js',
        dest: 'public/libs/popper.js-1.x/popper.min.js',
    },
    {
        spec: 'bootstrap@4.6.2',
        src: 'bootstrap/dist/js/bootstrap.min.js',
        dest: 'public/libs/bootstrap-4.x/dist/js/bootstrap.min.js',
    },
];

function main() {

    const cwd = process.cwd();

    // Sanity check: must be run from the repo root.
    if (!fs.existsSync(path.join(cwd, 'package.json'))) {
        console.error('ERROR: run from repo root (no package.json found here).');
        process.exit(1);
    }

    if (!fs.existsSync(path.join(cwd, 'public', 'libs'))) {
        console.error(`ERROR: public/libs/ not found in ${cwd}. Wrong directory?`);
        process.exit(1);
    }

    console.log('Installing CDN library mirrors into public/libs/...\n');

    const specs = PACKAGES.map((p) => p.spec).join(' ');

    try {
        execSync(`npm install --no-save ${specs}`, { stdio: 'inherit', cwd });
    } catch (err) {
        console.error('\nERROR: npm install failed. See output above.');
        process.exit(1);
    }

    console.log('');

    for (const pkg of PACKAGES) {
        const src = path.resolve(cwd, 'node_modules', pkg.src);
        const dest = path.resolve(cwd, pkg.dest);

        if (!fs.existsSync(src)) {
            console.error(`ERROR: source file not found after install: ${src}`);
            process.exit(1);
        }

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
        console.log(`✓ ${pkg.dest}`);
    }

    console.log('\nDone. Reload any open dashboard pages to pick up the new sources.');
    console.log('The modified-40 EJS patches should now resolve cleanly.');
}

main();
