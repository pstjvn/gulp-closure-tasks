This is a helper package to simplify how we utilize the closure compiler
to build our front-end scripts written with closure library and modules.

The following is required:

* gulp at version 4 and above (i.e. v4.0.0)
* google closure compiler for node
* google closure library for node
* source files for our app in `js` directory

Those two are expected to be injected in the exposed function and will
return a function that can be called with 2 parameters - the task name to
make and the google namespace to build.

Example:

_gulpfile.js_

```js
const gulp = require('gulp');
const gcc = require('google-closure-compiler').gulp();

// Last argument is should we print out the files used in the build.
const gccTaskCreator = require('gulp-closure-tasks')(gulp, gcc, true);
// Create task named 'example' and in it build 'my.namespace'
gccTaskCreator('example', 'my.namespace');
```

Now to build the minified file `my.namespace.min.js` in `build/` directory we can run:

```sh
./node_modules/.bin/gulp example
```

