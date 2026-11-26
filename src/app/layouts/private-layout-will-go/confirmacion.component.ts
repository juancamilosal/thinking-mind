import { Component, HostListener, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ConfirmacionService } from '../../core/services/confirmacion.service';

/** Modal de confirmación de Will-Go: va una sola vez en el layout y lo abre ConfirmacionService.pedir(). */
@Component({
  selector: 'wg-confirmacion',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (c.actual(); as p) {
      <div class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="c.responder(false)">
        <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true" aria-labelledby="titulo-confirmacion">
          <div class="w-12 h-12 rounded-full flex items-center justify-center mb-3" [class]="p.peligro ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'" aria-hidden="true">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          </div>
          <h2 id="titulo-confirmacion" class="text-lg font-bold text-gray-800">{{ p.titulo }}</h2>
          @if (p.texto) { <p class="mt-1 text-sm text-gray-600">{{ p.texto }}</p> }
          <div class="mt-6 flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" (click)="c.responder(false)" class="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ p.cancelar || ('wg.pestanas.comun.cancelar' | translate) }}</button>
            <button type="button" (click)="c.responder(true)" class="flex-1 py-3 rounded-xl font-semibold text-white hover:brightness-110"
                    [class]="p.peligro ? 'bg-red-600' : 'bg-gradient-to-r from-orange-500 to-orange-600'">{{ p.aceptar || ('wg.nucleo.confirmar.aceptar' | translate) }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmacionComponent {
  readonly c = inject(ConfirmacionService);
  @HostListener('document:keydown.escape') cerrar(): void { this.c.responder(false); }
}
