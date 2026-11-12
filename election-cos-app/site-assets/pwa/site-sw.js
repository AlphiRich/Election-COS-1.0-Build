/**
 * Election-COS public site — service worker (electioncos.co.za)
 *
 * What makes the public site installable and usable offline. It is not
 * the application's worker (public/sw.js on app.electioncos.co.za) and
 * shares nothing with it: a different file name, a different origin, a
 * different cache prefix.
 *
 * Everything this caches is public, certified election data and the
 * site's own code. No personal information passes through the site, so
 * there is nothing here POPIA would need cleared on sign-out (there is no
 * sign-in).
 *
 *   - The shell (index.html, the entry script and stylesheet, icons,
 *     manifest)   -> precached at install, so the app opens offline.
 *   - /assets/*   -> cache-first. File names are content-hashed, so a
 *                    cached file is never stale. Council and results code
 *                    is cached the first time a page needs it.
 *   - /candidates/*, /party-emblems/*
 *                 -> stale-while-revalidate: show the cached copy at
 *                    once, refresh it in the background.
 *   - Navigations -> network first; offline, the cached shell, which
 *                    renders any route whose code has been cached.
 *   - Everything else (videos, ads, fonts, anything cross-origin, any
 *     non-GET)   -> straight to the network, never touched.
 *
 * `__SITE_PRECACHE__` and `__SITE_BUILD_ID__` are replaced by
 * scripts/finish-site-build.mjs with the files the build produced.
 */
/* eslint-env serviceworker */
const BUILD_ID = '__SITE_BUILD_ID__';
const PRECACHE = __SITE_PRECACHE__;

const SHELL = `ecos-site-shell-${BUILD_ID}`;
const RUNTIME = 'ecos-site-runtime';
const DATA = 'ecos-site-data';
const RUNTIME_MAX = 250;
const DATA_MAX = 400;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('ecos-site-shell-') && k !== SHELL)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME);
    await cache.put(request, response.clone());
    void trim(RUNTIME, RUNTIME_MAX);
  }
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(DATA);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        void trim(DATA, DATA_MAX);
      }
      return response;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  const fresh = await refresh;
  return fresh ?? Response.error();
}

async function navigate(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match('/index.html')) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.pathname.startsWith('/candidates/') || url.pathname.startsWith('/party-emblems/')) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
  }
  // Anything else, /videos/ included (range requests), goes to the network untouched.
});
