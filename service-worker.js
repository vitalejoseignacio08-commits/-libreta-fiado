/* ===========================================
   service-worker.js
   Guarda los archivos de la app en el celular
   para que funcione aunque no haya señal.
   =========================================== */

// Si cambiás archivos y querés que los celulares bajen la versión
// nueva, subí este número (ej: "fiado-v2").
const NOMBRE_CACHE = "fiado-v8";

const ARCHIVOS_APP = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon.svg",
];

// Al instalar el service worker, guardamos todos los archivos de la app
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then((cache) => cache.addAll(ARCHIVOS_APP))
  );
  self.skipWaiting();
});

// Al activarse, borramos cachés viejas de versiones anteriores
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== NOMBRE_CACHE)
          .map((nombre) => caches.delete(nombre))
      )
    )
  );
  self.clients.claim();
});

// Al pedir un archivo: primero probamos la red (así siempre se ve la
// versión más nueva), y actualizamos la caché con lo que llega.
// Si no hay internet, ahí sí usamos la última copia guardada.
self.addEventListener("fetch", (evento) => {
  evento.respondWith(
    fetch(evento.request)
      .then((respuestaRed) => {
        const copia = respuestaRed.clone();
        caches.open(NOMBRE_CACHE).then((cache) => cache.put(evento.request, copia));
        return respuestaRed;
      })
      .catch(() => caches.match(evento.request))
  );
});
