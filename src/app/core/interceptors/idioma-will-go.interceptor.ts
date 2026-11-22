import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { IdiomaWillGoService } from '../services/idioma-will-go.service';

/**
 * En las peticiones a la extensión de Will-Go (/wge/) manda el idioma elegido, para que el servidor
 * responda los mensajes de error en ese idioma. Accept-Language no necesita permiso CORS adicional.
 */
export const IdiomaWillGoInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/wge/')) return next(req);
  const idioma = inject(IdiomaWillGoService).actual;
  return next(req.clone({ setHeaders: { 'Accept-Language': idioma } }));
};
