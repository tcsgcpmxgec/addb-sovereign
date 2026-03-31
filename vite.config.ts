import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  console.log('Vite build mode:', mode);
  console.log('GEMINI_API_KEY present:', !!env.GEMINI_API_KEY);
  return {
    root: 'frontend',
    base: '/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'frontend/src'),
      },
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
