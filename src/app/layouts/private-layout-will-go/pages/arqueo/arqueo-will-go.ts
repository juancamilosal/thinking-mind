import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WillGoService } from '../../../../core/services/will-go.service';
import { ArqueoComponent } from '../../arqueo.component';

/** Página de arqueo para el banco: elige la edición (de las que hace parte) y cuenta los billetes. */
@Component({
  selector: 'app-arqueo-will-go',
  standalone: true,
  imports: [FormsModule, ArqueoComponent],
  template: `
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Arqueo</h1>
          <p class="text-gray-500 mt-1">Cuenta los billetes del banco y revisa que cuadren.</p>
        </div>
        @if (ediciones.length > 1) {
          <select [(ngModel)]="edicionId" aria-label="Edición" class="sm:w-80 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            @for (e of ediciones; track e.id) { <option [value]="e.id">{{ e.nombre }}</option> }
          </select>
        }
      </div>
      <div class="mt-5">
        @if (cargando) {
          <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando…</div>
        } @else if (!ediciones.length) {
          <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">No haces parte del equipo de ninguna edición abierta.</div>
        } @else if (edicionId) {
          <wg-arqueo [edicionId]="edicionId" />
        }
      </div>
    </div>
  `,
})
export class ArqueoWillGo implements OnInit {
  private willGo = inject(WillGoService);
  ediciones: { id: string; nombre: string; estado: string }[] = [];
  edicionId = '';
  cargando = true;

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; this.cargando = false; },
      error: () => (this.cargando = false),
    });
  }
}
