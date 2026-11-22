import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
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
  imports: [TabPaises, TabReglas, TabHorario, TabFondos, TranslatePipe],
  template: `
    <div class="flex flex-wrap gap-1" role="tablist">
      @for (s of secciones; track s.id) {
        <button type="button" role="tab" [attr.aria-selected]="seccion === s.id" (click)="seccion = s.id"
                class="whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-lg transition"
                [class]="seccion === s.id ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'">
          {{ s.texto | translate }}
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
    { id: 'paises', texto: 'wg.admin.eco.paises' },
    { id: 'reglas', texto: 'wg.admin.eco.reglas' },
    { id: 'horario', texto: 'wg.admin.eco.horario' },
    { id: 'fondos', texto: 'wg.admin.eco.fondos' },
  ];
  seccion: Seccion = 'paises';
}
