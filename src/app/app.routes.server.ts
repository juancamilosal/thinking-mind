import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Las páginas privadas se dibujan solo en el navegador: la sesión vive en localStorage,
  // así que en el servidor el guard no la ve y mostraría el login un instante al recargar.
  {
    path: 'private',
    renderMode: RenderMode.Client
  },
  {
    path: 'private/**',
    renderMode: RenderMode.Client
  },
  {
    path: 'private-ayo',
    renderMode: RenderMode.Client
  },
  {
    path: 'private-ayo/**',
    renderMode: RenderMode.Client
  },
  {
    path: 'private-will-go',
    renderMode: RenderMode.Client
  },
  {
    path: 'private-will-go/**',
    renderMode: RenderMode.Client
  },
  // Portal de acudientes: su sesión también vive en localStorage
  {
    path: 'acudiente-will-go',
    renderMode: RenderMode.Client
  },
  {
    path: 'acudiente-will-go/**',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
