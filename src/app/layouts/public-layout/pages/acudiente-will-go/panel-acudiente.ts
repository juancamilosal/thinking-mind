import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AcudienteWillGoService, EdicionPortal, FondoPortal, HijoPortal, DatosPanelAcudiente } from '../../../../core/services/acudiente-will-go.service';
import { TarjetaFondoComponent } from '../../../private-layout-will-go/tarjeta-fondo.component';
import { GraficaRendimientoComponent } from '../../../private-layout-will-go/grafica-rendimiento.component';
import { formatearNumero } from '../../../private-layout-will-go/numero-miles.directive';
import { ListaMovimientosComponent } from '../../../private-layout-will-go/lista-movimientos.component';
import { ProcesandoRondaComponent } from '../../../private-layout-will-go/procesando-ronda.component';

/** Panel del acudiente: reloj de la ronda, su hijo (saldo e inversiones), votar por una empresa y la gráfica. */
@Component({
  selector: 'app-panel-acudiente',
  standalone: true,
  imports: [DatePipe, TarjetaFondoComponent, GraficaRendimientoComponent, ListaMovimientosComponent, ProcesandoRondaComponent],
  template: `
    <div class="min-h-screen bg-slate-50">
      <header class="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200">
        <div class="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <span class="font-black tracking-tight text-slate-800">WILL-GO <span class="text-orange-500">ECONOMY</span></span>
          <button type="button" (click)="salir()" class="text-sm font-semibold text-gray-500 hover:text-gray-800">Salir</button>
        </div>
      </header>

      <main class="max-w-3xl mx-auto px-4 py-5 pb-16">
        @if (cargando && !datos) {
          <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando…</div>
        } @else if (error && !datos) {
          <div class="bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
        } @else if (datos) {
          <h1 class="text-2xl font-bold text-gray-800">Hola, {{ datos.acudiente.nombre }}</h1>
          @if (!datos.ediciones.length) {
            <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">Tu hijo no está en una edición activa de Will-Go.</div>
          }
          @if (aviso) { <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800" role="status">{{ aviso }}</p> }
          @if (error) { <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700" role="alert">{{ error }}</p> }

          @for (ed of datos.ediciones; track ed.id) {
            <!-- Reloj de la ronda -->
            @if (ed.ronda; as r) {
              @if (r.cierre_programado && restante(r.cierre_programado) <= 0) {
                <wg-procesando-ronda class="block mt-4" [ronda]="r.nombre" />
              } @else {
              <div class="mt-4 rounded-2xl p-5 text-white shadow bg-gradient-to-br from-emerald-500 to-teal-600">
                <div class="flex items-center gap-2 text-sm font-semibold opacity-95">
                  <span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse" aria-hidden="true"></span>{{ r.nombre }} en curso
                </div>
                @if (r.cierre_programado) {
                  <p class="mt-2 text-sm opacity-90">{{ restante(r.cierre_programado) > 0 ? 'Cierra en' : 'Cerrando…' }}</p>
                  <p class="text-5xl font-extrabold tabular-nums leading-none" role="timer" aria-live="off">{{ reloj(r.cierre_programado) }}</p>
                  <p class="text-xs opacity-90 mt-1">a las {{ r.cierre_programado | date:'h:mm a' }}</p>
                }
                <div class="mt-4 rounded-xl bg-white/15 px-4 py-3">
                  <p class="text-sm font-semibold">Tus votos: {{ votosDe(ed).length }} de {{ maxVotos(ed) }}</p>
                  <p class="text-xs opacity-90 mt-0.5">
                    {{ votosDe(ed).length ? 'Votaste por ' + nombresVotos(ed) + '.' : 'Aún no has votado en esta ronda.' }}
                    {{ quedan(ed) ? 'Te ' + (quedan(ed) === 1 ? 'queda 1 voto' : 'quedan ' + quedan(ed) + ' votos') + '.' : 'Puedes cambiarlos antes del cierre.' }}
                  </p>
                </div>
              </div>
              }
            } @else {
              <div class="mt-4 rounded-2xl p-5 bg-white border border-gray-200 shadow-sm">
                <p class="font-bold text-gray-800">No hay ronda abierta</p>
                @if (ed.proxima_ronda && restante(ed.proxima_ronda) > 60000) {
                  <p class="text-sm text-gray-600 mt-1">La próxima ronda empieza el <b>{{ ed.proxima_ronda | date:"EEEE d 'de' MMMM, h:mm a" }}</b>; ahí podrás votar de nuevo.</p>
                } @else if (ed.proxima_ronda) {
                  <p class="text-sm text-gray-600 mt-1">La próxima ronda empieza en un momento.</p>
                } @else {
                  <p class="text-sm text-gray-500 mt-1">Cuando empiece la siguiente ronda podrás votar. Esta página se actualiza sola.</p>
                }
              </div>
            }

            <!-- Su hijo -->
            @for (h of hijosDe(ed); track h.id) {
              <section class="mt-4 bg-white rounded-3xl border border-gray-200 shadow-md overflow-hidden">
                <!-- Encabezado con el color de su país -->
                <div class="relative p-5 text-white overflow-hidden" [style.background]="fondoHijo(h)">
                  <div class="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" aria-hidden="true"></div>
                  <div class="absolute right-10 -bottom-12 w-28 h-28 rounded-full bg-white/10" aria-hidden="true"></div>
                  <div class="relative flex items-center gap-4">
                    <div class="w-14 h-14 shrink-0 flex items-center justify-center" aria-hidden="true">
                      <img src="assets/images/will-go/estudiante.png" alt="" class="w-full h-full object-contain">
                    </div>
                    <div class="min-w-0">
                      <h2 class="text-xl sm:text-2xl font-extrabold leading-tight">{{ h.nombre }} {{ h.apellido }}</h2>
                      @if (h.pais) {
                        <span class="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21V5a2 2 0 012-2h9l1 2h4a2 2 0 012 2v9a2 2 0 01-2 2h-5l-1-2H5"/></svg>
                          {{ h.pais }}
                        </span>
                      }
                    </div>
                  </div>
                  <div class="relative mt-5">
                    <p class="text-xs uppercase tracking-wide font-semibold opacity-90">En su bolsillo</p>
                    <p class="text-4xl font-extrabold leading-none mt-1 break-all">{{ miles(h.saldo) }} <span class="text-lg font-bold opacity-90">{{ h.codigo_moneda }}</span></p>
                  </div>
                  <div class="relative mt-4 grid grid-cols-2 gap-2">
                    <div class="rounded-xl bg-white/15 px-3 py-2">
                      <p class="text-[11px] uppercase tracking-wide opacity-90">Invertido hoy</p>
                      <p class="text-lg font-extrabold break-all">{{ miles(invertidoHoy(h)) }}</p>
                    </div>
                    <div class="rounded-xl bg-white/15 px-3 py-2">
                      <p class="text-[11px] uppercase tracking-wide opacity-90">{{ gananciaTotal(h) >= 0 ? 'Ha ganado' : 'Ha perdido' }}</p>
                      <p class="text-lg font-extrabold break-all">{{ gananciaTotal(h) >= 0 ? '+' : '−' }}{{ miles(abs(gananciaTotal(h))) }}</p>
                    </div>
                  </div>
                </div>
                <div class="p-4">
                  <div class="inline-flex gap-1 bg-gray-100 rounded-xl p-1" role="tablist" [attr.aria-label]="'Información de ' + h.nombre">
                    @for (v of vistasHijo; track v.id) {
                      <button type="button" role="tab" [attr.aria-selected]="vistaDe(h) === v.id" (click)="vista[h.id] = v.id"
                              class="px-4 py-1.5 rounded-lg text-sm font-semibold" [class]="vistaDe(h) === v.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'">{{ v.texto }}</button>
                    }
                  </div>
                  @if (vistaDe(h) === 'movimientos') {
                    <wg-lista-movimientos class="block mt-3" [movimientos]="h.movimientos" [pais]="{ nombre: h.pais || '', color: h.color }"
                                          [totalEntro]="h.total_entro" [totalSalio]="h.total_salio" vacio="Todavía no tiene movimientos." />
                  } @else if (!h.inversiones.length) {
                    <p class="text-sm text-gray-500 mt-3">Todavía no ha invertido en ninguna empresa.</p>
                  } @else {
                    <ul class="mt-3 divide-y divide-gray-100">
                      @for (i of h.inversiones; track i.id) {
                        <li class="py-3 flex items-center gap-3">
                          @if (logoPorNombre(ed, i.fondo); as src) {
                            <img [src]="src" alt="" class="w-11 h-11 shrink-0 rounded-xl object-cover">
                          } @else {
                            <div class="w-11 h-11 shrink-0 rounded-xl bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center" aria-hidden="true">{{ iniciales(i.fondo) }}</div>
                          }
                          <div class="min-w-0 flex-1">
                            <p class="font-bold text-gray-800 truncate">{{ i.fondo }}</p>
                            <p class="text-xs text-gray-500">Desde la {{ i.ronda }} · invirtió {{ miles(i.monto) }}</p>
                          </div>
                          <div class="text-right shrink-0">
                            <p class="text-lg font-extrabold text-gray-800">{{ miles(i.valor) }}</p>
                            <p class="text-xs font-bold" [class]="i.valor >= i.monto ? 'text-emerald-700' : 'text-red-600'">{{ i.valor >= i.monto ? '+' : '−' }}{{ miles(abs(i.valor - i.monto)) }}</p>
                            @if (i.estado === 'abierta') {
                              <span class="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">Sigue invertido</span>
                            } @else {
                              <span class="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Retirado</span>
                            }
                          </div>
                        </li>
                      }
                    </ul>
                  }
                </div>
              </section>
            }

            <!-- Gráfica: ayuda a decidir el voto -->
            <div class="mt-6">
              <wg-grafica-rendimiento [fondos]="ed.fondos" [rondas]="ed.rondas" />
            </div>

            <!-- Votar -->
            <h2 class="mt-6 text-lg font-bold text-gray-800">¿Qué empresa crees que va a crecer?</h2>
            <p class="text-sm text-gray-500">Tienes {{ ed.ronda?.votos_por_ronda ?? 2 }} votos por ronda, para empresas distintas. Las más votadas reciben un pequeño impulso.</p>
            <div class="mt-3 grid gap-4 md:grid-cols-2 md:auto-rows-fr">
              @for (f of ed.fondos; track f.id) {
                <wg-tarjeta-fondo [fondo]="f" [logoUrl]="logo(f)">
                  <div class="px-5 py-3 border-t border-gray-100">
                    @if (votosDe(ed).includes(f.id)) {
                      <div class="flex items-center gap-2">
                        <p class="flex-1 py-2.5 rounded-xl text-center font-bold text-emerald-700 bg-emerald-50 border-2 border-emerald-500">✓ Tu voto</p>
                        <button type="button" (click)="votar(ed, f, true)" [disabled]="!puedeVotar(ed) || votando"
                                class="px-4 py-2.5 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-40">Quitar</button>
                      </div>
                    } @else {
                      <button type="button" (click)="votar(ed, f)" [disabled]="!puedeVotar(ed) || votando || !quedan(ed)"
                              class="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
                        {{ !ed.ronda ? 'Votar (cuando abra la ronda)' : quedan(ed) ? 'Votar por ' + f.nombre : 'Ya usaste tus votos' }}
                      </button>
                    }
                  </div>
                </wg-tarjeta-fondo>
              }
            </div>

          }
        }
      </main>
    </div>
  `,
})
export class PanelAcudiente implements OnInit, OnDestroy {
  private servicio = inject(AcudienteWillGoService);
  private router = inject(Router);
  readonly Number = Number;
  abs(v: number): number { return Math.abs(v); }
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);

  datos: DatosPanelAcudiente | null = null;
  readonly vistasHijo: { id: 'inversiones' | 'movimientos'; texto: string }[] = [
    { id: 'inversiones', texto: 'Inversiones' },
    { id: 'movimientos', texto: 'Movimientos' },
  ];
  vista: Record<string, 'inversiones' | 'movimientos'> = {};
  vistaDe(h: HijoPortal): 'inversiones' | 'movimientos' { return this.vista[h.id] ?? 'inversiones'; }
  cargando = true;
  votando = false;
  error = '';
  aviso = '';
  ahoraLocal = Date.now();
  private desfase = 0;
  private reloj$: ReturnType<typeof setInterval> | null = null;
  private refresco$: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!AcudienteWillGoService.sesion()) { this.router.navigateByUrl('/acudiente-will-go'); return; }
    this.cargar();
    this.reloj$ = setInterval(() => this.tic(), 1000);
    this.refresco$ = setInterval(() => this.cargar(), 20000); // votos, rondas e inversiones casi en tiempo real
  }

  ngOnDestroy(): void {
    if (this.reloj$) clearInterval(this.reloj$);
    if (this.refresco$) clearInterval(this.refresco$);
  }

  private tic(): void {
    this.ahoraLocal = Date.now();
    // Cuando el reloj llega a 0, recarga para ver la ronda siguiente
    const vencida = this.datos?.ediciones.some((e) => e.ronda?.cierre_programado && this.restante(e.ronda.cierre_programado) < -3000);
    if (vencida && !this.cargando && this.ahoraLocal % 5000 < 1000) this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.servicio.panel().subscribe({
      next: (d) => { this.datos = d; this.desfase = new Date(d.ahora).getTime() - Date.now(); this.cargando = false; this.error = ''; },
      error: (e) => {
        this.cargando = false;
        if (AcudienteWillGoService.sesionVencida(e)) { this.salir(); return; }
        this.error = AcudienteWillGoService.mensaje(e);
      },
    });
  }

  restante(cierre: string): number { return new Date(cierre).getTime() - (this.ahoraLocal + this.desfase); }

  reloj(cierre: string): string {
    const s = Math.max(0, Math.ceil(this.restante(cierre) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const dos = (n: number) => String(n).padStart(2, '0');
    return h ? `${h}:${dos(m)}:${dos(x)}` : `${dos(m)}:${dos(x)}`;
  }

  /** Degradado suave con el color del país del hijo. */
  fondoHijo(h: HijoPortal): string {
    const c = h.color || '#1e293b';
    return `linear-gradient(135deg, ${c} 0%, ${c} 55%, color-mix(in srgb, ${c} 70%, #000) 100%)`;
  }
  /** Lo que valen hoy sus inversiones que siguen en las empresas. */
  invertidoHoy(h: HijoPortal): number { return h.inversiones.filter((i) => i.estado === 'abierta').reduce((t, i) => t + Number(i.valor), 0); }
  /** Lo que ha ganado (o perdido) con todas sus inversiones, vigentes y retiradas. */
  gananciaTotal(h: HijoPortal): number { return h.inversiones.reduce((t, i) => t + Number(i.valor) - Number(i.monto), 0); }
  logoPorNombre(ed: EdicionPortal, nombre: string): string | null { const f = ed.fondos.find((x) => x.nombre === nombre); return f ? this.logo(f) : null; }
  iniciales(n: string): string { return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); }

  hijosDe(ed: EdicionPortal): HijoPortal[] { return (this.datos?.hijos ?? []).filter((h) => h.edicion_id === ed.id); }
  nombreFondo(ed: EdicionPortal, id: string): string { return ed.fondos.find((f) => f.id === id)?.nombre ?? 'una empresa'; }
  logo(f: FondoPortal): string | null { return f.logo ? this.servicio.urlLogo(f.logo) : null; }
  puedeVotar(ed: EdicionPortal): boolean { return !!ed.ronda && (!ed.ronda.cierre_programado || this.restante(ed.ronda.cierre_programado) > 0); }

  pct(r: unknown): string {
    const v = Number(r) * 100;
    return `${v > 0 ? '+' : ''}${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
  }

  votosDe(ed: EdicionPortal): string[] { return ed.ronda?.mis_votos ?? []; }
  maxVotos(ed: EdicionPortal): number { return ed.ronda?.votos_por_ronda ?? 2; }
  quedan(ed: EdicionPortal): number { return Math.max(0, this.maxVotos(ed) - this.votosDe(ed).length); }
  nombresVotos(ed: EdicionPortal): string { return this.votosDe(ed).map((id) => this.nombreFondo(ed, id)).join(' y '); }

  votar(ed: EdicionPortal, f: FondoPortal, quitar = false): void {
    if (!ed.ronda || this.votando) return;
    const ronda = ed.ronda;
    this.votando = true;
    this.error = '';
    this.servicio.votar(ronda.id, f.id, quitar).subscribe({
      next: (r) => {
        this.votando = false;
        ronda.mis_votos = r.mis_votos;
        this.aviso = quitar ? `Quitaste tu voto por ${f.nombre}.` : `¡Listo! Votaste por ${f.nombre} en la ${ronda.nombre}.`;
        setTimeout(() => (this.aviso = ''), 5000);
      },
      error: (e) => {
        this.votando = false;
        if (AcudienteWillGoService.sesionVencida(e)) { this.salir(); return; }
        this.error = AcudienteWillGoService.mensaje(e);
        this.cargar();
      },
    });
  }

  salir(): void {
    this.servicio.salir();
    this.router.navigateByUrl('/acudiente-will-go');
  }
}
