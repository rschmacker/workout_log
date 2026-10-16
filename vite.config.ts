import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { parseWorkout } from './src/workoutFormat.ts'

const WORKOUTS_DIR = fileURLToPath(new URL('./workouts/', import.meta.url))

// Checks all workout files (workouts/*.json) and stops the build with a clear
// message if one is wrong. Runs on "npm run build", "npm run dev" and on every
// change to a workout file while the dev server runs.
function checkWorkoutFiles(): Plugin {
  const check = () => {
    const errors: string[] = []
    for (const file of readdirSync(WORKOUTS_DIR).filter((f) => f.endsWith('.json'))) {
      let json: unknown
      try {
        // trim() also removes an invisible byte order mark some Windows editors add
        json = JSON.parse(readFileSync(WORKOUTS_DIR + file, 'utf8').trim())
      } catch (e) {
        errors.push(`workouts/${file}: is not valid JSON (${(e as Error).message})`)
        continue
      }
      errors.push(...parseWorkout(file, json).errors)
    }
    if (errors.length > 0) {
      throw new Error(`Problems in the workout files:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
    }
  }
  return {
    name: 'check-workout-files',
    buildStart: check,
    handleHotUpdate({ file }) {
      if (file.includes('/workouts/') && file.endsWith('.json')) check()
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), checkWorkoutFiles()],
  // GitHub Pages serves the app from https://rschmacker.github.io/workout_log/
  // so all asset URLs need this prefix. Must match the GitHub repo name.
  base: '/workout_log/',
  server: {
    // Listen on the local network too, so you can open the dev server on your iPhone
    host: true,
  },
})
