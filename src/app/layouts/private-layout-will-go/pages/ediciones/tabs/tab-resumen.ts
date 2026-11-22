import { Component, Input, OnChanges, inject } from '@angular/core';
import { Edicion, PaisResumen, ResumenFinal, WillGoService } from '../../../../../core/services/will-go.service';
import { formatearNumero } from '../../../numero-miles.directive';

/** Resumen final de la edición: empresas, banco, caja, tienda y estudiantes por lo que tienen. */
@Component({
  selector: 'app-tab-resumen',
  standalone: true,
  template: `
    @if (cargando) {
      <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando resumen…</div>
    } @else if (error) {
      <div class="bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
    } @else if (datos) {
      @if (edicion.estado !== 'cerrada') {
        <p class="mb-4 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-900">
          Vista previa: la edición sigue abierta y estos números cambian. Al cerrarla quedan fijos.
        </p>
      }

      <!-- Empresas -->
      <section class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="font-bold text-gray-800">Empresas de W-Funds</h3>
          <p class="text-sm text-gray-500">{{ datos.rondas }} {{ datos.rondas === 1 ? 'ronda' : 'rondas' }}</p>
        </div>
        @if (!datos.empresas.length) {
          <p class="mt-3 text-sm text-gray-500">La edición no tiene empresas.</p>
        } @else {
          <ol class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            @for (f of datos.empresas; track f.fondo_id; let i = $index) {
              <li class="flex items-center gap-3 rounded-xl border p-3" [class]="i === 0 && f.rondas ? 'border-amber-300 bg-amber-50' : 'border-gray-200'">
                <span class="w-6 text-center text-sm font-bold" [class]="i === 0 && f.rondas ? 'text-amber-700' : 'text-gray-400'">{{ i === 0 && f.rondas ? '🏆' : i + 1 }}</span>
                @if (f.logo) {
                  <img [src]="urlFoto(f.logo)" [alt]="'Logo de ' + f.nombre" class="w-11 h-11 rounded-xl object-cover bg-gray-50 ring-1 ring-black/5">
                } @else {
                  <div class="w-11 h-11 rounded-xl bg-slate-700 text-white flex items-center justify-center text-sm font-bold">{{ iniciales(f.nombre) }}</div>
                }
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-gray-800 truncate">{{ f.nombre }}</p>
                  <p class="text-xs text-gray-500">
                    @if (f.rondas) { Mejor {{ pct(f.mejor) }} · peor {{ pct(f.peor) }} } @else { Sin rondas }
                  </p>
                </div>
                <p class="text-lg font-extrabold" [class]="f.acumulado > 0 ? 'text-emerald-700' : f.acumulado < 0 ? 'text-red-600' : 'text-gray-500'">{{ pct(f.acumulado) }}</p>
              </li>
            }
          </ol>
        }
      </section>

      <!-- País -->
      @if (datos.paises.length > 1) {
        <div class="mt-5 flex flex-wrap gap-2">
          @for (p of datos.paises; track p.id) {
            <button type="button" (click)="pais = p" class="px-4 py-2 rounded-xl text-sm font-semibold border-2"
                    [style.background]="pais?.id === p.id ? (p.color || '#1e293b') : '#fff'" [style.border-color]="p.color || '#cbd5e1'"
                    [style.color]="pais?.id === p.id ? '#fff' : '#334155'">{{ p.nombre }}</button>
          }
        </div>
      }

      @if (pais) {
        <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="rounded-2xl p-4 text-white shadow" [style.background]="pais.color || '#1e293b'">
            <p class="text-xs opacity-90">Banco</p>
            <p class="text-xl font-extrabold break-all">$ {{ miles(pais.saldo_banco) }}</p>
            <p class="text-[11px] opacity-90">de $ {{ miles(pais.provision_inicial) }} impresos</p>
          </div>
          <div class="rounded-2xl bg-white border border-gray-200 p-4">
            <p class="text-xs text-gray-500">En manos de estudiantes</p>
            <p class="text-xl font-extrabold text-gray-800 break-all">$ {{ miles(pais.total_estudiantes) }}</p>
            <p class="text-[11px] text-gray-500">{{ pais.estudiantes.length }} estudiantes</p>
          </div>
          <div class="rounded-2xl bg-white border border-gray-200 p-4">
            <p class="text-xs text-gray-500">GO•STORE</p>
            <p class="text-xl font-extrabold text-gray-800 break-all">$ {{ miles(pais.total_ventas) }}</p>
            <p class="text-[11px] text-gray-500">{{ pais.ventas }} {{ pais.ventas === 1 ? 'venta' : 'ventas' }} · caja $ {{ miles(pais.saldo_caja) }}</p>
          </div>
          <div class="rounded-2xl bg-white border border-gray-200 p-4">
            <p class="text-xs text-gray-500">Con los docentes</p>
            <p class="text-xl font-extrabold text-gray-800 break-all">$ {{ miles(pais.saldo_docentes) }}</p>
            <p class="text-[11px] text-gray-500">Tasa final {{ miles(pais.tasa_actual ?? 0) }}</p>
          </div>
        </div>

        <h3 class="font-bold text-gray-800 mt-6 mb-3">Estudiantes de {{ pais.nombre }}</h3>
        @if (!pais.estudiantes.length) {
          <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">No hay estudiantes en {{ pais.nombre }}.</div>
        } @else {
          <ol class="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            @for (e of pais.estudiantes; track e.id; let i = $index) {
              <li class="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <span class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
                        [class]="i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-orange-300 text-orange-900' : 'bg-gray-100 text-gray-500'">{{ i + 1 }}</span>
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-800 truncate">{{ e.nombre }} {{ e.apellido }}</p>
                    <p class="text-xs text-gray-500">
                      Fondos {{ e.ganancia_fondos >= 0 ? '+' : '−' }}{{ miles(abs(e.ganancia_fondos)) }}
                      · Tienda {{ miles(e.gastado_tienda) }}
                      @if (e.rubrica) { · Rúbrica {{ e.rubrica.promedio }}/{{ datos.maximo_rubrica }} }
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-4 sm:gap-6 pl-11 sm:pl-0">
                  @if (e.invertido) {
                    <div class="text-right"><p class="text-[11px] text-gray-500">Invertido</p><p class="text-sm font-semibold text-gray-700">{{ miles(e.invertido) }}</p></div>
                  }
                  <div class="text-right"><p class="text-[11px] text-gray-500">Total</p><p class="text-lg font-extrabold" [style.color]="pais.color || '#1e293b'">$ {{ miles(e.total) }}</p></div>
                </div>
              </li>
            }
          </ol>
        }
      }
    }
  `,
})
export class TabResumen implements OnChanges {
  @Input({ required: true }) edicion!: Edicion;
  private willGo = inject(WillGoService);
  datos: ResumenFinal | null = null;
  pais: PaisResumen | null = null;
  cargando = true;
  error = '';

  ngOnChanges(): void { this.cargar(); }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.willGo.resumenFinal(this.edicion.id).subscribe({
      next: (d) => { this.datos = d; this.pais = d.paises.find((p) => p.id === this.pais?.id) ?? d.paises[0] ?? null; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  miles(v: number): string { return formatearNumero(Number(v) || 0); }
  abs(v: number): number { return Math.abs(v); }
  pct(v: number | null): string {
    const n = Number(v ?? 0) * 100;
    return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
  }
  urlFoto(id: string): string { return this.willGo.urlFoto(id); }
  iniciales(n: string): string { return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); }
}
