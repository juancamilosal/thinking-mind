import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DatosTipoCambio, PaisTasaCambio, WillGoService, EdicionVigente } from '../../../../core/services/will-go.service';
import { formatearNumero } from '../../numero-miles.directive';
import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { GraficaTasaComponent } from '../../grafica-tasa.component';
import { FechaWillGoPipe } from '../../fecha.pipe';

/** Tipo de cambio de cada país: cuánto vale hoy un billete, cómo ha cambiado y por qué. */
@Component({
  selector: 'app-tipo-cambio-will-go',
  standalone: true,
  imports: [FormsModule, FechaWillGoPipe, GraficaTasaComponent, SelectorEdicionComponent, TranslatePipe],
  template: `
    <div class="max-w-4xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.operacion.tipoCambio.titulo' | translate }}</h1>
          <p class="text-gray-500 mt-1">{{ 'wg.operacion.tipoCambio.subtitulo' | translate: { n: datos?.intervalo_minutos ?? 30 } }}</p>
        </div>
      </div>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" (cambio)="cargar()" />

      @if (cargando && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.operacion.comun.cargando' | translate }}</div>
      } @else if (error && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.operacion.comun.sinEquipo' | translate }}</div>
      } @else if (datos) {
        <!-- Próximo cálculo -->
        <p class="mt-4 inline-flex items-center gap-2 text-sm rounded-full px-3 py-1.5" [class]="datos.proximo_calculo ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'">
          <span class="w-2 h-2 rounded-full" [class]="datos.proximo_calculo ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'" aria-hidden="true"></span>
          {{ datos.proximo_calculo ? ('wg.operacion.tipoCambio.proximoCalculo' | translate: { hora: (datos.proximo_calculo | wgFecha:'h:mm a') }) : ('wg.operacion.tipoCambio.fueraHorario' | translate) }}
        </p>

        <!-- Tarjetas por país -->
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          @for (p of datos.paises; track p.id) {
            <div class="rounded-2xl p-4 text-white shadow" [style.background]="p.color || '#1e293b'">
              <p class="text-sm font-semibold opacity-95">{{ p.nombre }}</p>
              <p class="text-3xl font-extrabold mt-1">{{ miles(p.tasa_actual) }}</p>
              <p class="text-xs opacity-90">{{ 'wg.operacion.tipoCambio.pesosPorBillete' | translate: { moneda: p.codigo_moneda } }}</p>
              <div class="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span class="px-2 py-0.5 rounded-full bg-white/20 font-semibold">{{ 'wg.operacion.tipoCambio.desdeInicio' | translate: { v: desdeInicio(p) } }}</span>
                @if (ultimo(p); as u) {
                  <span class="px-2 py-0.5 rounded-full bg-white/20 font-semibold">{{ u.tasa_nueva > u.tasa_anterior ? '▲' : u.tasa_nueva < u.tasa_anterior ? '▼' : '=' }} {{ 'wg.operacion.tipoCambio.ultimo' | translate: { v: porcentaje(u) } }}</span>
                }
                <span class="px-2 py-0.5 rounded-full bg-white/20">{{ 'wg.operacion.tipoCambio.presentes' | translate: { n: p.presentes } }}</span>
              </div>
            </div>
          }
        </div>

        <div class="mt-5">
          <wg-grafica-tasa [paises]="datos.paises" [tasaInicial]="datos.tasa_inicial" [intervalo]="datos.intervalo_minutos" />
        </div>

        <!-- Historial por país -->
        <section class="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div class="px-4 pt-4 flex flex-wrap items-center gap-2">
            <h2 class="font-bold text-gray-800 mr-auto">{{ 'wg.operacion.tipoCambio.historial' | translate }}</h2>
            @for (p of datos.paises; track p.id) {
              <button type="button" (click)="paisHistorial = p.id" class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2"
                      [style.background]="paisHistorial === p.id ? (p.color || '#1e293b') : '#fff'" [style.border-color]="p.color || '#cbd5e1'"
                      [style.color]="paisHistorial === p.id ? '#fff' : '#334155'">{{ p.nombre }}</button>
            }
          </div>
          @if (!historial.length) {
            <p class="px-4 py-6 text-sm text-gray-500">{{ 'wg.operacion.tipoCambio.sinCalculos' | translate }}</p>
          } @else {
            <div class="mt-3 overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th class="pl-4 pr-2 py-2 font-semibold">{{ 'wg.operacion.tipoCambio.hora' | translate }}</th>
                  <th class="hidden sm:table-cell px-2 py-2 font-semibold text-right">{{ 'wg.operacion.tipoCambio.presentesCol' | translate }}</th>
                  <th class="hidden sm:table-cell px-2 py-2 font-semibold text-right">{{ 'wg.operacion.tipoCambio.puntos' | translate }}</th>
                  <th class="px-2 py-2 font-semibold text-right" [title]="'wg.operacion.tipoCambio.indiceTitle' | translate: { n: datos.referencia }">{{ 'wg.operacion.tipoCambio.indice' | translate }}</th>
                  <th class="px-2 py-2 font-semibold text-right">{{ 'wg.operacion.tipoCambio.tasa' | translate }}</th>
                  <th class="pl-2 pr-4 py-2 font-semibold text-right">{{ 'wg.operacion.tipoCambio.cambio' | translate }}</th>
                </tr></thead>
                <tbody>
                  @for (h of historial; track h.ventana) {
                    <tr class="border-b border-gray-50">
                      <td class="pl-4 pr-2 py-2 whitespace-nowrap text-gray-600"><span class="sm:hidden">{{ h.ventana | wgFecha:'h:mm a' }}</span><span class="hidden sm:inline">{{ h.ventana | wgFecha:'d MMM, h:mm a' }}</span></td>
                      <td class="hidden sm:table-cell px-2 py-2 text-right tabular-nums">{{ h.participantes_presentes }}</td>
                      <td class="hidden sm:table-cell px-2 py-2 text-right tabular-nums">{{ decimal(h.puntos) }}</td>
                      <td class="px-2 py-2 text-right tabular-nums font-semibold" [class]="h.indice > datos.referencia ? 'text-emerald-700' : h.indice < datos.referencia ? 'text-red-600' : 'text-gray-700'">{{ decimal(h.indice) }}</td>
                      <td class="px-2 py-2 text-right tabular-nums whitespace-nowrap"><span class="hidden sm:inline">{{ miles(h.tasa_anterior) }} → </span><b>{{ miles(h.tasa_nueva) }}</b></td>
                      <td class="pl-2 pr-4 py-2 text-right tabular-nums font-semibold whitespace-nowrap" [class]="h.tasa_nueva > h.tasa_anterior ? 'text-emerald-700' : h.tasa_nueva < h.tasa_anterior ? 'text-red-600' : 'text-gray-500'">{{ porcentaje(h) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- Cómo se calcula -->
        <details class="mt-5 bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
          <summary class="font-semibold text-gray-800 cursor-pointer">{{ 'wg.operacion.tipoCambio.comoSeCalcula' | translate }}</summary>
          <ul class="mt-3 space-y-1.5 list-disc pl-5">
            <li>{{ 'wg.operacion.tipoCambio.regla1' | translate: { n: datos.intervalo_minutos } }}</li>
            <li [innerHTML]="'wg.operacion.tipoCambio.regla2' | translate: { n: datos.referencia }"></li>
            <li>{{ 'wg.operacion.tipoCambio.regla3' | translate }}</li>
            <li>{{ 'wg.operacion.tipoCambio.regla4' | translate: { min: miles(datos.tope_minimo), max: miles(datos.tope_maximo) } }}</li>
          </ul>
        </details>
      }
    </div>
  `,
})
export class TipoCambioWillGo implements OnInit, OnDestroy {
  private willGo = inject(WillGoService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  ediciones: EdicionVigente[] = [];
  edicionId = '';
  datos: DatosTipoCambio | null = null;
  paisHistorial = '';
  cargando = true;
  error = '';
  private refresco: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
    this.refresco = setInterval(() => { if (this.edicionId && !this.cargando) this.cargar(); }, 60000);
  }
  ngOnDestroy(): void { if (this.refresco) clearInterval(this.refresco); }

  cargar(): void {
    this.cargando = true;
    this.willGo.tipoCambio(this.edicionId).subscribe({
      next: (d) => { this.datos = d; if (!d.paises.some((p) => p.id === this.paisHistorial)) this.paisHistorial = d.paises[0]?.id ?? ''; this.cargando = false; this.error = ''; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  /** Historial del país elegido, lo más reciente primero. */
  get historial() { return [...(this.datos?.paises.find((p) => p.id === this.paisHistorial)?.historial ?? [])].reverse(); }
  ultimo(p: PaisTasaCambio) { return p.historial[p.historial.length - 1] ?? null; }
  desdeInicio(p: PaisTasaCambio): string {
    const v = ((p.tasa_actual - (this.datos?.tasa_inicial ?? p.tasa_actual)) / (this.datos?.tasa_inicial || 1)) * 100;
    return `${v > 0 ? '+' : ''}${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
  }
  porcentaje(h: { tasa_anterior: number; tasa_nueva: number }): string {
    const v = ((h.tasa_nueva - h.tasa_anterior) / (h.tasa_anterior || 1)) * 100;
    return `${v > 0 ? '+' : ''}${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;
  }
  decimal(v: number): string { return Number(v).toLocaleString('es-CO', { maximumFractionDigits: 2 }); }
}
