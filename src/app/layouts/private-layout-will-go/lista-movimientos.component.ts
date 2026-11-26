import { Component, Input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FechaWillGoPipe } from './fecha.pipe';
import { formatearNumero } from './numero-miles.directive';

export interface MovimientoLista {
  id: string;
  entra: boolean;
  titulo: string;
  quien?: string;
  monto: number;
  fecha: string;
  billetes?: Record<string, number> | string | null;
}

/** Lista de lo que entra y sale, con totales arriba. */
@Component({
  selector: 'wg-lista-movimientos',
  standalone: true,
  imports: [TranslatePipe, FechaWillGoPipe],
  template: `
    @if (!movimientos.length) {
      <p class="text-sm text-gray-500">{{ vacio || ('wg.nucleo.movimientos.vacio' | translate) }}</p>
    } @else {
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-white rounded-2xl border border-gray-200 p-3">
          <p class="text-xs text-gray-500">{{ 'wg.nucleo.movimientos.entro' | translate }}</p>
          <p class="text-lg font-extrabold text-emerald-700 break-all">+{{ miles(totalEntro) }}</p>
        </div>
        <div class="bg-white rounded-2xl border border-gray-200 p-3">
          <p class="text-xs text-gray-500">{{ 'wg.nucleo.movimientos.salio' | translate }}</p>
          <p class="text-lg font-extrabold text-red-600 break-all">−{{ miles(totalSalio) }}</p>
        </div>
      </div>
      <ul class="mt-3 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        @for (m of movimientos; track m.id) {
          <li>
            <div class="flex items-center gap-3 px-4 py-3">
              <span class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center" [class]="m.entra ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'" aria-hidden="true">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" [attr.d]="m.entra ? 'M19 14l-7 7m0 0l-7-7m7 7V3' : 'M5 10l7-7m0 0l7 7m-7-7v18'"/></svg>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block font-semibold text-gray-800 leading-snug">{{ m.titulo }}</span>
                <span class="block text-xs text-gray-500">{{ m.fecha | wgFecha: ('wg.nucleo.movimientos.formatoFecha' | translate) }}{{ m.quien ? ' · ' + m.quien : '' }}</span>
              </span>
              <!-- Lo que sale (retiros, entregas, pagos) va en rojo y con «−» -->
              <span class="font-bold whitespace-nowrap" [class]="m.entra ? 'text-emerald-700' : 'text-red-600'">{{ m.entra ? '+' : '−' }}{{ miles(m.monto) }}</span>
            </div>
          </li>
        }
      </ul>
    }
  `,
})
export class ListaMovimientosComponent {
  /** Si el servidor no los envía (p. ej. una versión anterior de la extensión) se muestra la lista vacía. */
  @Input({ required: true }) set movimientos(v: MovimientoLista[] | null | undefined) { this.lista = v ?? []; }
  get movimientos(): MovimientoLista[] { return this.lista; }
  private lista: MovimientoLista[] = [];
  @Input({ required: true }) pais!: { nombre: string; color: string | null };
  @Input() totalEntro: number | null | undefined = 0;
  @Input() totalSalio: number | null | undefined = 0;
  /** Vacío = texto por defecto traducido (wg.nucleo.movimientos.vacio). */
  @Input() vacio = '';

  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
}
