import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port: process.env.PORT || 4173,
    host: '0.0.0.0',
  },
})
