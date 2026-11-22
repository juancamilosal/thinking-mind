import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { EdicionVigente } from '../../core/services/will-go.service';

/** Selector de edición (programa): siempre visible, a todo el ancho, con colegio, programa y fechas. */
@Component({
  selector: 'wg-selector-edicion',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    @if (ediciones.length) {
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
        <label for="wg-edicion" class="block text-xs font-semibold uppercase tracking-wide text-gray-500">Edición</label>
        @if (ediciones.length > 1) {
          <!-- El nombre se ve completo (puede ocupar varias líneas); encima va el select invisible que abre la lista -->
          <div class="relative mt-1 flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-orange-300">
            <span class="flex-1 font-bold text-gray-800 break-words">{{ actual?.nombre }}</span>
            <svg class="shrink-0 text-gray-500" width="18" height="18" style="width:18px;height:18px" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
            <select id="wg-edicion" [ngModel]="edicionId" (ngModelChange)="elegir($event)" aria-label="Cambiar de edición"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
              @for (e of ediciones; track e.id) { <option [value]="e.id">{{ e.nombre }}</option> }
            </select>
          </div>
        } @else {
          <p id="wg-edicion" class="mt-1 font-bold text-gray-800 break-words">{{ actual?.nombre }}</p>
        }
        @if (actual; as e) {
          <p class="mt-1.5 text-sm text-gray-500 break-words">
            {{ detalle(e) }}
            @if (e.fecha_inicio) { · {{ e.fecha_inicio | date:'d MMM':'UTC' }}{{ e.fecha_fin && e.fecha_fin !== e.fecha_inicio ? ' – ' + (e.fecha_fin | date:'d MMM y':'UTC') : '' }} }
            @if (e.estado !== 'abierta') { <span class="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{{ e.estado === 'borrador' ? 'En preparación' : e.estado }}</span> }
          </p>
        }
      </div>
    }
  `,
})
export class SelectorEdicionComponent {
  @Input({ required: true }) ediciones: EdicionVigente[] = [];
  @Input({ required: true }) edicionId = '';
  @Output() edicionIdChange = new EventEmitter<string>();
  /** Se emite después de cambiar de edición (para recargar la pantalla). */
  @Output() cambio = new EventEmitter<string>();

  get actual(): EdicionVigente | undefined { return this.ediciones.find((e) => e.id === this.edicionId); }

  detalle(e: EdicionVigente): string {
    return [e.colegio, e.programa, e.edicion_programa ? `Edición ${e.edicion_programa}` : null].filter(Boolean).join(' · ');
  }

  elegir(id: string): void {
    this.edicionId = id;
    this.edicionIdChange.emit(id);
    this.cambio.emit(id);
  }
}
