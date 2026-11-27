import { Component, HostListener, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DatosPantallaTv, EdicionVigente, FondoTv, PaisTv, WillGoService } from '../../../../core/services/will-go.service';
import { formatearNumero } from '../../numero-miles.directive';
import { GraficaTvComponent, SerieTv } from './grafica-tv.component';
import { SelectorIdiomaComponent } from '../../selector-idioma.component';
import { IdiomaWillGoService } from '../../../../core/services/idioma-will-go.service';

/** Cada cuánto pasa a la siguiente pantalla. */
const SEGUNDOS = 15;
const COLORES_FONDOS = ['#F97316', '#3B82F6', '#22C55E', '#A855F7', '#EF4444', '#14B8A6', '#EAB308', '#EC4899'];

type Diapositiva =
  | { tipo: 'tasas' }
  | { tipo: 'pais'; pais: PaisTv }
  | { tipo: 'docentes' }
  | { tipo: 'fondos' }
  | { tipo: 'fondo'; fondo: FondoTv; color: string };

/**
 * Resumen de la economía para proyectar en un televisor (solo administradores):
 * el precio de la moneda de cada país; luego cada país con su gráfica y los 10 estudiantes con más dinero;
 * luego todas las empresas (W-Funds) y cada una con su gráfica y los 10 que más han invertido. Cambia cada 15 s.
 */
@Component({
  selector: 'app-pantalla-tv-will-go',
  standalone: true,
  imports: [TranslatePipe, GraficaTvComponent, SelectorIdiomaComponent],
  template: `
    <div class="tv fixed inset-0 overflow-hidden text-white select-none" [class.tv-oculto]="!controles" (mousemove)="mostrarControles()">
      @if (!edicionId) {
        <!-- Elegir la edición -->
        <div class="absolute top-4 right-4"><wg-selector-idioma variante="oscuro" /></div>
        <div class="h-full flex flex-col items-center justify-center p-6">
          <div class="bg-white rounded-2xl px-6 py-4"><img src="assets/images/will-go-economy-logo.png" alt="Will-Go Economy" class="h-16 w-auto"></div>
          <h1 class="tv-h1 mt-8 font-extrabold text-center">{{ 'wg.tv.titulo' | translate }}</h1>
          <p class="tv-p mt-2 text-white/70 text-center">{{ 'wg.tv.elegir' | translate }}</p>
          @if (cargandoEdiciones) {
            <p class="mt-8 text-white/70">{{ 'wg.tv.cargando' | translate }}</p>
          } @else if (!ediciones.length) {
            <p class="mt-8 text-white/70">{{ 'wg.tv.sinEdiciones' | translate }}</p>
          } @else {
            <div class="mt-8 grid gap-4 w-full max-w-3xl sm:grid-cols-2">
              @for (e of ediciones; track e.id) {
                <button type="button" (click)="iniciar(e.id)" class="text-left rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 px-6 py-5 transition">
                  <p class="text-xl font-bold">{{ e.nombre }}</p>
                  @if (e.colegio) { <p class="text-white/70 mt-1">{{ e.colegio }}</p> }
                  <p class="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-orange-300">▶ {{ 'wg.tv.iniciar' | translate }}</p>
                </button>
              }
            </div>
          }
          <button type="button" (click)="salir()" class="mt-10 text-white/60 hover:text-white">← {{ 'wg.tv.volver' | translate }}</button>
        </div>
      } @else {
        <!-- Encabezado -->
        <header class="tv-cabeza flex items-center gap-[2vw]">
          <div class="bg-white rounded-[1vw] px-[1.2vw] py-[0.6vw] shrink-0"><img src="assets/images/will-go-economy-logo.png" alt="Will-Go Economy" class="tv-logo w-auto"></div>
          <div class="min-w-0">
            <p class="tv-chico uppercase tracking-[0.2em] text-orange-300 font-bold">{{ 'wg.tv.titulo' | translate }}</p>
            <p class="tv-p font-bold truncate">{{ datos?.edicion?.nombre }}</p>
          </div>
          <p class="ml-auto tv-h2 font-extrabold tabular-nums">{{ hora }}</p>
        </header>

        <main class="tv-cuerpo">
          @if (!datos) {
            <div class="h-full flex items-center justify-center tv-h2 text-white/70">{{ error || ('wg.tv.cargando' | translate) }}</div>
          } @else {
            @if (actual; as d) {
            @switch (d.tipo) {
              @case ('tasas') {
                <!-- 1. Precio de la moneda de cada país -->
                <div class="h-full flex flex-col tv-entra">
                  <h1 class="tv-h1 font-extrabold">{{ 'wg.tv.precioMoneda' | translate }}</h1>
                  <p class="tv-p text-white/70">{{ 'wg.tv.precioAyuda' | translate }}</p>
                  <div class="flex-1 min-h-0 mt-[2vw] grid gap-[2vw]" [style.grid-template-columns]="'repeat(' + Math.min(datos.paises.length, 3) + ', minmax(0, 1fr))'">
                    @for (p of datos.paises; track p.id) {
                      <div class="rounded-[1.6vw] bg-white/[0.07] border-2 p-[1.6vw] flex flex-col items-center justify-center text-center" [style.border-color]="p.color || '#475569'">
                        <p class="tv-h2 font-extrabold" [style.color]="claro(p.color)">{{ p.nombre }}</p>
                        @if (billete(p); as img) {
                          <img [src]="img" [alt]="'1 ' + p.codigo_moneda" class="mt-[1.2vw] w-full max-w-[26vw] max-h-[30vh] object-contain rounded-[0.8vw] shadow-2xl">
                        } @else {
                          <div class="mt-[1.2vw] w-full max-w-[26vw] aspect-[2/1] rounded-[0.8vw] flex items-center justify-center tv-h1 font-extrabold shadow-2xl" [style.background]="p.color || '#475569'">1 {{ p.codigo_moneda }}</div>
                        }
                        <p class="mt-[1.4vw] tv-p text-white/80">1 {{ p.codigo_moneda }} =</p>
                        <p class="tv-numero font-extrabold tabular-nums leading-none">{{ miles(p.tasa_actual) }}</p>
                        <p class="tv-p text-white/80">{{ 'wg.tv.pesos' | translate }}</p>
                        <p class="mt-[1vw] tv-p font-bold px-[1vw] py-[0.3vw] rounded-full" [class]="cambio(p) > 0 ? 'bg-emerald-500/20 text-emerald-300' : cambio(p) < 0 ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/80'">
                          {{ cambio(p) > 0 ? '▲' : cambio(p) < 0 ? '▼' : '=' }} {{ pct(cambio(p)) }} {{ 'wg.tv.desdeInicio' | translate }}
                        </p>
                      </div>
                    }
                  </div>
                </div>
              }
              @case ('pais') {
                <!-- 2. Cada país: su gráfica y los 10 con más dinero -->
                <div class="h-full flex flex-col tv-entra">
                  <div class="flex items-end gap-[1.5vw]">
                    <span class="w-[1.2vw] h-[1.2vw] rounded-full mb-[0.9vw]" [style.background]="d.pais.color || '#94a3b8'"></span>
                    <h1 class="tv-h1 font-extrabold">{{ d.pais.nombre }}</h1>
                    <p class="tv-p text-white/70 mb-[0.5vw]">1 {{ d.pais.codigo_moneda }} = <b class="text-white">{{ miles(d.pais.tasa_actual) }}</b> {{ 'wg.tv.pesos' | translate }}</p>
                  </div>
                  <div class="flex-1 min-h-0 mt-[1.5vw] grid grid-cols-[1.35fr_1fr] gap-[2vw]">
                    <section class="tv-caja flex flex-col min-h-0">
                      <p class="tv-sub font-bold text-white/80">{{ 'wg.tv.comportamiento' | translate }}</p>
                      <div class="flex-1 min-h-0 mt-[0.8vw] flex items-center">
                        @if (d.pais.historial.length) {
                          <wg-grafica-tv class="block w-full h-full" [series]="seriePais(d.pais)" [etiquetas]="horasPais(d.pais)" [referencia]="datos.tasa_inicial" [titulo]="d.pais.nombre" [formato]="milesFn" />
                        } @else {
                          <p class="w-full text-center tv-p text-white/60">{{ 'wg.tv.sinHistorial' | translate }}</p>
                        }
                      </div>
                    </section>
                    <section class="tv-caja flex flex-col min-h-0">
                      <p class="tv-sub font-bold text-white/80">{{ 'wg.tv.top10Dinero' | translate }}</p>
                      <ol class="flex-1 min-h-0 mt-[0.6vw] flex flex-col justify-start">
                        @for (r of d.pais.ranking; track $index; let i = $index) {
                          <li class="tv-fila flex items-center gap-[1vw] border-b border-white/10 last:border-0">
                            <span class="tv-puesto shrink-0 rounded-full flex items-center justify-center font-extrabold" [class]="claseMedalla(i)">{{ i + 1 }}</span>
                            <span class="min-w-0 flex-1 truncate font-semibold">{{ r.nombre }} {{ r.apellido }}</span>
                            <span class="shrink-0 font-extrabold tabular-nums">{{ miles(r.total) }} <span class="tv-chico font-semibold text-white/60">{{ d.pais.codigo_moneda }}</span></span>
                          </li>
                        } @empty {
                          <li class="tv-p text-white/60 py-[2vw] text-center">{{ 'wg.tv.sinDinero' | translate }}</li>
                        }
                      </ol>
                    </section>
                  </div>
                </div>
              }
              @case ('docentes') {
                <!-- 2b. Los docentes que más dinero han repartido, por país -->
                <div class="h-full flex flex-col tv-entra">
                  <h1 class="tv-h1 font-extrabold">{{ 'wg.tv.docentes' | translate }}</h1>
                  <p class="tv-p text-white/70">{{ 'wg.tv.docentesAyuda' | translate }}</p>
                  <div class="flex-1 min-h-0 mt-[2vw] grid gap-[2vw]" [style.grid-template-columns]="'repeat(' + Math.min(datos.paises.length, 3) + ', minmax(0, 1fr))'">
                    @for (p of datos.paises; track p.id) {
                      <div class="tv-caja flex flex-col min-h-0 border-2" [style.border-color]="p.color || '#475569'">
                        <p class="tv-h2 font-extrabold text-center" [style.color]="claro(p.color)">{{ p.nombre }}</p>
                        @if (p.docentes?.length) {
                          @let top = p.docentes![0];
                          <div class="mt-[1.2vw] flex flex-col items-center text-center">
                            <span class="tv-medalla rounded-full flex items-center justify-center font-extrabold bg-amber-400 text-amber-950">1</span>
                            <p class="mt-[0.8vw] tv-h2 font-extrabold leading-tight">{{ top.nombre }} {{ top.apellido }}</p>
                            <p class="mt-[0.4vw] tv-numero font-extrabold tabular-nums leading-none">{{ miles(top.repartido) }}</p>
                            <p class="tv-p text-white/70">{{ p.codigo_moneda }} · {{ 'wg.tv.aEstudiantes' | translate: { n: top.estudiantes } }}</p>
                          </div>
                          <ol class="mt-[1.4vw] border-t border-white/10">
                            @for (d of p.docentes!.slice(1); track $index; let i = $index) {
                              <li class="tv-fila flex items-center gap-[1vw] border-b border-white/10 last:border-0">
                                <span class="tv-puesto shrink-0 rounded-full flex items-center justify-center font-extrabold" [class]="claseMedalla(i + 1)">{{ i + 2 }}</span>
                                <span class="min-w-0 flex-1 truncate font-semibold">{{ d.nombre }} {{ d.apellido }}</span>
                                <span class="shrink-0 font-extrabold tabular-nums">{{ miles(d.repartido) }}</span>
                              </li>
                            }
                          </ol>
                        } @else {
                          <p class="flex-1 flex items-center justify-center text-center tv-p text-white/60">{{ 'wg.tv.sinRepartos' | translate }}</p>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
              @case ('fondos') {
                <!-- 3. Todas las empresas (W-Funds) -->
                <div class="h-full flex flex-col tv-entra">
                  <h1 class="tv-h1 font-extrabold">{{ 'wg.tv.fondos' | translate }}</h1>
                  <p class="tv-p text-white/70">{{ 'wg.tv.fondosAyuda' | translate: { n: datos.rondas } }}</p>
                  <div class="flex-1 min-h-0 mt-[1.5vw] grid grid-cols-[1.6fr_1fr] gap-[2vw]">
                    <section class="tv-caja flex items-center min-h-0">
                      <wg-grafica-tv class="block w-full h-full" [series]="seriesFondos" [etiquetas]="etiquetasRondas" [referencia]="100" [rellenar]="false" [titulo]="'wg.tv.fondos' | translate" />
                    </section>
                    <section class="tv-caja flex flex-col justify-center gap-[0.8vw] min-h-0">
                      @for (f of fondosOrdenados; track f.fondo.id) {
                        <div class="flex items-center gap-[1vw]">
                          <span class="w-[1.1vw] h-[1.1vw] rounded-full shrink-0" [style.background]="f.color"></span>
                          @if (f.fondo.logo) { <img [src]="logo(f.fondo)" alt="" class="tv-logo-fondo rounded-[0.5vw] object-cover bg-white shrink-0"> }
                          <span class="min-w-0 flex-1 truncate tv-p font-semibold">{{ f.fondo.nombre }}</span>
                          <span class="shrink-0 tv-p font-extrabold tabular-nums" [class]="valorFinal(f.fondo) >= 100 ? 'text-emerald-300' : 'text-red-300'">{{ pct(valorFinal(f.fondo) - 100) }}</span>
                        </div>
                      }
                    </section>
                  </div>
                </div>
              }
              @case ('fondo') {
                <!-- 4. Cada empresa: su gráfica y los 10 que más han invertido -->
                <div class="h-full flex flex-col tv-entra">
                  <div class="flex items-center gap-[1.5vw]">
                    @if (d.fondo.logo) { <img [src]="logo(d.fondo)" alt="" class="tv-logo-grande rounded-[0.8vw] object-cover bg-white shrink-0"> }
                    <div class="min-w-0">
                      <h1 class="tv-h1 font-extrabold truncate">{{ d.fondo.nombre }}</h1>
                      <p class="tv-p text-white/70">
                        {{ 'wg.tv.valen' | translate: { v: miles(valorFinal(d.fondo)) } }}
                        @if (d.fondo.ultimo_rendimiento !== null) {
                          · <b [class]="d.fondo.ultimo_rendimiento >= 0 ? 'text-emerald-300' : 'text-red-300'">{{ 'wg.tv.ultimaRonda' | translate: { v: pct(d.fondo.ultimo_rendimiento * 100) } }}</b>
                        }
                      </p>
                    </div>
                  </div>
                  <div class="flex-1 min-h-0 mt-[1.5vw] grid grid-cols-[1.35fr_1fr] gap-[2vw]">
                    <section class="tv-caja flex flex-col min-h-0">
                      <p class="tv-sub font-bold text-white/80">{{ 'wg.tv.comportamiento' | translate }}</p>
                      <div class="flex-1 min-h-0 mt-[0.8vw] flex items-center">
                        @if (d.fondo.puntos.length > 1) {
                          <wg-grafica-tv class="block w-full h-full" [series]="serieFondo(d.fondo, d.color)" [etiquetas]="etiquetasRondas" [referencia]="100" [titulo]="d.fondo.nombre" />
                        } @else {
                          <p class="w-full text-center tv-p text-white/60">{{ 'wg.tv.sinRondas' | translate }}</p>
                        }
                      </div>
                    </section>
                    <section class="tv-caja flex flex-col min-h-0">
                      <p class="tv-sub font-bold text-white/80">{{ 'wg.tv.top10Inversion' | translate }}</p>
                      <ol class="flex-1 min-h-0 mt-[0.6vw] flex flex-col justify-start">
                        @for (r of d.fondo.ranking; track $index; let i = $index) {
                          <li class="tv-fila flex items-center gap-[1vw] border-b border-white/10 last:border-0">
                            <span class="tv-puesto shrink-0 rounded-full flex items-center justify-center font-extrabold" [class]="claseMedalla(i)">{{ i + 1 }}</span>
                            <span class="min-w-0 flex-1 truncate font-semibold">{{ r.nombre }} {{ r.apellido }}</span>
                            <span class="tv-chico shrink-0 px-[0.6vw] py-[0.15vw] rounded-full font-bold" [style.background]="r.color || '#475569'">{{ r.pais }}</span>
                            <span class="shrink-0 font-extrabold tabular-nums">{{ miles(r.invertido) }} <span class="tv-chico font-semibold text-white/60">{{ r.codigo_moneda }}</span></span>
                          </li>
                        } @empty {
                          <li class="tv-p text-white/60 py-[2vw] text-center">{{ 'wg.tv.sinInversiones' | translate }}</li>
                        }
                      </ol>
                    </section>
                  </div>
                </div>
              }
            }
            }
          }
        </main>

        <!-- Avance: barra de los 15 segundos y una marca por pantalla -->
        <footer class="tv-pie flex items-center gap-[1.5vw]">
          <div class="flex gap-[0.5vw]">
            @for (x of diapositivas; track $index; let i = $index) {
              <span class="h-[0.5vw] rounded-full transition-all" [class]="i === indice ? 'w-[2.5vw] bg-orange-400' : 'w-[0.5vw] bg-white/30'"></span>
            }
          </div>
          <div class="flex-1 h-[0.35vw] rounded-full bg-white/10 overflow-hidden">
            @if (!pausa) { @for (v of [vuelta]; track v) { <div class="tv-barra h-full bg-gradient-to-r from-orange-400 to-amber-300 rounded-full" [style.animation-duration]="segundos + 's'"></div> } }
          </div>
            <!-- Controles (aparecen al mover el mouse) -->
        <div class="tv-controles shrink-0 flex items-center gap-2">
              <wg-selector-idioma variante="oscuro" abrir="arriba" />
          <button type="button" (click)="anterior()" class="tv-boton" [attr.aria-label]="'wg.tv.anterior' | translate">◀</button>
          <button type="button" (click)="alternarPausa()" class="tv-boton" [attr.aria-label]="(pausa ? 'wg.tv.seguir' : 'wg.tv.pausar') | translate">{{ pausa ? '▶' : '❚❚' }}</button>
          <button type="button" (click)="siguiente()" class="tv-boton" [attr.aria-label]="'wg.tv.siguiente' | translate">▶▶</button>
          <button type="button" (click)="pantallaCompleta()" class="tv-boton" [attr.aria-label]="'wg.tv.pantallaCompleta' | translate">⛶</button>
          <button type="button" (click)="cambiarEdicion()" class="tv-boton px-3 text-sm font-semibold">{{ 'wg.tv.cambiar' | translate }}</button>
          <button type="button" (click)="salir()" class="tv-boton" [attr.aria-label]="'wg.tv.salir' | translate">✕</button>
        </div>
        </footer>

      }
    </div>
  `,
  styles: [`
    .tv { background: radial-gradient(ellipse at top left, #0b2a57 0%, #001938 45%, #000d1f 100%); font-size: clamp(14px, 1.45vw, 40px); }
    .tv-cabeza { height: 11vh; padding: 0 3vw; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .tv-cuerpo { height: 81vh; padding: 2.2vh 3vw 0; }
    .tv-pie { height: 8vh; padding: 0 3vw; }
    .tv-logo { height: 5vh; }
    .tv-logo-fondo { width: 2.6vw; height: 2.6vw; }
    .tv-logo-grande { width: 6vw; height: 6vw; }
    .tv-h1 { font-size: clamp(26px, 3.3vw, 90px); line-height: 1.1; }
    .tv-h2 { font-size: clamp(20px, 2.2vw, 60px); }
    .tv-numero { font-size: clamp(34px, 5vw, 140px); }
    .tv-sub { font-size: clamp(14px, 1.35vw, 36px); }
    .tv-p { font-size: clamp(14px, 1.4vw, 38px); }
    .tv-chico { font-size: clamp(11px, 0.95vw, 26px); }
    .tv-caja { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 1.6vw; padding: 1.4vw 1.8vw; }
    .tv-fila { font-size: clamp(14px, 1.5vw, 40px); padding: 0.55vh 0; }
    .tv-medalla { width: 4.5vw; height: 4.5vw; font-size: clamp(18px, 2.2vw, 60px); }
    .tv-puesto { width: 2.4vw; height: 2.4vw; min-width: 26px; min-height: 26px; font-size: clamp(12px, 1.1vw, 30px); }
    .tv-boton { min-width: 44px; height: 44px; border-radius: 9999px; background: rgba(255,255,255,0.15); color: #fff; backdrop-filter: blur(6px); }
    .tv-boton:hover { background: rgba(255,255,255,0.3); }
    .tv-controles { transition: opacity .4s; }
    .tv-oculto .tv-controles { opacity: 0; pointer-events: none; }
    .tv-oculto { cursor: none; }
    .tv-barra { width: 0; animation-name: tv-avance; animation-timing-function: linear; animation-fill-mode: forwards; }
    @keyframes tv-avance { from { width: 0; } to { width: 100%; } }
    .tv-entra { animation: tv-aparece .6s ease-out; }
    @keyframes tv-aparece { from { opacity: 0; transform: translateY(1.5vh); } to { opacity: 1; transform: none; } }
  `],
})
export class PantallaTvWillGo implements OnInit, OnDestroy {
  private willGo = inject(WillGoService);
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);
  private t = inject(TranslateService);
  private zona = inject(NgZone);
  private idioma = inject(IdiomaWillGoService);
  readonly Math = Math;
  readonly segundos = SEGUNDOS;
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  readonly milesFn = (v: number) => formatearNumero(Math.round(v));

  ediciones: EdicionVigente[] = [];
  cargandoEdiciones = true;
  edicionId = '';
  datos: DatosPantallaTv | null = null;
  error = '';
  diapositivas: Diapositiva[] = [];
  indice = 0;
  /** Cambia en cada pantalla para reiniciar la barra de avance. */
  vuelta = 0;
  pausa = false;
  hora = '';
  controles = true;

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private reloj: ReturnType<typeof setInterval> | null = null;
  private ocultar: ReturnType<typeof setTimeout> | null = null;
  private bloqueo: { release: () => Promise<void> } | null = null;

  ngOnInit(): void {
    this.actualizarHora();
    this.reloj = setInterval(() => this.actualizarHora(), 10000);
    this.ruta.queryParamMap.subscribe((q) => {
      const id = q.get('edicion') ?? '';
      if (id !== this.edicionId) { this.edicionId = id; this.datos = null; this.detener(); if (id) this.cargar(true); }
    });
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.cargandoEdiciones = false; },
      error: () => { this.cargandoEdiciones = false; },
    });
    this.mostrarControles();
    this.mantenerEncendida();
  }

  ngOnDestroy(): void {
    this.detener();
    if (this.reloj) clearInterval(this.reloj);
    if (this.ocultar) clearTimeout(this.ocultar);
    this.bloqueo?.release().catch(() => {});
  }

  get actual(): Diapositiva | null { return this.diapositivas[this.indice] ?? null; }

  iniciar(id: string): void {
    this.pantallaCompleta();
    this.router.navigate([], { queryParams: { edicion: id } });
  }
  cambiarEdicion(): void { this.router.navigate([], { queryParams: {} }); }
  salir(): void {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    this.router.navigateByUrl(WillGoService.perfilGuardado()?.rol === 'tv' ? '/private-will-go/proyectar' : '/private-will-go/resumen-economia');
  }

  /** Trae los datos; al comenzar cada vuelta se actualizan (tasas, saldos e inversiones cambian durante el día). */
  private cargar(desdeElInicio: boolean): void {
    this.willGo.pantallaTv(this.edicionId).subscribe({
      next: (d) => {
        const anterior = this.actual;
        this.datos = d; this.memo.clear();
        this.error = '';
        this.armar();
        if (desdeElInicio || !anterior) this.indice = 0;
        this.programar();
      },
      error: (e) => {
        this.error = WillGoService.mensajeDeError(e);
        // Si falla (por ejemplo, se cayó el internet), se vuelve a intentar sin dejar la pantalla en blanco
        if (this.datos) this.programar(); else this.temporizador = setTimeout(() => this.cargar(true), 10000);
      },
    });
  }

  private armar(): void {
    const d = this.datos!;
    const lista: Diapositiva[] = [];
    if (d.paises.length) lista.push({ tipo: 'tasas' });
    for (const p of d.paises) lista.push({ tipo: 'pais', pais: p });
    // Los docentes que más han repartido (si alguno ya repartió)
    if (d.paises.some((p) => p.docentes?.length)) lista.push({ tipo: 'docentes' });
    if (d.fondos.length) {
      lista.push({ tipo: 'fondos' });
      d.fondos.forEach((f, k) => lista.push({ tipo: 'fondo', fondo: f, color: COLORES_FONDOS[k % COLORES_FONDOS.length] }));
    }
    this.diapositivas = lista;
    if (this.indice >= lista.length) this.indice = 0;
  }

  private programar(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.vuelta++;
    if (this.pausa || !this.diapositivas.length) return;
    this.temporizador = setTimeout(() => this.zona.run(() => this.avanzar()), SEGUNDOS * 1000);
  }

  private avanzar(): void {
    if (this.indice + 1 >= this.diapositivas.length) {
      // Terminó la vuelta: datos frescos y otra vez desde el precio de la moneda
      this.indice = 0;
      this.cargar(true);
    } else {
      this.indice++;
      this.programar();
    }
  }

  private detener(): void { if (this.temporizador) clearTimeout(this.temporizador); this.temporizador = null; }

  siguiente(): void { if (this.diapositivas.length) { this.indice = (this.indice + 1) % this.diapositivas.length; this.programar(); } }
  anterior(): void { if (this.diapositivas.length) { this.indice = (this.indice - 1 + this.diapositivas.length) % this.diapositivas.length; this.programar(); } }
  alternarPausa(): void { this.pausa = !this.pausa; this.programar(); }

  @HostListener('document:keydown', ['$event'])
  tecla(e: KeyboardEvent): void {
    if (!this.edicionId) return;
    if (e.key === 'ArrowRight') this.siguiente();
    else if (e.key === 'ArrowLeft') this.anterior();
    else if (e.key === ' ') { e.preventDefault(); this.alternarPausa(); }
    else if (e.key === 'f' || e.key === 'F') this.pantallaCompleta();
  }

  pantallaCompleta(): void {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  /** Los controles se esconden (con el cursor) a los 3 s sin mover el mouse. */
  mostrarControles(): void {
    this.controles = true;
    if (this.ocultar) clearTimeout(this.ocultar);
    this.ocultar = setTimeout(() => this.zona.run(() => (this.controles = false)), 3000);
  }

  /** Que el televisor o el computador no apague la pantalla mientras se proyecta. */
  private mantenerEncendida(): void {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((b) => (this.bloqueo = b)).catch(() => {});
  }

  private actualizarHora(): void {
    this.hora = new Date().toLocaleTimeString(this.idioma.locale, { hour: 'numeric', minute: '2-digit' });
  }

  // ----- Datos para cada pantalla -----
  billete(p: PaisTv): string | null {
    const n = p.nombre.trim().toLowerCase();
    return ['wonderland', 'neverland', 'dreamland'].includes(n) ? `assets/images/billetes/${n}/1.jpg` : null;
  }
  cambio(p: PaisTv): number { const i = this.datos?.tasa_inicial || p.tasa_actual || 1; return ((p.tasa_actual - i) / i) * 100; }
  pct(v: number): string { return `${v > 0 ? '+' : ''}${v.toLocaleString(this.idioma.locale, { maximumFractionDigits: 1 })} %`; }
  claro(color: string | null): string { return color ? `color-mix(in srgb, ${color} 55%, #fff)` : '#fff'; }
  claseMedalla(i: number): string {
    return i === 0 ? 'bg-amber-400 text-amber-950' : i === 1 ? 'bg-slate-300 text-slate-900' : i === 2 ? 'bg-orange-700 text-white' : 'bg-white/10 text-white/80';
  }

  /** Lo calculado para las gráficas se guarda hasta que lleguen datos nuevos (así no se redibujan en cada ciclo). */
  private memo = new Map<string, unknown>();
  private recordar<T>(clave: string, calcular: () => T): T {
    if (!this.memo.has(clave)) this.memo.set(clave, calcular());
    return this.memo.get(clave) as T;
  }

  seriePais(p: PaisTv): SerieTv[] {
    // La gráfica arranca en la tasa inicial y sigue cada cálculo
    return this.recordar('sp' + p.id, () => [{ nombre: p.nombre, color: p.color || '#F97316', valores: [this.datos!.tasa_inicial, ...p.historial.map((h) => h.tasa)] }]);
  }
  horasPais(p: PaisTv): string[] {
    return this.recordar('hp' + p.id + this.idioma.actual, () => ['', ...p.historial.map((h) => new Date(h.ventana).toLocaleTimeString(this.idioma.locale, { hour: 'numeric', minute: '2-digit' }))]);
  }

  valores(f: FondoTv): number[] { return f.puntos.map((x) => x.valor); }
  serieFondo(f: FondoTv, color: string): SerieTv[] { return this.recordar('s1' + f.id, () => [{ nombre: f.nombre, color, valores: this.valores(f) }]); }
  valorFinal(f: FondoTv): number { return f.puntos[f.puntos.length - 1]?.valor ?? 100; }
  get etiquetasRondas(): string[] {
    const primero = this.datos?.fondos[0];
    return this.recordar('er' + this.idioma.actual, () => (primero?.puntos ?? []).map((x, i) => (i === 0 ? this.t.instant('wg.tv.inicio') : (x.ronda ?? '').replace(/^(Ronda|Round|Manche)\s*/i, 'R'))));
  }
  get seriesFondos(): SerieTv[] {
    return this.recordar('sf', () => (this.datos?.fondos ?? []).map((f, k) => ({ nombre: f.nombre, color: COLORES_FONDOS[k % COLORES_FONDOS.length], valores: this.valores(f) })));
  }
  get fondosOrdenados(): { fondo: FondoTv; color: string }[] {
    return this.recordar('fo', () => (this.datos?.fondos ?? []).map((f, k) => ({ fondo: f, color: COLORES_FONDOS[k % COLORES_FONDOS.length] }))
      .sort((a, b) => this.valorFinal(b.fondo) - this.valorFinal(a.fondo)));
  }
  logo(f: FondoTv): string | null { return f.logo ? this.willGo.urlFoto(f.logo) : null; }
}
