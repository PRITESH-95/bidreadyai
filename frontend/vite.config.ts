// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Vite dev server runs on 5173 by default – matches CORS config.
    port: 5173,
    strictPort: true,
  },
});

