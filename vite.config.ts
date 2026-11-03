import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    fs: {
      strict: true,
      deny: [
        '.env',
        '.env.*',
        '**/*.{crt,pem,key,db,sqlite}',
        '**/server/**',
        '**/data/**',
        '**/.git/**',
      ],
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ['gsap', '@gsap/react'],
          markdown: ['react-markdown', 'remark-gfm'],
        },
      },
    },
  },
})
