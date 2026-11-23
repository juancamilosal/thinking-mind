import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WillGoService, EdicionVigente } from '../../../../core/services/will-go.service';
import { ArqueoComponent } from '../../arqueo.component';
import { TranslatePipe } from '@ngx-translate/core';

/** Página de arqueo para el banco: elige la edición (de las que hace parte) y cuenta los billetes. */
@Component({
  selector: 'app-arqueo-will-go',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ArqueoComponent, SelectorEdicionComponent],
  template: `
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.banco.pagina.titulo' | translate }}</h1>
        </div>
      </div>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" />
      <div class="mt-5">
        @if (cargando) {
          <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.banco.cargando' | translate }}</div>
        } @else if (!ediciones.length) {
          <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.banco.sinEdicion' | translate }}</div>
        } @else if (edicionId) {
          <wg-arqueo [edicionId]="edicionId" />
        }
      </div>
    </div>
  `,
})
export class ArqueoWillGo implements OnInit {
  private willGo = inject(WillGoService);
  ediciones: EdicionVigente[] = [];
  edicionId = '';
  cargando = true;

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; this.cargando = false; },
      error: () => (this.cargando = false),
    });
  }
}
