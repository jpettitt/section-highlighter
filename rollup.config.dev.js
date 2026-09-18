import resolve from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/section-highlighter.ts',
  output: {
    file: 'dist/section-highlighter.js',
    format: 'es',
    inlineDynamicImports: true,
  },
  plugins: [
    resolve(),
    typescript(),
    serve({ contentBase: './dist', host: '0.0.0.0', port: 5000, allowCrossOriginRequests: true }),
  ],
};
