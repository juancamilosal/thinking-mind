import { Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { formatearNumero } from './numero-miles.directive';
import { imagenBillete } from './imagen-billete';

export interface MovimientoLista {
  id: string;
  entra: boolean;
  titulo: string;
  quien?: string;
  monto: number;
  fecha: string;
  billetes?: Record<string, number> | string | null;
}

/** Lista de lo que entra y sale, con totales arriba. Al tocar un movimiento se ven sus billetes. */
@Component({
  selector: 'wg-lista-movimientos',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (!movimientos.length) {
      <p class="text-sm text-gray-500">{{ vacio }}</p>
    } @else {
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-white rounded-2xl border border-gray-200 p-3">
          <p class="text-xs text-gray-500">Entró</p>
          <p class="text-lg font-extrabold text-emerald-700 break-all">+{{ miles(totalEntro) }}</p>
        </div>
        <div class="bg-white rounded-2xl border border-gray-200 p-3">
          <p class="text-xs text-gray-500">Salió</p>
          <p class="text-lg font-extrabold text-gray-800 break-all">−{{ miles(totalSalio) }}</p>
        </div>
      </div>
      <ul class="mt-3 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        @for (m of movimientos; track m.id) {
          <li>
            <button type="button" (click)="alternar(m)" [attr.aria-expanded]="abierto === m.id" [disabled]="!billetes(m).length"
                    class="w-full flex items-center gap-3 px-4 py-3 text-left enabled:hover:bg-gray-50 disabled:cursor-default">
              <span class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center" [class]="m.entra ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'" aria-hidden="true">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" [attr.d]="m.entra ? 'M19 14l-7 7m0 0l-7-7m7 7V3' : 'M5 10l7-7m0 0l7 7m-7-7v18'"/></svg>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block font-semibold text-gray-800 leading-snug line-clamp-2">{{ m.titulo }}</span>
                <span class="block text-xs text-gray-500 truncate">{{ m.fecha | date:'d MMM, h:mm a' }}{{ m.quien ? ' · ' + m.quien : '' }}</span>
              </span>
              <span class="font-bold whitespace-nowrap" [class]="m.entra ? 'text-emerald-700' : 'text-gray-800'">{{ m.entra ? '+' : '−' }}{{ miles(m.monto) }}</span>
            </button>
            @if (abierto === m.id) {
              <div class="px-4 pb-4 grid grid-cols-3 sm:grid-cols-5 gap-2">
                @for (b of billetes(m); track b.d) {
                  <div class="rounded-lg border border-gray-200 overflow-hidden bg-white">
                    @if (imagen(b.d); as src) { <img [src]="src" [alt]="'Billete de ' + miles(b.d)" class="w-full aspect-[520/281] object-cover"> }
                    @else { <div class="w-full aspect-[520/281] flex items-center justify-center text-sm font-black text-white" [style.background]="pais.color || '#64748b'">{{ miles(b.d) }}</div> }
                    <p class="text-center text-xs py-1 text-gray-600"><b class="text-gray-800">{{ miles(b.n) }}</b> × {{ miles(b.d) }}</p>
                  </div>
                }
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class ListaMovimientosComponent {
  @Input({ required: true }) movimientos: MovimientoLista[] = [];
  @Input({ required: true }) pais!: { nombre: string; color: string | null };
  @Input() totalEntro = 0;
  @Input() totalSalio = 0;
  @Input() vacio = 'Todavía no hay movimientos.';

  abierto: string | null = null;
  private cache = new Map<string, { d: number; n: number }[]>();
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);

  imagen(d: number): string | null { return imagenBillete(this.pais, d); }
  alternar(m: MovimientoLista): void { this.abierto = this.abierto === m.id ? null : m.id; }

  billetes(m: MovimientoLista): { d: number; n: number }[] {
    let lista = this.cache.get(m.id);
    if (!lista) {
      const b = (typeof m.billetes === 'string' ? JSON.parse(m.billetes) : m.billetes) ?? {};
      lista = Object.entries(b).map(([d, n]) => ({ d: Number(d), n: Number(n) })).filter((x) => x.n > 0).sort((x, y) => y.d - x.d);
      this.cache.set(m.id, lista);
    }
    return lista;
  }
}
