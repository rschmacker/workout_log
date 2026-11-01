import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

// After building: writes dist/sw.js from src/serviceWorker.js, with the list of all
// built files and a version that changes whenever any of them changes
function serviceWorker(): Plugin {
  let root = ''
  let outDir = ''
  return {
    name: 'workout-log-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files = readdirSync(outDir, { recursive: true, encoding: 'utf8' })
        .map((file) => file.replaceAll('\\', '/'))
        .filter((file) => file !== 'sw.js' && statSync(join(outDir, file)).isFile())
        .sort()
      const hash = createHash('sha256')
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)))
      const version = hash.digest('hex').slice(0, 12)

      const code = readFileSync(join(root, 'src/serviceWorker.js'), 'utf8')
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace("['__FILES__']", JSON.stringify(files))
      if (code.includes('__VERSION__') || code.includes('__FILES__')) {
        throw new Error('src/serviceWorker.js: the VERSION / FILES lines were not found')
      }
      writeFileSync(join(outDir, 'sw.js'), code)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
  // GitHub Pages serves the app from https://rschmacker.github.io/workout_log/
  // so all asset URLs need this prefix. Must match the GitHub repo name.
  base: '/workout_log/',
  server: {
    // Listen on the local network too, so you can open the dev server on your iPhone
    host: true,
  },
})
