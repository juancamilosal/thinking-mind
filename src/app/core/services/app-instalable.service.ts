import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/** Evento que lanza Chrome/Android cuando la página se puede instalar. */
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type App = 'personal' | 'familias';

/**
 * App instalable de Will-Go (PWA), sin tienda: en las pantallas de Will-Go pone el manifiesto
 * (personal o familias), el color de la barra y el icono de iPhone, y registra el service worker.
 * El resto del sitio de Thinking Mind no cambia.
 */
@Injectable({ providedIn: 'root' })
export class AppInstalableService {
  private doc = inject(DOCUMENT);
  private navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private evento: EventoInstalar | null = null;
  private registrado = false;
  private iniciado = false;

  /** Qué app corresponde a la pantalla actual (null fuera de Will-Go). */
  app: App | null = null;
  /** true cuando el navegador ofreció instalar (Android/Chrome/Edge): el botón abre su ventana. */
  puedeInstalar = false;
  /** true si ya se abrió como app instalada. */
  get instalada(): boolean {
    if (!this.navegador) return false;
    return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  }
  /** iPhone/iPad: no hay botón del sistema; se instala con Compartir → Agregar a inicio. */
  get esIos(): boolean {
    if (!this.navegador) return false;
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  }

  /** Se llama una vez al arrancar la aplicación. */
  iniciar(router: Router): void {
    if (this.iniciado) return;
    this.iniciado = true;
    this.aplicar(router.url);
    router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => this.aplicar((e as NavigationEnd).urlAfterRedirects));
    if (!this.navegador) return;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); // mostramos nuestro propio botón
      this.evento = e as EventoInstalar;
      this.puedeInstalar = true;
    });
    window.addEventListener('appinstalled', () => { this.evento = null; this.puedeInstalar = false; });
  }

  /** Abre la ventana de instalación del sistema. Devuelve true si la persona aceptó. */
  async instalar(): Promise<boolean> {
    const e = this.evento;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    this.evento = null;
    this.puedeInstalar = false;
    return outcome === 'accepted';
  }

  private aplicar(url: string): void {
    const ruta = url.split('?')[0];
    const app: App | null = ruta.startsWith('/acudiente-will-go') ? 'familias'
      : ruta.startsWith('/login-will-go') || ruta.startsWith('/private-will-go') ? 'personal' : null;
    this.app = app;
    if (!app) {
      for (const id of ['wg-manifest', 'wg-theme', 'wg-apple-icon', 'wg-apple-capable', 'wg-apple-title', 'wg-apple-barra']) this.doc.getElementById(id)?.remove();
      return;
    }
    const familias = app === 'familias';
    this.etiqueta('link', 'wg-manifest', { rel: 'manifest', href: familias ? '/will-go/acudientes.webmanifest' : '/will-go/manifest.webmanifest' });
    this.etiqueta('meta', 'wg-theme', { name: 'theme-color', content: '#1b2a4a' });
    this.etiqueta('link', 'wg-apple-icon', { rel: 'apple-touch-icon', href: '/will-go/apple-touch-icon.png' });
    this.etiqueta('meta', 'wg-apple-capable', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    this.etiqueta('meta', 'wg-apple-barra', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
    this.etiqueta('meta', 'wg-apple-title', { name: 'apple-mobile-web-app-title', content: familias ? 'Will-Go Familias' : 'Will-Go' });
    this.registrar();
  }

  private etiqueta(tipo: 'link' | 'meta', id: string, atributos: Record<string, string>): void {
    let el = this.doc.getElementById(id);
    if (!el) {
      el = this.doc.createElement(tipo);
      el.id = id;
      this.doc.head.appendChild(el);
    }
    for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  }

  private registrar(): void {
    if (!this.navegador || this.registrado || !('serviceWorker' in navigator)) return;
    this.registrado = true;
    navigator.serviceWorker.register('/sw-will-go.js', { scope: '/' }).catch(() => (this.registrado = false));
  }
}
