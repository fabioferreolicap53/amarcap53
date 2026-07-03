import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isDev = mode === 'development';
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(!isDev ? [compression({ algorithm: 'gzip' })] : []),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/lucide-react')) return 'ui';
            if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs')) return 'charts';
            if (id.includes('node_modules/pocketbase')) return 'pocketbase';
            if (id.includes('node_modules/react')) return 'vendor';
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      strictPort: false,
      port: 3000,
    },
  };
});
