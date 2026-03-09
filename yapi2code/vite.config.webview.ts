import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'webview'),
  build: {
    outDir: path.resolve(__dirname, 'dist/webview'),
    rollupOptions: {
      input: path.resolve(__dirname, 'webview/index.html'),
      output: {
        entryFileNames: 'main.js',
        assetFileNames: 'main.[ext]',
      },
    },
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'webview/src'),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
});
