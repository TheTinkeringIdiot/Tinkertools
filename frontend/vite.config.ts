import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    sourcemap: false,
  },
  css: {
    devSourcemap: false,
  },
  optimizeDeps: {
    exclude: ['vue-demi'],
    force: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    sourcemapIgnoreList: () => true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 10000, // Default 10s for all tests
    hookTimeout: 10000,
    env: {
      // Backend availability check for integration tests
      VITE_BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/tests/**',
        '**/__tests__/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
