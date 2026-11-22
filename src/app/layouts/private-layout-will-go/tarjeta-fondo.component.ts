import { Component, Input } from '@angular/core';

export interface FondoTarjeta {
  nombre: string;
  riesgo: 'bajo' | 'medio' | 'alto';
  a_que_se_dedica: string | null;
  por_que_invertir: string | null;
}

const RIESGOS = {
  bajo: { texto: 'Riesgo bajo', explica: 'Gana poco, pero casi nunca pierde.', pastilla: 'bg-emerald-100 text-emerald-800', caja: 'bg-emerald-50 text-emerald-900', fondo: 'from-emerald-400 to-teal-600', nivel: 1 },
  medio: { texto: 'Riesgo medio', explica: 'Puede ganar más, con subidas y bajadas.', pastilla: 'bg-amber-100 text-amber-800', caja: 'bg-amber-50 text-amber-900', fondo: 'from-amber-400 to-orange-500', nivel: 2 },
  alto: { texto: 'Riesgo alto', explica: 'Puede ganar mucho… o perder billetes.', pastilla: 'bg-red-100 text-red-800', caja: 'bg-red-50 text-red-900', fondo: 'from-rose-500 to-red-600', nivel: 3 },
} as const;

/** Tarjeta de una empresa (fondo) tal como la ven estudiantes y acudientes. No muestra porcentajes. */
@Component({
  selector: 'wg-tarjeta-fondo',
  standalone: true,
  // Ocupa toda la altura de la celda: en una cuadrícula, las tarjetas de la misma fila quedan iguales
  host: { class: 'block h-full' },
  template: `
    <article class="h-full flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="p-5 flex-1">
        <div class="flex items-center gap-4">
          @if (logoUrl) {
            <img [src]="logoUrl" [alt]="'Logo de ' + fondo.nombre" class="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-3xl object-cover bg-gray-50 shadow-md ring-1 ring-black/5">
          } @else {
            <div class="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-3xl bg-gradient-to-br text-white text-3xl font-black flex items-center justify-center shadow-md" [class]="r.fondo" aria-hidden="true">{{ iniciales }}</div>
          }
          <div class="min-w-0">
            <h3 class="text-lg sm:text-xl font-extrabold text-gray-800 leading-tight">{{ fondo.nombre }}</h3>
            <span class="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold px-2.5 py-1 rounded-full" [class]="r.pastilla">
              <span class="flex gap-0.5" aria-hidden="true">
                @for (n of [1, 2, 3]; track n) { <span class="w-1.5 h-3 rounded-sm" [class]="n <= r.nivel ? 'bg-current' : 'bg-current opacity-20'"></span> }
              </span>
              {{ r.texto }}
            </span>
          </div>
        </div>

        @if (fondo.a_que_se_dedica) {
          <p class="mt-4 text-gray-700">{{ fondo.a_que_se_dedica }}</p>
        }

        @if (razones.length) {
          <h4 class="mt-4 text-sm font-bold text-gray-800">¿Por qué invertir?</h4>
          <ul class="mt-2 space-y-2">
            @for (x of razones; track $index) {
              <li class="flex gap-2 text-sm text-gray-700">
                <svg class="w-5 h-5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                <span>{{ x }}</span>
              </li>
            }
          </ul>
        }
      </div>
      <p class="px-5 py-3 text-sm font-medium" [class]="r.caja">{{ r.explica }}</p>
      <ng-content />
    </article>
  `,
})
export class TarjetaFondoComponent {
  @Input({ required: true }) fondo!: FondoTarjeta;
  @Input() logoUrl: string | null = null;

  get r() { return RIESGOS[this.fondo.riesgo] ?? RIESGOS.medio; }
  get razones(): string[] { return (this.fondo.por_que_invertir ?? '').split('\n').map((x) => x.replace(/^[-•*\s]+/, '').trim()).filter(Boolean); }
  get iniciales(): string { return this.fondo.nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); }
}
