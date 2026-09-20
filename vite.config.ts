import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'https://meetwo.pages.dev',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-livekit': ['livekit-client'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});
