// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';

export default {
  input: ['src/index.js', 'src/cli.js'],
  output: {
    dir: 'lib',
    format: 'cjs'
  },
  plugins: [
    resolve(),
    babel({
      exclude: 'node_modules/**' // only transpile our source code
    })
  ],
  experimentalCodeSplitting: true,
  external: ['repl', 'fs', 'vm']
};
