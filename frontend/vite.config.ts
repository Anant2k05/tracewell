import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend talks to the FastAPI backend directly via VITE_API_BASE_URL
// (see .env.example). The backend's CORS config already accepts any origin
// for Bearer-token requests, so no dev proxy is required.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
});
