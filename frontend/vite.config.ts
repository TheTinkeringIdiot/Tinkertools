import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    sourcemap: false
  },
  css: {
    devSourcemap: false
  },
  optimizeDeps: {
    exclude: ['vue-demi'],
    force: true
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
        secure: false
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});