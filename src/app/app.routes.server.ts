import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'private/students-school/:schoolId',
    renderMode: RenderMode.Server
  },
  {
    path: 'private/accounts-receivable/:id',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
