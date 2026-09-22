import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { main: 'index.html', editor: 'editor.html' } } },
  server: { port: 5173, open: false },
});
