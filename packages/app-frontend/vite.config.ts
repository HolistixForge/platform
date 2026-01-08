/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/app-frontend',
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
      babel: {
        plugins: [
          [
            '@babel/plugin-transform-react-jsx',
            {
              runtime: 'automatic',
              // Use production JSX for builds (default mode is 'production')
              // Use development JSX for dev server (mode is 'development')
              development: mode === 'development',
            },
          ],
        ],
      },
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
  },
  define: {
    __webpack_public_path__: '""',
  },
}));
