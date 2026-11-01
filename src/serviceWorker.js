// Service worker: keeps the app's own files (page, JavaScript, CSS, icons) on the phone,
// so the app opens without internet and without waiting for GitHub Pages.
// Your data is not kept here (that's src/localData.ts), and requests to Supabase
// always go to the internet as usual.
//
// How a new version arrives: when the app starts (or comes back to the front), the
// phone checks GitHub Pages for a changed sw.js, which changes with every deploy. The
// new version is downloaded completely in the background and used from the next start
// on. If the download fails (e.g. no reception), the old version simply stays.
//
// When building, vite.config.ts copies this file to dist/sw.js and fills in the two
// lines below. It isn't used during `npm run dev`.

const VERSION = '__VERSION__'
const FILES = ['__FILES__']
// Only this app's caches start with "workout-log-" (other sites on rschmacker.github.io
// share the same browser storage)
const CACHE = `workout-log-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // "reload": get the files from GitHub Pages, not from the browser's own cache
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
      // Use the new version right away (an open app keeps the files it already loaded)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  // Delete the files of older versions
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('workout-log-') && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  // Only the app's own files; everything else (e.g. Supabase) is left alone
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Opening the app (also when coming back from the GitHub login with "?code=…"):
      // always the stored page. ignoreVary: the stored files fit every request, even if
      // the server says they "vary" by request headers (e.g. Origin).
      const stored = await cache.match(request.mode === 'navigate' ? 'index.html' : request, {
        ignoreVary: true,
      })
      return stored ?? fetch(request)
    }),
  )
})
