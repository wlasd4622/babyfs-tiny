var gulp = require('gulp');
var babel = require('gulp-babel');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var eslint = require('gulp-eslint');

gulp.task('eslint', function () {
    return gulp.src(['./src/**/*.js', './conf/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('mocha', function () {});

gulp.task('clean', ['eslint'], function () {
    return del([
        './dist/**/*'
    ]);
});

gulp.task('development_build', ['clean'], function () {
    return gulp.src('./src/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.', {includeContent: false, sourceRoot: '../src'}))
    .pipe(gulp.dest('./dist'));
});

gulp.task('production_build', ['clean'], function () {
    return gulp.src('./src/**/*.js')
    .pipe(babel())
    .pipe(gulp.dest('./dist'));
});

gulp.task('debug', ['development_build'], function () {
    require('./dist/index');
});

gulp.task('default', ['production_build']);

gulp.task('build', ['development_build']);
