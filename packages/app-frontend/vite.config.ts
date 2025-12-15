/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/app-frontend',
  mode: mode || 'production',
  server: {
    port: 4200,
    host: 'localhost',
    allowedHosts: [],
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    minify: mode === 'production' ? 'esbuild' : false,
  },
  define: {
    __webpack_public_path__: '""',
    'process.env.NODE_ENV': JSON.stringify(mode || 'production'),
  },
}));
