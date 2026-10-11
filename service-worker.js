"use strict";

const CACHE_NAME = "compilar-stl-v25";
const APP_FILES = [
  "./?build=25",
  "./index.html?build=25",
  "./styles.css?build=25",
  "./app.js?build=25",
  "./manifest.webmanifest?build=25",
  "./icon.svg?build=25",
  "./logo-compilar-stl.png?build=25",
  "./logo-compilar-stl-192.png?build=25",
  "./logo-compilar-stl-512.png?build=25"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).catch((error) => caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      throw error;
    }))
  );
});
