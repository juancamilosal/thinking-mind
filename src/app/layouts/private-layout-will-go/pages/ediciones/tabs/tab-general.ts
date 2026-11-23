import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Edicion, Oferta, WillGoService } from '../../../../../core/services/will-go.service';
import { BuscadorOfertaComponent, OfertaElegida } from '../../../buscador-oferta.component';
import { ESTILOS_CAMPOS } from './estilos-tabs';

/** Pestaña General: nombre, colegio (oferta) y fechas. */
@Component({
  selector: 'app-tab-general',
  standalone: true,
  imports: [FormsModule, BuscadorOfertaComponent, TranslatePipe],
  template: `
    <section class="tarjeta max-w-2xl space-y-4">
      <div>
        <label for="g-nombre" class="etiqueta">{{ 'wg.admin.nombre' | translate }}</label>
        <input id="g-nombre" [(ngModel)]="datos.nombre" class="campo">
      </div>
      <div>
        <label for="g-oferta" class="etiqueta">{{ 'wg.admin.gen.colegio' | translate }}</label>
        <wg-buscador-oferta inputId="g-oferta" [compacto]="true" [ofertas]="ofertas" [actual]="ofertaActual" [nombreEdicionActual]="edicion.nombre"
                            [soloPrograma]="edicion.participantes > 0 ? edicion.curso_id : null" (elegida)="alElegirOferta($event)" />
      </div>
      <!-- Fechas: en celular una debajo de la otra para que se vean completas -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label for="g-inicio" class="etiqueta">{{ 'wg.admin.inicia' | translate }}</label>
          <input id="g-inicio" type="date" [(ngModel)]="datos.fecha_inicio" class="campo">
        </div>
        <div>
          <label for="g-fin" class="etiqueta">{{ 'wg.admin.termina' | translate }}</label>
          <input id="g-fin" type="date" [(ngModel)]="datos.fecha_fin" class="campo">
        </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
        @if (error) { <p class="text-sm text-red-700 sm:mr-auto" role="alert">{{ error }}</p> }
        @if (guardado) { <p class="text-sm text-emerald-700 sm:mr-auto" role="status">{{ cambioParticipantes ? ('wg.admin.gen.guardadoCon' | translate: { detalle: cambioParticipantes }) : ('wg.admin.guardado' | translate) }}</p> }
        <button type="button" (click)="guardar()" [disabled]="guardando" class="boton-guardar sm:ml-auto">{{ (guardando ? 'wg.admin.guardando' : 'wg.admin.guardar') | translate }}</button>
      </div>
    </section>
  `,
  styles: [ESTILOS_CAMPOS],
})
export class TabGeneral implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() guardada = new EventEmitter<Edicion>();
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);

  datos: Partial<Edicion> = {};
  ofertas: Oferta[] = [];
  ofertaActual: OfertaElegida | null = null;
  guardando = false;
  guardado = false;
  cambioParticipantes = '';
  error = '';

  ngOnInit(): void {
    const e = this.edicion;
    this.datos = {
      nombre: e.nombre, colegio_id: e.colegio_id, curso_id: e.curso_id, edicion_programa: e.edicion_programa,
      fecha_inicio: e.fecha_inicio?.slice(0, 10) ?? null, fecha_fin: e.fecha_fin?.slice(0, 10) ?? null,
    };
    this.ofertaActual = e.curso_id && e.edicion_programa ? { colegio_id: e.colegio_id, curso_id: e.curso_id, edicion_programa: e.edicion_programa } : null;
    this.willGo.catalogos().subscribe({ next: (c) => (this.ofertas = c.ofertas) });
  }

  alElegirOferta(o: Oferta): void {
    this.datos.colegio_id = o.colegio_id;
    this.datos.curso_id = o.curso_id;
    this.datos.edicion_programa = String(o.edicion);
  }

  guardar(): void {
    this.error = '';
    this.guardado = false;
    const cambios: Partial<Edicion> = { ...this.datos };
    if (this.edicion.participantes > 0 && cambios.curso_id === this.edicion.curso_id) delete cambios.curso_id;
    this.guardando = true;
    this.willGo.actualizarEdicion(this.edicion.id, cambios).subscribe({
      next: (e) => {
        this.guardando = false;
        this.guardado = true;
        this.cambioParticipantes = [
          e.nuevos ? this.t.instant('wg.admin.gen.llegaron', { n: e.nuevos }) : '',
          e.quitados ? this.t.instant('wg.admin.gen.salieron', { n: e.quitados }) : '',
        ].filter(Boolean).join(` ${this.t.instant('wg.admin.gen.y')} `);
        this.guardada.emit(e);
      },
      error: (err) => { this.guardando = false; this.error = WillGoService.mensajeDeError(err); },
    });
  }
}
