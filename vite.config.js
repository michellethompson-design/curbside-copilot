import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend lives in web/. Its build output goes to web/dist, which the
// Express server serves statically in production. In dev, Vite proxies API
// calls to the Express server on port 8787.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
