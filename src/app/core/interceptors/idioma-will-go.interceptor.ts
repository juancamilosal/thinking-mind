import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { map } from 'rxjs';
import { IdiomaWillGoService } from '../services/idioma-will-go.service';
import { rolActivoGuardado } from '../services/will-go.service';

/** Cómo se dice «Ronda N» en cada idioma (el servidor guarda los nombres en español). */
const RONDA: Record<string, string> = { en: 'Round', fr: 'Manche' };

/** Cambia «Ronda 3» por «Round 3» / «Manche 3» en cualquier texto de la respuesta. */
function traducirRondas<T>(valor: T, palabra: string): T {
  if (typeof valor === 'string') return valor.replace(/\bRonda (\d+)\b/g, `${palabra} $1`) as T;
  if (Array.isArray(valor)) return valor.map((v) => traducirRondas(v, palabra)) as T;
  if (valor && typeof valor === 'object') {
    const copia: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) copia[k] = traducirRondas(v, palabra);
    return copia as T;
  }
  return valor;
}

/**
 * En las peticiones a la extensión de Will-Go (/wge/) manda el idioma elegido, para que el servidor
 * responda los mensajes de error en ese idioma (Accept-Language no necesita permiso CORS adicional),
 * y traduce los nombres de ronda que vienen en la respuesta.
 */
export const IdiomaWillGoInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/wge/')) return next(req);
  const idioma = inject(IdiomaWillGoService).actual;
  const palabra = RONDA[idioma];
  // Quien tiene varios roles manda el que eligió (como parámetro: no necesita permiso CORS)
  const rol = rolActivoGuardado();
  const salida = next(req.clone({ setHeaders: { 'Accept-Language': idioma }, ...(rol ? { setParams: { wg_rol: rol } } : {}) }));
  if (!palabra) return salida;
  return salida.pipe(map((ev) => (ev instanceof HttpResponse && ev.body ? ev.clone({ body: traducirRondas(ev.body, palabra) }) : ev)));
};
