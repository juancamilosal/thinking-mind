// Service worker mínimo de Will-Go: permite instalar la app en el celular.
// No guarda en caché la aplicación (cada despliegue se ve de una vez); solo, si no hay internet
// al abrir una pantalla de Will-Go, muestra un aviso en lugar del error del navegador.
const OFFLINE = '/will-go/sin-conexion.html';
const ICONO = '/will-go/icon-192.png';
const RUTAS_WILL_GO = ['/login-will-go', '/private-will-go', '/acudiente-will-go'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('will-go-v2').then((c) => c.addAll([OFFLINE, ICONO])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (new URL(req.url).pathname === ICONO) { e.respondWith(fetch(req).catch(() => caches.match(ICONO))); return; }
  if (req.mode !== 'navigate') return; // imágenes, API, scripts: los maneja el navegador como siempre
  const ruta = new URL(req.url).pathname;
  if (!RUTAS_WILL_GO.some((r) => ruta.startsWith(r))) return; // el resto del sitio no se toca
  e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});
