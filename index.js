const del = require('del');
const fs = require('fs');
const gcc = require('google-closure-compiler').gulp();
const smap = require('gulp-sourcemaps');


/**
 * The locations we will be using.
 * @enum {string}
 * @protected
 */
const Location = {
  BASE: './',
  BUILD_DIR: './build/',
  FILELIST: 'nsfiles.txt',
  CL_SRC: 'js/**/*.js',
  CL_LIB_SRC: 'node_modules/google-closure-library/**/*.js',
  TMP_DIR: '.tmp/',
  EMPTY_FILE: 'notused.js',
  GCC_OPTS: 'options/compile.ini'
};


/**
 * The options to pass to closure compiler for collecting the files used by a
 * specified namespace.
 * @private {!Object}
 */
const ClosureCompilerCollectFilesOpts = {
  entry_point: '',
  dependency_mode: 'STRICT',
  output_manifest: Location.FILELIST,
  js_output_file: Location.EMPTY_FILE
};

/**
 * Flags for the build job in the compiler.
 * Note that most flags are provided via the compile.ini file and not from
 * here - also we are using the native compiler file reader to lower
 * memory consumption of the build process.
 * @private {!Object}
 */
const ClosureCompilerBuildOps = {
  dependency_mode: 'STRICT',
  // By default make production build.
  define: 'goog.DEBUG=false',
  process_closure_primitives: true,
  use_types_for_optimization: true,
  warning_level: 'VERBOSE',
  compilation_level: 'ADVANCED',
  entry_point: 'goog:',
  flagfile: 'options/compile.ini',
  js_output_file: '.min.js'
};


/**
 * Generates a new options object specific to a closure based namespace.
 * @param {string} ns
 * @return {!Object}
 */
const constructCompilerOpts = (ns) => {
  return Object.assign({}, ClosureCompilerCollectFilesOpts, {
    entry_point: `goog:${ns}`
  });
};


/**
 * Generates utilities to work with closure sources.
 *
 * @param {Object} gulpInstance Optionally an instance to work with,
 * if not provided the default one will be used (#4.0).
 * @param {Object} gccInstance The google closure compiler's gulp interface.
 * We require this to be injected in order to not depend on this package's
 * version of gcc, but intead allow the developer to select one and use it.
 * @param {boolean=} debug If we should print out which file we will be
 * using to build the final bundle.
 * @return {!Object}
 */
module.exports = function(gulpInstance, gccInstance, debug) {
  const gulp = gulpInstance;
  const gcc = gccInstance;
  const isDebugModeOn = !!debug;

  /**
   * Register task for collecting file list for closure entrypoint.
   * @param {string} entrypoint
   * @return {string} The generated gulp task name.
   */
  const registerNamespaceFileCollector = (entrypoint) => {
    const ns = `collect-files-for-${entrypoint}`;
    gulp.task(ns, () => {
      return gulp.src([Location.CL_SRC, Location.CL_LIB_SRC], {
        base: Location.BASE
      })
          .pipe(gcc(constructCompilerOpts(entrypoint)))
          .pipe(gulp.dest(Location.TMP_DIR))
    })
    return ns;
  };


  /**
   * Register a cleanup call.
   * @param {string} location
   * @return {string}
   */
  const registerCleanUp = (() => {
    let counter = 0;
    return (location) => {
      counter++;
      const ns = `cleanup-${location}-${counter}`;
      gulp.task(ns, (callback) => {
        del.sync(location);
        callback();
      });
      return ns;
    };
  })();


  /**
   * Creates a task for building the optimized version with gcc.
   * @param {string} entrypoint
   * @return {string} The task name to register with the task system.
   */
  const gccBuildNamespace = (entrypoint) => {
    const ns = `gcc-build-${entrypoint}`;
    gulp.task(ns, () => {
      const filelist = fs.readFileSync(Location.FILELIST, 'utf8')
          .split('\n');
      // cleanup empty line
      filelist.pop();
      const opts = [];
      for (const key in ClosureCompilerBuildOps) {
        let val = ClosureCompilerBuildOps[key];
        switch (key) {
          case 'entry_point':
            val = val + entrypoint;
            break;
          case 'js_output_file':
            val = entrypoint + val;
            break;
          case 'define':
            if (val.indexOf('goog.DEBUG') === 0) {
              val = isDebugModeOn ? 'goog.DEBUG=true' : 'goog.DEBUG=false';
            }
            break;
        }
        opts.push(`--${key}`);
        opts.push(val);
      }
      filelist.forEach(_ => {
        if (isDebugModeOn) console.log('Will be using: ' + _);
        opts.push('--js');
        opts.push(_);
      });
      return gcc(opts).src()
          .pipe(smap.write('/'))
          .pipe(gulp.dest(Location.BUILD_DIR))
    });
    return ns;
  };

  return (taskname, namespace) => {
    if (typeof namespace != 'string') throw new Error(
        'Cannot create closure build task without a namespace');
    if (typeof taskname != 'string') taskname = 'closure-build';
    return gulp.task(taskname, gulp.series(
      registerNamespaceFileCollector(namespace),
      registerCleanUp(Location.TMP_DIR),
      gccBuildNamespace(namespace),
      registerCleanUp(Location.FILELIST)
    ));
  };
};
