import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import uglify from 'rollup-plugin-uglify';

import sass from 'rollup-plugin-sass';
import postcss from 'postcss';
import cssnano from 'cssnano';
import inlinesvg from 'postcss-inline-svg';

import pkg from './package.json';

export default [
  // browser-friendly UMD build
  {
    entry: 'src/index.js',
    dest: pkg.browser,
    format: 'umd',
    moduleName: 'Bindery',
    banner: `/* 📖 Bindery v${pkg.version} */`,
    sourceMap: true,
    plugins: [
      resolve(),
      commonjs(),
      sass({
        insert: true,
        processor: css => postcss([cssnano(), inlinesvg()])
          .process(css)
          .then((result) => {
            console.log(result.css);
            return result.css;
          }),
      }),
      babel({
        exclude: ['node_modules/**'],
      }),
    ],
  },

  // minified browser-friendly UMD build
  {
    entry: 'src/index.js',
    dest: 'dist/bindery.min.js',
    format: 'iife',
    moduleName: 'Bindery',
    banner: `/* 📖 Bindery v${pkg.version} */`,
    sourceMap: true,
    plugins: [
      resolve(),
      commonjs(),
      sass({ insert: true }),
      uglify(),
      babel({
        exclude: ['node_modules/**'],
      }),
    ],
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // the `targets` option which can specify `dest` and `format`)
  {
    entry: 'src/index.js',
    banner: `/* 📖 Bindery v${pkg.version} */`,
    external: ['hyperscript'],
    targets: [
      { dest: pkg.main, format: 'cjs' },
      { dest: pkg.module, format: 'es' },
    ],
    plugins: [
      resolve(),
      sass({ insert: true }),
      babel({
        exclude: ['node_modules/**'],
      }),
    ],
  },
];
