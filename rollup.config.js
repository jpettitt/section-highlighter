import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/section-highlighter.ts',
  output: {
    file: 'dist/section-highlighter.js',
    format: 'es',
    inlineDynamicImports: true,
  },
  plugins: [resolve(), typescript(), terser()],
};
