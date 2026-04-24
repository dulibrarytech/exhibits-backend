// JS minification has moved to esbuild. See `esbuild.config.js` and the
// `build:js` npm script — gulp is retained here only for CSS and EJS view
// minification, which esbuild does not handle.

const gulp = require('gulp');
const htmlmin = require('gulp-htmlmin');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const fs = require('node:fs/promises');
const path = require('node:path');

// Wipe views/dist before rebuilding so stale artifacts — renamed source
// partials, deleted templates, moved includes — cannot survive a build
// and mask bugs on one machine while breaking another. The minify-*
// tasks below copy from source into dist but never clean; without this
// step the dist directory only ever grows, and a stale file can keep a
// broken include path working locally until a fresh clone exposes it.
gulp.task('clean-views', function () {
    return fs.rm(path.join(__dirname, 'views', 'dist'), { recursive: true, force: true });
});

gulp.task('minify-css', function () {
    return gulp.src([
        'public/assets/css/style.css',
        'public/assets/css/cs-skin-elastic.css',
        'public/assets/css/datatables.overrides.css',
        'public/assets/css/sidebar-overrides.css',
        'public/assets/css/exhibits.common.css',
        'public/assets/css/media.library.css'
    ])
        .pipe(concat('dashboard.min.css'))
        .pipe(cleanCSS())
        .on('error', function (err) {
            console.error('Error in minify-css task:', err.toString());
            this.emit('end');
        })
        .pipe(gulp.dest('public/assets/dist'));
});

gulp.task('minify-exhibit-views', function () {
    return gulp.src([
        'views/exhibits/*.ejs'
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/exhibits'));
});

gulp.task('minify-exhibit-partial-views', function () {
    return gulp.src([
        'views/exhibits/partials/*.ejs',
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/exhibits/partials'));
});

gulp.task('minify-grid-item-views', function () {
    return gulp.src([
        'views/grid-items/*.ejs'
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/grid-items'));
});

gulp.task('minify-grid-item-partial-views', function () {
    return gulp.src([
        'views/grid-items/partials/*.ejs',
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/grid-items/partials'));
});

gulp.task('minify-heading-item-views', function () {
    return gulp.src([
        'views/heading-items/*.ejs'
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/heading-items'));
});

gulp.task('minify-heading-item-partial-views', function () {
    return gulp.src([
        'views/heading-items/partials/*.ejs',
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/heading-items/partials'));
});

gulp.task('minify-partial-views', function () {
    return gulp.src([
        'views/partials/*.ejs',
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/partials'));
});

gulp.task('minify-standard-item-views', function () {
    return gulp.src([
        'views/standard-items/*.ejs'
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/standard-items'));
});

gulp.task('minify-standard-item-partial-views', function () {
    return gulp.src([
        'views/standard-items/partials/*.ejs',
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/standard-items/partials'));
});

gulp.task('minify-timeline-item-views', function () {
    return gulp.src([
        'views/timeline-items/*.ejs'
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/timeline-items'));
});

gulp.task('minify-timeline-item-partial-views', function () {
    return gulp.src([
        'views/timeline-items/partials/*.ejs',
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/timeline-items/partials'));
});

gulp.task('minify-users-views', function () {
    return gulp.src([
        'views/users/*.ejs'
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/users'));
});

gulp.task('minify-users-partial-views', function () {
    return gulp.src([
        'views/users/partials/*.ejs',
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/users/partials'));
});

gulp.task('minify-views', function () {
    return gulp.src([
        'views/*.ejs',
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/'));
});

gulp.task('minify-media-library-views', function () {
    return gulp.src([
        'views/media-library/*.ejs'
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/media-library'));
});

gulp.task('minify-media-library-partial-views', function () {
    return gulp.src([
        'views/media-library/partials/*.ejs',
    ])
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('views/dist/media-library/partials'));
});

// clean-views runs first (series); all minify tasks then run concurrently.
// minify-css writes to public/assets/dist/ (a single concatenated file that
// always overwrites), so it does not participate in the clean step.
gulp.task('default', gulp.series(
    'clean-views',
    gulp.parallel(
        'minify-css',
        'minify-exhibit-views',
        'minify-exhibit-partial-views',
        'minify-grid-item-views',
        'minify-grid-item-partial-views',
        'minify-heading-item-views',
        'minify-heading-item-partial-views',
        'minify-standard-item-views',
        'minify-standard-item-partial-views',
        'minify-timeline-item-views',
        'minify-timeline-item-partial-views',
        'minify-users-views',
        'minify-users-partial-views',
        'minify-partial-views',
        'minify-views',
        'minify-media-library-views',
        'minify-media-library-partial-views'
    )
));