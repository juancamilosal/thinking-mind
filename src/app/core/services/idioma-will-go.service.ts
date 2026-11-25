import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser, registerLocaleData } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import localeFr from '@angular/common/locales/fr';
import localeEn from '@angular/common/locales/en';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type IdiomaWillGo = 'en' | 'fr' | 'es';

/** Idiomas de Will-Go. El español es solo para pruebas: en producción no se ofrece. */
export const IDIOMAS_WILL_GO: { id: IdiomaWillGo; corto: string; nombre: string; bandera: string; locale: string }[] = [
  { id: 'en', corto: 'EN', nombre: 'English', bandera: '/will-go/banderas/en.svg', locale: 'en-US' },
  { id: 'fr', corto: 'FR', nombre: 'Français', bandera: '/will-go/banderas/fr.svg', locale: 'fr-FR' },
  ...(environment.production ? [] : [{ id: 'es' as IdiomaWillGo, corto: 'ES', nombre: 'Español (prueba)', bandera: '/will-go/banderas/es.svg', locale: 'es-CO' }]),
];

const CLAVE = 'wg_idioma';

registerLocaleData(localeEn);
registerLocaleData(localeFr);

/**
 * Idioma de las pantallas de Will-Go (colaboradores y familias). Se recuerda en el navegador y se aplica
 * al entrar a cualquier ruta de Will-Go; el resto de la plataforma maneja su propio idioma.
 */
@Injectable({ providedIn: 'root' })
export class IdiomaWillGoService {
  private translate = inject(TranslateService);
  private doc = inject(DOCUMENT);
  private navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private iniciado = false;

  readonly idiomas = IDIOMAS_WILL_GO;
  actual: IdiomaWillGo = this.guardado();

  constructor() {
    // Solo en desarrollo: permite cambiar el idioma desde la consola o las pruebas (window.wgIdioma.usar('fr'))
    if (!environment.production && this.navegador) (window as unknown as { wgIdioma: IdiomaWillGoService }).wgIdioma = this;
  }

  /** Locale para fechas (en-US, fr-FR, es-CO). */
  get locale(): string { return this.idiomas.find((i) => i.id === this.actual)?.locale ?? 'en-US'; }

  /** Traduce fuera de un componente (p. ej. en los métodos estáticos que arman mensajes de error). */
  static traducir(clave: string, porDefecto: string): string {
    const t = IdiomaWillGoService.traductor;
    if (!t) return porDefecto;
    const v = t.instant(clave);
    return v && v !== clave ? v : porDefecto;
  }
  private static traductor: TranslateService | null = null;

  iniciar(router: Router): void {
    if (this.iniciado) return;
    this.iniciado = true;
    IdiomaWillGoService.traductor = this.translate;
    const aplicar = (url: string) => { if (IdiomaWillGoService.esRutaWillGo(url)) this.aplicar(); };
    aplicar(router.url);
    router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => aplicar((e as NavigationEnd).urlAfterRedirects));
  }

  usar(id: IdiomaWillGo): void {
    if (!this.idiomas.some((i) => i.id === id)) return;
    this.actual = id;
    if (this.navegador) try { localStorage.setItem(CLAVE, id); } catch { /* sin almacenamiento */ }
    this.aplicar();
  }

  static esRutaWillGo(url: string): boolean {
    const r = url.split('?')[0];
    return r.startsWith('/login-will-go') || r.startsWith('/private-will-go') || r.startsWith('/acudiente-will-go');
  }

  private aplicar(): void {
    this.translate.use(this.actual);
    this.doc.documentElement.lang = this.actual;
  }

  /** Lo que eligió la persona; si no ha elegido, el idioma del navegador (inglés por defecto). */
  private guardado(): IdiomaWillGo {
    const ids = IDIOMAS_WILL_GO.map((i) => i.id);
    if (!this.navegador) return 'en';
    try {
      const g = localStorage.getItem(CLAVE) as IdiomaWillGo | null;
      if (g && ids.includes(g)) return g;
    } catch { /* sin almacenamiento */ }
    const nav = (navigator.language || '').slice(0, 2) as IdiomaWillGo;
    return ids.includes(nav) ? nav : 'en';
  }
}
