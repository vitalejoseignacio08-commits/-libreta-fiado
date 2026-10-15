/* ===========================================
   service-worker.js del panel de escritorio
   Guarda los archivos para que, una vez abierto
   al menos una vez, el panel siga funcionando
   sin internet (los datos ya están en esta compu,
   solo hace falta que carguen los archivos).
   =========================================== */

// Si cambiás archivos y querés que la compu baje la versión nueva,
// subí este número (ej: "escritorio-v2").
const NOMBRE_CACHE = "escritorio-v1";

const ARCHIVOS_APP = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "../icons/icon.svg",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then((cache) => cache.addAll(ARCHIVOS_APP))
  );
  self.skipWaiting();
});

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

// Misma estrategia que el celular: primero la red (para ver cambios
// nuevos al toque), y si no hay internet, la última copia guardada.
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
