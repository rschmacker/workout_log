import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app from https://rschmacker.github.io/workout_log/
  // so all asset URLs need this prefix. Must match the GitHub repo name.
  base: '/workout_log/',
  server: {
    // Listen on the local network too, so you can open the dev server on your iPhone
    host: true,
  },
})
