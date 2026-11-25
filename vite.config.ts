import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  // Older iPhones: transpile newer syntax (??=, etc.) down for Safari 14+.
  build: { target: ['es2020', 'safari14'] },
})
