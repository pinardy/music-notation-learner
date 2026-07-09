import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Serve from /music-notation-learner/ on GitHub Pages
  base: process.env.GITHUB_ACTIONS ? '/music-notation-learner/' : '/',
  plugins: [react()],
})
