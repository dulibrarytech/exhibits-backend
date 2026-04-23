/**
 * esbuild-based JS build pipeline for the Exhibits admin client.
 *
 * Each source file in `public/app/**` is minified, transpiled to the target
 * ES version, and written to `public/app/dist/<basename>.min.js` with a
 * companion `.map` source map. Subdirectories are flattened to match the
 * pre-existing dist/ layout that the EJS <script src> tags reference.
 *
 * Run: `node esbuild.config.js` (or `npm run build:js`).
 */

'use strict';

const esbuild = require('esbuild');
const path = require('path');

const OUT_DIR = 'public/app/dist';

// ES2017 drops requirements for optional chaining (?.), nullish coalescing
// (??), and logical assignment operators (||= &&= ??=), covering every
// ES2018–2021 feature currently in the source. Adjust if the supported
// browser matrix narrows or widens.
const TARGET = ['es2017'];

// Source files match the lists the gulp minify-*-modules tasks used to
// drive. Keep this authoritative — add a new source file here and its
// .min.js appears on next build.
const sources = [

    // exhibits
    'public/app/exhibits/exhibits.add.form.module.js',
    'public/app/exhibits/exhibits.common.form.module.js',
    'public/app/exhibits/exhibits.details.module.js',
    'public/app/exhibits/exhibits.edit.form.module.js',
    'public/app/exhibits/exhibits.module.js',
    'public/app/exhibits/exhibits.styles.module.js',
    'public/app/exhibits/exhibits.styles.form.module.js',

    // grid-items
    'public/app/grid-items/items.add.grid.form.module.js',
    'public/app/grid-items/items.add.grid.item.form.module.js',
    'public/app/grid-items/items.common.grid.form.module.js',
    'public/app/grid-items/items.common.grid.item.form.module.js',
    'public/app/grid-items/items.details.grid.module.js',
    'public/app/grid-items/items.details.grid.item.module.js',
    'public/app/grid-items/items.edit.grid.form.module.js',
    'public/app/grid-items/items.edit.grid.item.form.module.js',
    'public/app/grid-items/items.grid.module.js',

    // heading-items
    'public/app/heading-items/items.add.heading.form.module.js',
    'public/app/heading-items/items.common.heading.form.module.js',
    'public/app/heading-items/items.details.heading.item.module.js',
    'public/app/heading-items/items.edit.heading.form.module.js',

    // standard-items
    'public/app/standard-items/items.add.standard.item.form.module.js',
    'public/app/standard-items/items.common.standard.item.form.module.js',
    'public/app/standard-items/items.details.standard.item.module.js',
    'public/app/standard-items/items.edit.standard.item.form.module.js',

    // timeline-items
    'public/app/timeline-items/items.add.vertical.timeline.form.module.js',
    'public/app/timeline-items/items.add.vertical.timeline.item.form.module.js',
    'public/app/timeline-items/items.common.vertical.timeline.form.module.js',
    'public/app/timeline-items/items.common.vertical.timeline.item.form.module.js',
    'public/app/timeline-items/items.edit.vertical.timeline.form.module.js',
    'public/app/timeline-items/items.edit.vertical.timeline.item.form.module.js',
    'public/app/timeline-items/items.details.vertical.timeline.module.js',
    'public/app/timeline-items/items.details.vertical.timeline.item.module.js',
    'public/app/timeline-items/items.timeline.module.js',

    // utils
    'public/app/utils/auth.module.js',
    'public/app/utils/dom.module.js',
    'public/app/utils/endpoints.module.js',
    'public/app/utils/helper.module.js',
    'public/app/utils/http.module.js',
    'public/app/utils/lock.module.js',
    'public/app/utils/reorder.module.js',
    'public/app/utils/media.picker.module.js',
    'public/app/utils/nav.module.js',

    // top-level modules
    'public/app/home.module.js',
    'public/app/items.list.displays.module.js',
    'public/app/items.module.js',
    'public/app/recycle.module.js',
    'public/app/user.module.js',

    // media-library
    'public/app/media-library/helper.media.library.module.js',
    'public/app/media-library/helper.repo.subjects.module.js',
    'public/app/media-library/kaltura.service.module.js',
    'public/app/media-library/media.library.module.js',
    'public/app/media-library/modals.delete.module.js',
    'public/app/media-library/modals.edit.module.js',
    'public/app/media-library/modals.kaltura.module.js',
    'public/app/media-library/modals.repo.module.js',
    'public/app/media-library/modals.upload.module.js',
    'public/app/media-library/repo.pagination.module.js',
    'public/app/media-library/repo.service.module.js',
    'public/app/media-library/media.uploads.module.js'
];

async function build_all() {

    const start = Date.now();

    const builds = sources.map(function (src) {

        const basename = path.basename(src, '.js');
        const outfile = path.join(OUT_DIR, basename + '.min.js');

        // No `bundle: true` and no `format` — each file is already an IIFE
        // attaching a global (authModule, helperModule, …). esbuild keeps
        // the top-level structure so those globals stay reachable from
        // other <script> tags.
        return esbuild.build({
            entryPoints: [src],
            outfile: outfile,
            minify: true,
            sourcemap: true,
            target: TARGET,
            logLevel: 'warning'
        }).catch(function (err) {
            console.error('Error building ' + src + ':', err.message);
            throw err;
        });
    });

    await Promise.all(builds);

    console.log('esbuild: built ' + sources.length + ' bundles in ' + (Date.now() - start) + 'ms');
}

build_all().catch(function (err) {
    console.error(err);
    process.exit(1);
});
