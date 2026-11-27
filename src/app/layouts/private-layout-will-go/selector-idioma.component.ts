import { Component, HostListener, Input, inject } from '@angular/core';
import { IdiomaWillGoService } from '../../core/services/idioma-will-go.service';

/**
 * Selector de idioma de Will-Go: English, Français y (solo en desarrollo) Español.
 * variante 'claro' para fondos blancos y 'oscuro' para fondos oscuros.
 */
@Component({
  selector: 'wg-selector-idioma',
  standalone: true,
  template: `
    <div class="relative inline-block text-left">
      <button type="button" (click)="alternar($event)" [attr.aria-expanded]="abierto" aria-haspopup="menu" [attr.aria-label]="'Language / Langue'"
              class="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition"
              [class]="variante === 'oscuro' ? 'border-white/20 text-white bg-white/10 hover:bg-white/20' : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'">
        <img [src]="actual.bandera" alt="" class="w-6 h-4 rounded-[3px] object-cover ring-1 ring-black/15 shrink-0">{{ actual.corto }}
        <svg class="w-4 h-4 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
      </button>
      @if (abierto) {
        <div role="menu" class="absolute z-50 min-w-[13rem] bg-white rounded-xl border border-gray-200 shadow-lg py-1" [class]="(alinear === 'izquierda' ? 'left-0' : 'right-0') + (abrir === 'arriba' ? ' bottom-full mb-1' : ' mt-1')">
          @for (i of idioma.idiomas; track i.id) {
            <button type="button" role="menuitemradio" [attr.aria-checked]="i.id === idioma.actual" (click)="elegir(i.id)"
                    class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left whitespace-nowrap hover:bg-gray-50"
                    [class]="i.id === idioma.actual ? 'font-bold text-gray-900' : 'text-gray-700'">
              <img [src]="i.bandera" alt="" class="w-6 h-4 rounded-[3px] object-cover ring-1 ring-black/15 shrink-0">{{ i.nombre }}
              @if (i.id === idioma.actual) { <span class="ml-auto text-teal-600" aria-hidden="true">✓</span> }
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class SelectorIdiomaComponent {
  @Input() variante: 'claro' | 'oscuro' = 'claro';
  @Input() alinear: 'izquierda' | 'derecha' = 'derecha';
  /** Hacia dónde se abre la lista (arriba, si el selector está al pie de la pantalla). */
  @Input() abrir: 'abajo' | 'arriba' = 'abajo';
  idioma = inject(IdiomaWillGoService);
  abierto = false;

  get actual() { return this.idioma.idiomas.find((i) => i.id === this.idioma.actual) ?? this.idioma.idiomas[0]; }
  alternar(ev: Event): void { ev.stopPropagation(); this.abierto = !this.abierto; }
  elegir(id: Parameters<IdiomaWillGoService['usar']>[0]): void { this.idioma.usar(id); this.abierto = false; }
  @HostListener('document:click') cerrar(): void { this.abierto = false; }
}
