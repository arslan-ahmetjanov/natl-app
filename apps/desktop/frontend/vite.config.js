import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        // curlconverter browser bundle hardcodes "/tree-sitter.wasm".
        // Redirect parser module to a local shim with proper asset URLs.
        find: /curlconverter\/dist\/src\/shell\/(webParser|Parser)\.js$/,
        replacement: fileURLToPath(new URL('./src/shims/curlconverterWebParser.js', import.meta.url)),
      },
    ],
  },
  base: './',
  // Dev pre-bundle uses esbuild; default targets forbid top-level await used by curlconverter shim.
  esbuild: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    // curlconverter / tree-sitter use top-level await
    target: 'esnext',
  },
});
