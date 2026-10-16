// Service worker: offline app shell, cached surah text and cached recitation audio.
const VERSION = 'v1';
const SHELL_CACHE = `shell-${VERSION}`;
const DATA_CACHE = `quran-data-${VERSION}`;
const AUDIO_CACHE = `quran-audio-${VERSION}`;
const FONT_CACHE = `fonts-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, DATA_CACHE, AUDIO_CACHE, FONT_CACHE];
const MAX_AUDIO_ENTRIES = 1500; // roughly 150–300 MB at most

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
};

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
};

// Media elements send Range requests; answer them with a 206 sliced from the full cached file.
const rangeResponse = async (request, fullResponse) => {
  const range = request.headers.get('range');
  if (!range) return fullResponse;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  const blob = await fullResponse.blob();
  if (!match) return new Response(blob, { status: 200, headers: fullResponse.headers });
  const size = blob.size;
  let start = match[1] === '' ? NaN : Number(match[1]);
  let end = match[2] === '' ? NaN : Number(match[2]);
  if (Number.isNaN(start)) { start = size - end; end = size - 1; }
  if (Number.isNaN(end) || end >= size) end = size - 1;
  if (start < 0 || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': fullResponse.headers.get('content-type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
};

const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
};

const handleAudio = async (event) => {
  const { request } = event;
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return rangeResponse(request, cached);
  try {
    // Fetch the whole file once (CORS) so it can be cached and sliced later.
    const full = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
    if (!full.ok) throw new Error(`audio ${full.status}`);
    event.waitUntil(cache.put(request.url, full.clone()).then(() => trimCache(AUDIO_CACHE, MAX_AUDIO_ENTRIES)));
    return rangeResponse(request, full);
  } catch {
    // The CDN may not allow CORS; fall back to a normal, uncached request.
    return fetch(request);
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'api.alquran.cloud') {
    event.respondWith(networkFirst(request, DATA_CACHE));
  } else if (url.hostname.endsWith('islamic.network') || request.destination === 'audio') {
    event.respondWith(handleAudio(event));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
  } else if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(new Request('/'), SHELL_CACHE).catch(() => caches.match('/')));
    } else if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
    } else {
      event.respondWith(networkFirst(request, SHELL_CACHE));
    }
  }
});
