import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DatosTipoCambio, PaisTasaCambio, WillGoService } from '../../../../core/services/will-go.service';
import { formatearNumero } from '../../numero-miles.directive';
import { GraficaTasaComponent } from '../../grafica-tasa.component';

/** Tipo de cambio de cada país: cuánto vale hoy un billete, cómo ha cambiado y por qué. */
@Component({
  selector: 'app-tipo-cambio-will-go',
  standalone: true,
  imports: [FormsModule, DatePipe, GraficaTasaComponent],
  template: `
    <div class="max-w-4xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Tipo de cambio</h1>
          <p class="text-gray-500 mt-1">Cuánto vale un billete de cada país. Cambia cada {{ datos?.intervalo_minutos ?? 30 }} minutos según la rúbrica.</p>
        </div>
        @if (ediciones.length > 1) {
          <select [(ngModel)]="edicionId" (ngModelChange)="cargar()" aria-label="Edición" class="sm:w-72 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            @for (e of ediciones; track e.id) { <option [value]="e.id">{{ e.nombre }}</option> }
          </select>
        }
      </div>

      @if (cargando && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando…</div>
      } @else if (error && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">No haces parte del equipo de ninguna edición abierta.</div>
      } @else if (datos) {
        <!-- Próximo cálculo -->
        <p class="mt-4 inline-flex items-center gap-2 text-sm rounded-full px-3 py-1.5" [class]="datos.proximo_calculo ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-600'">
          <span class="w-2 h-2 rounded-full" [class]="datos.proximo_calculo ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'" aria-hidden="true"></span>
          {{ datos.proximo_calculo ? 'Próximo cálculo a las ' + (datos.proximo_calculo | date:'h:mm a') : 'Fuera del horario: la tasa está quieta hasta la siguiente jornada' }}
        </p>

        <!-- Tarjetas por país -->
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          @for (p of datos.paises; track p.id) {
            <div class="rounded-2xl p-4 text-white shadow" [style.background]="p.color || '#1e293b'">
              <p class="text-sm font-semibold opacity-95">{{ p.nombre }}</p>
              <p class="text-3xl font-extrabold mt-1">{{ miles(p.tasa_actual) }}</p>
              <p class="text-xs opacity-90">pesos por 1 billete {{ p.codigo_moneda }}</p>
              <div class="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span class="px-2 py-0.5 rounded-full bg-white/20 font-semibold">{{ desdeInicio(p) }} desde el inicio</span>
                @if (ultimo(p); as u) {
                  <span class="px-2 py-0.5 rounded-full bg-white/20 font-semibold">{{ u.tasa_nueva > u.tasa_anterior ? '▲' : u.tasa_nueva < u.tasa_anterior ? '▼' : '=' }} último: {{ porcentaje(u) }}</span>
                }
                <span class="px-2 py-0.5 rounded-full bg-white/20">{{ p.presentes }} presentes</span>
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
            <h2 class="font-bold text-gray-800 mr-auto">Historial de cálculos</h2>
            @for (p of datos.paises; track p.id) {
              <button type="button" (click)="paisHistorial = p.id" class="px-3 py-1.5 rounded-lg text-xs font-semibold border-2"
                      [style.background]="paisHistorial === p.id ? (p.color || '#1e293b') : '#fff'" [style.border-color]="p.color || '#cbd5e1'"
                      [style.color]="paisHistorial === p.id ? '#fff' : '#334155'">{{ p.nombre }}</button>
            }
          </div>
          @if (!historial.length) {
            <p class="px-4 py-6 text-sm text-gray-500">Todavía no hay cálculos.</p>
          } @else {
            <div class="mt-3 overflow-x-auto">
              <table class="w-full text-sm">
                <thead><tr class="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th class="pl-4 pr-2 py-2 font-semibold">Hora</th>
                  <th class="hidden sm:table-cell px-2 py-2 font-semibold text-right">Presentes</th>
                  <th class="hidden sm:table-cell px-2 py-2 font-semibold text-right">Puntos</th>
                  <th class="px-2 py-2 font-semibold text-right" title="Puntos por estudiante presente (meta: {{ datos.referencia }})">Índice</th>
                  <th class="px-2 py-2 font-semibold text-right">Tasa</th>
                  <th class="pl-2 pr-4 py-2 font-semibold text-right">Cambio</th>
                </tr></thead>
                <tbody>
                  @for (h of historial; track h.ventana) {
                    <tr class="border-b border-gray-50">
                      <td class="pl-4 pr-2 py-2 whitespace-nowrap text-gray-600"><span class="sm:hidden">{{ h.ventana | date:'h:mm a' }}</span><span class="hidden sm:inline">{{ h.ventana | date:'d MMM, h:mm a' }}</span></td>
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
          <summary class="font-semibold text-gray-800 cursor-pointer">¿Cómo se calcula?</summary>
          <ul class="mt-3 space-y-1.5 list-disc pl-5">
            <li>Cada {{ datos.intervalo_minutos }} minutos, dentro del horario de la economía, se suman los puntos de la rúbrica de cada país (cada calificación de 0 a 12 aporta su puntaje ÷ 3).</li>
            <li>Esos puntos se dividen entre los estudiantes presentes: es el <b>índice</b>. La meta es <b>{{ datos.referencia }}</b>.</li>
            <li>Si el índice supera la meta, la moneda sube (hasta +2,4 %); si queda por debajo, baja (hasta −1,2 %).</li>
            <li>La tasa nunca baja de {{ miles(datos.tope_minimo) }} ni sube de {{ miles(datos.tope_maximo) }} pesos por billete.</li>
          </ul>
        </details>
      }
    </div>
  `,
})
export class TipoCambioWillGo implements OnInit, OnDestroy {
  private willGo = inject(WillGoService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  ediciones: { id: string; nombre: string; estado: string }[] = [];
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
