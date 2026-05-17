import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    'process.env': {},
  },
  build: {
    copyPublicDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/embed.tsx'),
      name: 'SysViz',
      formats: ['iife'],
      fileName: () => 'sysviz.js',
    },
    cssFileName: 'sysviz',
  },
});
