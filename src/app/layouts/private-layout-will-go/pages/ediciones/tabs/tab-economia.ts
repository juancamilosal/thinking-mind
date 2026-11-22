import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Edicion } from '../../../../../core/services/will-go.service';
import { TabPaises } from './tab-paises';
import { TabReglas } from './tab-reglas';
import { TabHorario } from './tab-horario';
import { TabFondos } from './tab-fondos';

type Seccion = 'paises' | 'reglas' | 'horario' | 'fondos';

/** Pestaña Economía: agrupa países y banco, reglas de la tasa, horario y fondos. */
@Component({
  selector: 'app-tab-economia',
  standalone: true,
  imports: [TabPaises, TabReglas, TabHorario, TabFondos],
  template: `
    <div class="flex gap-1 border-b border-gray-200 overflow-x-auto" role="tablist">
      @for (s of secciones; track s.id) {
        <button type="button" role="tab" [attr.aria-selected]="seccion === s.id" (click)="seccion = s.id"
                class="whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition"
                [class]="seccion === s.id ? 'border-orange-500 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-800'">
          {{ s.texto }}
        </button>
      }
    </div>
    <div class="mt-5">
      @switch (seccion) {
        @case ('paises') { <app-tab-paises [edicion]="edicion" /> }
        @case ('reglas') { <app-tab-reglas [edicion]="edicion" (guardada)="guardada.emit($event)" /> }
        @case ('horario') { <app-tab-horario [edicion]="edicion" (guardada)="guardada.emit($event)" /> }
        @case ('fondos') { <app-tab-fondos [edicion]="edicion" /> }
      }
    </div>
  `,
})
export class TabEconomia {
  @Input({ required: true }) edicion!: Edicion;
  @Output() guardada = new EventEmitter<Edicion>();
  readonly secciones: { id: Seccion; texto: string }[] = [
    { id: 'paises', texto: 'Países y banco' },
    { id: 'reglas', texto: 'Economía' },
    { id: 'horario', texto: 'Horario' },
    { id: 'fondos', texto: 'Fondos' },
  ];
  seccion: Seccion = 'paises';
}
