// Source code: https://github.com/mdn/pwa-examples

importScripts('/monitor/static/utils.js');

// The version of the cache.
const VERSION = "2025_05_26_01";

// The name of the cache
const CACHE_NAME = `monitor-sw-${VERSION}`;

// The static resources that the app needs to function.
const APP_STATIC_RESOURCES = [
  "/monitor/",
  "/monitor/index.html",
  "/monitor/manifest.json",
  "/monitor/static/config.json",
  "/monitor/static/utils.js",
  "/monitor/static/app.js",
  "/monitor/static/doc.js",
  "/monitor/static/style.css",
  "/monitor/static/fonts-googleapis.css",
  "/monitor/static/font-awesome.min.css",
  "/monitor/static/bootstrap.min.css",
  "/monitor/static/logo.png",
  "/monitor/static/icons/16x16.png",
  "/monitor/static/icons/32x32.png",
  "/monitor/static/icons/48x48.png",
  "/monitor/static/icons/72x72.png",
  "/monitor/static/icons/96x96.png",
  "/monitor/static/icons/128x128.png",
  "/monitor/static/icons/144x144.png",
  "/monitor/static/icons/192x192.png",
  "/monitor/static/icons/256x256.png",
  "/monitor/static/icons/512x512.png",
  "/monitor/static/templates/admin_message.html",
  "/monitor/static/templates/NO_news.html",
  "/monitor/static/templates/NN_public_discussion.html",
  "/monitor/static/templates/NO_expert_assessment.html"
];

// On install, cache the static resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      cache.addAll(APP_STATIC_RESOURCES);
    })()
  );
});

// delete old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
      await clients.claim();
    })()
  );
});

const networkFirst = async (request) => {
  try {
    const responseFromNetwork = await fetch(request);
    // If the network request succeeded, 
    // return the original to the app.
    return responseFromNetwork;
  } catch (error) {
    // If the response was not found in the network,
    // try to get the resource from the cache.
    const responseFromCache = await caches.match(request);
    if (responseFromCache) {
      return responseFromCache;
    }
    // When even the cache response is not available,
    // there is nothing we can do, but we must always
    // return a Response object.
    if (request.method === 'GET') {
      return new Response("Network error happened", {
        status: 408,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response('Service Unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
};

self.addEventListener("fetch", (event) => {
  event.respondWith(
    networkFirst(event.request),
  );
});


self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'monitor-sync') {
    event.waitUntil(handleMonitoringSync());
  }
});

async function handleMonitoringSync() {
  console.log('Periodic Sync Handler');
  try {
    const docsId = await loadFromDB(DB_KEYS.SW_DOCS_ID);
    console.log(`SW Docs Id: ${docsId}`);

    const keywords = await loadFromDB(DB_KEYS.KEYWORDS_INPUT);
    console.log(`SW Keywords: ${keywords}`);
    
    if (!keywords) return;

    const config = await loadConfig();
    console.log(config);

    const url = `${config.monitor_api_url}/documents?q=${encodeURIComponent(keywords)}&docs_id=${docsId}`;
    const response = await fetch(url);

    if (response.status === 204) {
      console.log("SW There are no new documents.");
      return;
    }

    if (response.status === 200) {
      const data = await response.json();
      console.log("SW There are new documents.");
      console.log("SW Data: ", data);
      
      await saveToDB(DB_KEYS.SW_DOCS_ID, data.docs_id);
      self.registration.showNotification(`Найдены новые документы: ${data.result.length} шт.`);
    }
  } catch (e) {
    console.warn('Periodic sync monitoring error:', e);
  }
}
