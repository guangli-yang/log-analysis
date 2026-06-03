import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      include: '**/*.tsx',
      babel: {
        parserOpts: {
          plugins: ['decorators-legacy']
        }
      }
    })
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    ssr: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src', 'sync-panel-main.tsx'),
      output: {
        dir: path.resolve(__dirname, 'dist'),
        entryFileNames: 'sync-panel-bundle.js',
        format: 'iife',
        name: 'SyncPanel',
        sourcemap: false
      }
    }
  },
  esbuild: {
    jsx: 'automatic'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
})