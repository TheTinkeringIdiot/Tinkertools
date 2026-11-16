import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { configDefaults } from 'vitest/config';

/**
 * Backend of the backend-dependent tests. BACKEND_URL alone moves both the
 * availability check and the API client the tests drive; an explicit
 * VITE_API_BASE_URL still wins.
 */
const testBackendUrl = process.env.BACKEND_URL?.replace(/\/+$/, '');
const testApiBase =
  testBackendUrl && !process.env.VITE_API_BASE_URL
    ? { VITE_API_BASE_URL: `${testBackendUrl}/api/v1` }
    : {};

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
    // e2e/ holds Playwright specs (npm run test:e2e); Vitest cannot run them.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 10000, // Default 10s for all tests
    hookTimeout: 10000,
    env: {
      // Backend availability check for integration tests
      VITE_BACKEND_URL: testBackendUrl || 'http://localhost:8000',
      ...testApiBase,
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
