import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AcudienteWillGoService, EdicionPortal, FondoPortal, HijoPortal, DatosPanelAcudiente } from '../../../../core/services/acudiente-will-go.service';
import { TarjetaFondoComponent } from '../../../private-layout-will-go/tarjeta-fondo.component';
import { GraficaRendimientoComponent } from '../../../private-layout-will-go/grafica-rendimiento.component';
import { formatearNumero } from '../../../private-layout-will-go/numero-miles.directive';
import { ListaMovimientosComponent } from '../../../private-layout-will-go/lista-movimientos.component';

/** Panel del acudiente: reloj de la ronda, su hijo (saldo e inversiones), votar por una empresa y la gráfica. */
@Component({
  selector: 'app-panel-acudiente',
  standalone: true,
  imports: [DatePipe, TarjetaFondoComponent, GraficaRendimientoComponent, ListaMovimientosComponent],
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
              <div class="mt-4 rounded-2xl p-5 text-white shadow bg-gradient-to-br from-emerald-500 to-teal-600">
                <div class="flex items-center gap-2 text-sm font-semibold opacity-95">
                  <span class="w-2.5 h-2.5 rounded-full bg-white animate-pulse" aria-hidden="true"></span>{{ r.nombre }} en curso
                </div>
                @if (r.cierre_programado) {
                  <p class="mt-2 text-sm opacity-90">{{ restante(r.cierre_programado) > 0 ? 'Cierra en' : 'Cerrando…' }}</p>
                  <p class="text-5xl font-extrabold tabular-nums leading-none" role="timer" aria-live="off">{{ reloj(r.cierre_programado) }}</p>
                  <p class="text-xs opacity-90 mt-1">a las {{ r.cierre_programado | date:'h:mm a' }}</p>
                }
                <p class="mt-3 text-sm">{{ r.mi_voto ? 'Ya votaste por ' + nombreFondo(ed, r.mi_voto) + '. Puedes cambiar tu voto antes del cierre.' : 'Aún no has votado en esta ronda.' }}</p>
              </div>
            } @else {
              <div class="mt-4 rounded-2xl p-5 bg-white border border-gray-200 shadow-sm">
                <p class="font-bold text-gray-800">No hay ronda abierta</p>
                <p class="text-sm text-gray-500 mt-1">Cuando empiece la siguiente ronda podrás votar. Esta página se actualiza sola.</p>
              </div>
            }

            <!-- Su hijo -->
            @for (h of hijosDe(ed); track h.id) {
              <section class="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div class="p-5 text-white" [style.background]="h.color || '#1e293b'">
                  <p class="text-sm opacity-90">{{ h.nombre }} {{ h.apellido }}{{ h.pais ? ' · ' + h.pais : '' }}</p>
                  <p class="text-3xl font-extrabold mt-1 break-all">{{ miles(h.saldo) }} <span class="text-base font-semibold opacity-90">{{ h.codigo_moneda }}</span></p>
                  <p class="text-xs opacity-90">billetes en su bolsillo</p>
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
                        <li class="py-2.5 flex items-center justify-between gap-3">
                          <div class="min-w-0">
                            <p class="font-semibold text-gray-800 truncate">{{ i.fondo }}</p>
                            <p class="text-xs text-gray-500">{{ i.ronda }} · invirtió {{ miles(i.monto) }}</p>
                          </div>
                          <div class="text-right shrink-0">
                            @if (i.estado === 'abierta') {
                              <span class="text-xs font-semibold px-2 py-1 rounded-full bg-sky-100 text-sky-800">En curso</span>
                            } @else {
                              <p class="font-bold" [class]="Number(i.rendimiento_final) >= 0 ? 'text-emerald-700' : 'text-red-600'">{{ miles(i.monto_pagado) }}</p>
                              <p class="text-xs" [class]="Number(i.rendimiento_final) >= 0 ? 'text-emerald-700' : 'text-red-600'">{{ pct(i.rendimiento_final) }}{{ i.estado === 'por_cobrar' ? ' · por cobrar' : '' }}</p>
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
            <p class="text-sm text-gray-500">Tienes un voto por ronda. Las empresas más votadas reciben un pequeño impulso.</p>
            <div class="mt-3 grid gap-4 md:grid-cols-2">
              @for (f of ed.fondos; track f.id) {
                <wg-tarjeta-fondo [fondo]="f" [logoUrl]="logo(f)">
                  <div class="px-5 py-3 border-t border-gray-100">
                    @if (ed.ronda?.mi_voto === f.id) {
                      <p class="w-full py-2.5 rounded-xl text-center font-bold text-emerald-700 bg-emerald-50 border-2 border-emerald-500">✓ Tu voto</p>
                    } @else {
                      <button type="button" (click)="votar(ed, f)" [disabled]="!puedeVotar(ed) || votando"
                              class="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
                        {{ ed.ronda ? (ed.ronda.mi_voto ? 'Cambiar mi voto aquí' : 'Votar por ' + f.nombre) : 'Votar (cuando abra la ronda)' }}
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
    if (vencida && !this.cargando && this.ahoraLocal % 10000 < 1000) this.cargar();
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

  hijosDe(ed: EdicionPortal): HijoPortal[] { return (this.datos?.hijos ?? []).filter((h) => h.edicion_id === ed.id); }
  nombreFondo(ed: EdicionPortal, id: string): string { return ed.fondos.find((f) => f.id === id)?.nombre ?? 'una empresa'; }
  logo(f: FondoPortal): string | null { return f.logo ? this.servicio.urlLogo(f.logo) : null; }
  puedeVotar(ed: EdicionPortal): boolean { return !!ed.ronda && (!ed.ronda.cierre_programado || this.restante(ed.ronda.cierre_programado) > 0); }

  pct(r: unknown): string {
    const v = Number(r) * 100;
    return `${v > 0 ? '+' : ''}${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
  }

  votar(ed: EdicionPortal, f: FondoPortal): void {
    if (!ed.ronda || this.votando) return;
    const ronda = ed.ronda;
    this.votando = true;
    this.error = '';
    this.servicio.votar(ronda.id, f.id).subscribe({
      next: () => {
        this.votando = false;
        ronda.mi_voto = f.id;
        this.aviso = `¡Listo! Votaste por ${f.nombre} en la ${ronda.nombre}.`;
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
