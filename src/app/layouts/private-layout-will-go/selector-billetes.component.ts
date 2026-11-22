import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NumeroMilesDirective, formatearNumero } from './numero-miles.directive';
import { imagenBillete } from './imagen-billete';

/**
 * Cuadrícula de billetes con su imagen y botones − / +.
 * `topes[d]` es el máximo de billetes de esa denominación (p. ej. los que hay en el banco);
 * `tope total` limita la suma (p. ej. el saldo del estudiante o lo que falta por pagar).
 */
@Component({
  selector: 'wg-selector-billetes',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, TranslatePipe],
  template: `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      @for (d of denominaciones; track d) {
        <div class="rounded-xl border-2 overflow-hidden" [style.border-color]="cantidad(d) ? (pais.color || '#f97316') : '#e5e7eb'">
          <button type="button" class="block w-full" (click)="sumar(d, 1)" [disabled]="!puedeSumar(d)" [attr.aria-label]="'wg.nucleo.billetes.agregar' | translate: { n: miles(d) }">
            @if (imagen(d); as src) {
              <img [src]="src" [alt]="'wg.nucleo.billetes.billeteDe' | translate: { n: miles(d) }" class="w-full aspect-[520/281] object-cover">
            } @else {
              <div class="w-full aspect-[520/281] flex items-center justify-center text-xl font-black text-white" [style.background]="pais.color || '#64748b'">{{ miles(d) }}</div>
            }
          </button>
          <div class="flex items-center gap-1 p-1.5">
            <button type="button" (click)="sumar(d, -1)" [disabled]="!cantidad(d)" class="w-9 h-9 shrink-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'wg.nucleo.billetes.quitar' | translate: { n: miles(d) }">−</button>
            <input wgNumero [ngModel]="elegidos[d]" (ngModelChange)="elegidos[d] = $event; cambio.emit()" placeholder="0" [attr.aria-label]="'wg.nucleo.billetes.cantidad' | translate: { n: miles(d) }"
                   class="w-full min-w-0 h-9 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-300">
            <button type="button" (click)="sumar(d, 1)" [disabled]="!puedeSumar(d)" class="w-9 h-9 shrink-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'wg.nucleo.billetes.agregar' | translate: { n: miles(d) }">+</button>
          </div>
          @if (topes) {
            <p class="text-[11px] text-center pb-1.5" [class]="cantidad(d) > tope(d) ? 'text-red-600 font-semibold' : 'text-gray-500'">{{ textoTope || ('wg.nucleo.billetes.quedan' | translate) }} {{ miles(tope(d)) }}</p>
          }
        </div>
      }
    </div>
  `,
})
export class SelectorBilletesComponent {
  @Input({ required: true }) pais!: { nombre: string; color: string | null };
  @Input({ required: true }) denominaciones: number[] = [];
  @Input({ required: true }) elegidos: Record<number, number | null> = {};
  @Input() topes: Record<string, number> | null = null;
  @Input() topeTotal: number | null = null;
  /** Vacío = «Quedan» traducido (wg.nucleo.billetes.quedan). */
  @Input() textoTope = '';
  @Output() cambio = new EventEmitter<void>();

  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  imagen(d: number): string | null { return imagenBillete(this.pais, d); }
  cantidad(d: number): number { return Number(this.elegidos[d]) || 0; }
  tope(d: number): number { return Math.max(0, Number(this.topes?.[d] ?? 0)); }
  get total(): number { return this.denominaciones.reduce((t, d) => t + d * this.cantidad(d), 0); }

  puedeSumar(d: number): boolean {
    if (this.topes && this.cantidad(d) >= this.tope(d)) return false;
    if (this.topeTotal !== null && this.total + d > this.topeTotal) return false;
    return true;
  }

  sumar(d: number, n: number): void {
    if (n > 0 && !this.puedeSumar(d)) return;
    this.elegidos[d] = Math.max(0, this.cantidad(d) + n);
    this.cambio.emit();
  }
}
