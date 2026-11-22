import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Edicion, WillGoService } from '../../../../core/services/will-go.service';

/** Ventana para eliminar una edición: hay que escribir su nombre para confirmar. */
@Component({
  selector: 'wg-eliminar-edicion',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="cancelar.emit()">
      <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true" aria-labelledby="titulo-eliminar">
        <div class="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </div>
        <h2 id="titulo-eliminar" class="text-lg font-bold text-gray-800 mt-4">¿Eliminar «{{ edicion.nombre }}»?</h2>
        <p class="text-sm text-gray-600 mt-2">Se borran sus países, productos, fondos y la lista de estudiantes de la edición. Las inscripciones y los pagos de la plataforma <b>no</b> se tocan.</p>
        <p class="text-sm text-gray-600 mt-2">Si la edición ya tiene movimientos de billetes, no se podrá eliminar.</p>
        <label for="confirmar-nombre" class="block text-sm font-semibold text-gray-700 mt-4 mb-1">Para confirmar, escribe el nombre de la edición:</label>
        <input id="confirmar-nombre" [(ngModel)]="escrito" autocomplete="off" [placeholder]="edicion.nombre"
               class="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300">
        @if (error) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p> }
        <div class="flex gap-3 mt-6">
          <button type="button" (click)="cancelar.emit()" class="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="button" (click)="eliminar()" [disabled]="!coincide || eliminando"
                  class="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {{ eliminando ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class EliminarEdicionComponent {
  @Input({ required: true }) edicion!: Edicion;
  @Output() eliminada = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();
  private willGo = inject(WillGoService);
  escrito = '';
  eliminando = false;
  error = '';

  get coincide(): boolean {
    return this.escrito.trim().toLowerCase() === this.edicion.nombre.trim().toLowerCase();
  }

  eliminar(): void {
    if (!this.coincide) return;
    this.eliminando = true;
    this.error = '';
    this.willGo.eliminarEdicion(this.edicion.id).subscribe({
      next: () => { this.eliminando = false; this.eliminada.emit(); },
      error: (e) => { this.eliminando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
