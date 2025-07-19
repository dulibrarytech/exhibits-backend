const gulp = require('gulp');
const uglify = require('gulp-uglify');
const htmlmin = require('gulp-htmlmin');
const rename = require('gulp-rename');

gulp.task('minify-exhibit-modules', function () {
    return gulp.src([
        'public/app/exhibits/exhibits.add.form.module.js',
        'public/app/exhibits/exhibits.common.form.module.js',
        'public/app/exhibits/exhibits.details.module.js',
        'public/app/exhibits/exhibits.edit.form.module.js',
        'public/app/exhibits/exhibits.module.js',
        'public/app/exhibits/nav.module.js'
    ])
        .pipe(uglify())
        .on('error', function (err) {
            console.error('Error in minify-exhibit-modules task:', err.toString());
            this.emit('end'); // End the task to prevent Gulp from crashing
        })
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('public/app/dist'));
});

gulp.task('minify-grid-items-modules', function () {
    return gulp.src([
        'public/app/grid-items/items.add.grid.form.module.js',
        'public/app/grid-items/items.add.grid.item.form.module.js',
        'public/app/grid-items/items.common.grid.form.module.js',
        'public/app/grid-items/items.common.grid.item.form.module.js',
        'public/app/grid-items/items.details.grid.item.module.js',
        'public/app/grid-items/items.edit.grid.form.module.js',
        'public/app/grid-items/items.edit.grid.item.form.module.js',
        'public/app/grid-items/items.grid.module.js'
    ])
        .pipe(uglify())
        .on('error', function (err) {
            console.error('Error in minify-grid-items-modules task:', err.toString());
            this.emit('end'); // End the task to prevent Gulp from crashing
        })
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('public/app/dist'));
});

gulp.task('minify-heading-items-modules', function () {
    return gulp.src([
        'public/app/heading-items/items.add.heading.form.module.js',
        'public/app/heading-items/items.common.heading.form.module.js',
        'public/app/heading-items/items.details.heading.item.module.js',
        'public/app/heading-items/items.edit.heading.form.module.js'
    ])
        .pipe(uglify())
        .on('error', function (err) {
            console.error('Error in minify-heading-items-modules task:', err.toString());
            this.emit('end'); // End the task to prevent Gulp from crashing
        })
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('public/app/dist'));
});

gulp.task('minify-standard-items-modules', function () {
    return gulp.src([
        'public/app/standard-items/items.add.standard.item.form.module.js',
        'public/app/standard-items/items.common.standard.item.form.module.js',
        'public/app/standard-items/items.details.standard.item.module.js',
        'public/app/standard-items/items.edit.standard.item.form.module.js'
    ])
        .pipe(uglify())
        .on('error', function (err) {
            console.error('Error in minify-standard-items-modules task:', err.toString());
            this.emit('end'); // End the task to prevent Gulp from crashing
        })
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('public/app/dist'));
});

gulp.task('minify-timeline-items-modules', function () {
    return gulp.src([
        'public/app/timeline-items/items.add.vertical.timeline.form.module.js',
        'public/app/timeline-items/items.add.vertical.timeline.item.form.module.js',
        'public/app/timeline-items/items.common.vertical.timeline.form.module.js',
        'public/app/timeline-items/items.common.vertical.timeline.item.form.module.js',
        'public/app/timeline-items/items.edit.vertical.timeline.form.module.js',
        'public/app/timeline-items/items.edit.vertical.timeline.item.form.module.js',
        'public/app/timeline-items/items.timeline.module.js'
    ])
        .pipe(uglify())
        .on('error', function (err) {
            console.error('Error in minify-timeline-items-modules task:', err.toString());
            this.emit('end'); // End the task to prevent Gulp from crashing
        })
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('public/app/dist'));
});

gulp.task('minify-utils-modules', function () {
    return gulp.src([
        'public/app/utils/auth.module.js',
        'public/app/utils/config.module.js',
        'public/app/utils/dom.module.js',
        'public/app/utils/endpoints.module.js',
        'public/app/utils/helper.module.js',
        'public/app/utils/http.module.js',
        'public/app/utils/uploads.module.js'
    ])
        .pipe(uglify())
        .on('error', function (err) {
            console.error('Error in minify-utils-modules task:', err.toString());
            this.emit('end'); // End the task to prevent Gulp from crashing
        })
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('public/app/dist'));
});

gulp.task('minify-modules', function () {
    return gulp.src([
        'public/app/home.module.js',
        'public/app/items.list.displays.module.js',
        'public/app/items.module.js',
        'public/app/recycle.module.js',
        'public/app/user.module.js'
    ])
        .pipe(uglify())
        .on('error', function (err) {
            console.error('Error in minify-modules task:', err.toString());
            this.emit('end'); // End the task to prevent Gulp from crashing
        })
        .pipe(rename({suffix: '.min'}))
        .pipe(gulp.dest('public/app/dist'));
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

gulp.task('default', gulp.parallel(
    'minify-exhibit-modules',
    'minify-grid-items-modules',
    'minify-heading-items-modules',
    'minify-standard-items-modules',
    'minify-timeline-items-modules',
    'minify-utils-modules',
    'minify-modules',
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
    'minify-views'
));