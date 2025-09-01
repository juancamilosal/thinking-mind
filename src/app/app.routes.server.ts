import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'private/estudiantes-colegio/:schoolId',
    renderMode: RenderMode.Server // Usar SSR en lugar de prerendering para rutas con parámetros
  },
  {
    path: '**', // Todas las demás rutas usan prerendering por defecto
    renderMode: RenderMode.Prerender
  }
];