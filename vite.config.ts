import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/simchatalent/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: process.env.API_URL || 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    },
    plugins: [
      react()
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GOOGLE_API_KEY || env.GEMINI_API_KEY || ''),
      'process.env.GOOGLE_API_KEY': JSON.stringify(env.GOOGLE_API_KEY || env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    optimizeDeps: {
      exclude: ['@google/genai']
    }
  };
});
