import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Edicion, Franja, WillGoService } from '../../../../../core/services/will-go.service';
import { DIAS_SEMANA } from '../estado-edicion';
import { ESTILOS_CAMPOS } from './estilos-tabs';

/** Horario: franjas en que la tasa de cambio se mueve. */
@Component({
  selector: 'app-tab-horario',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <section class="tarjeta">
      <p class="text-sm text-gray-500">{{ 'wg.admin.hor.intro' | translate }}</p>
      <div class="mt-4 space-y-2">
        @for (f of horario; track $index; let i = $index) {
          <div class="flex flex-wrap items-center gap-2 bg-gray-50 rounded-xl p-2">
            <select [(ngModel)]="f.tipo" class="campo !w-auto !py-2" [attr.aria-label]="'wg.admin.hor.tipoFranja' | translate: { n: i + 1 }">
              <option value="dia">{{ 'wg.admin.hor.cadaSemana' | translate }}</option>
              <option value="fecha">{{ 'wg.admin.hor.fechaExacta' | translate }}</option>
            </select>
            @if (f.tipo === 'dia') {
              <select [(ngModel)]="f.dia" class="campo !w-auto !py-2" [attr.aria-label]="'wg.admin.hor.dia' | translate">
                @for (d of dias; track d.id) { <option [value]="d.id">{{ d.texto | translate }}</option> }
              </select>
            } @else {
              <input type="date" [(ngModel)]="f.fecha" class="campo !w-auto !py-2" [attr.aria-label]="'wg.admin.hor.fecha' | translate">
            }
            <input type="time" [(ngModel)]="f.inicio" class="campo !w-auto !py-2" [attr.aria-label]="'wg.admin.hor.desde' | translate">
            <span class="text-sm text-gray-500">{{ 'wg.admin.hor.a' | translate }}</span>
            <input type="time" [(ngModel)]="f.fin" class="campo !w-auto !py-2" [attr.aria-label]="'wg.admin.hor.hasta' | translate">
            <button type="button" (click)="horario.splice(i, 1)" class="ml-auto px-3 py-2 text-sm rounded-lg text-red-700 hover:bg-red-50">{{ 'wg.admin.hor.quitar' | translate }}</button>
          </div>
        }
        @if (!horario.length) {
          <p class="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">{{ 'wg.admin.hor.sinHorario' | translate }}</p>
        }
        <button type="button" (click)="agregar()" class="mt-1 px-4 py-2 text-sm font-semibold rounded-xl border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50">{{ 'wg.admin.hor.agregar' | translate }}</button>
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 mt-5">
        @if (error) { <p class="text-sm text-red-700 sm:mr-auto" role="alert">{{ error }}</p> }
        @if (guardado) { <p class="text-sm text-emerald-700 sm:mr-auto" role="status">{{ 'wg.admin.guardado' | translate }}</p> }
        <button type="button" (click)="guardar()" [disabled]="guardando" class="boton-guardar sm:ml-auto">{{ (guardando ? 'wg.admin.guardando' : 'wg.admin.guardar') | translate }}</button>
      </div>
    </section>
  `,
  styles: [ESTILOS_CAMPOS],
})
export class TabHorario implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() guardada = new EventEmitter<Edicion>();
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  readonly dias = DIAS_SEMANA;

  horario: { tipo: 'dia' | 'fecha'; dia: string; fecha: string; inicio: string; fin: string }[] = [];
  guardando = false;
  guardado = false;
  error = '';

  ngOnInit(): void {
    this.horario = (this.edicion.horario ?? []).map((f) => ({
      tipo: f.fecha ? 'fecha' : 'dia', dia: f.dia ?? 'sabado', fecha: f.fecha ?? '', inicio: f.inicio, fin: f.fin,
    }));
  }

  agregar(): void {
    this.horario.push({ tipo: 'dia', dia: 'sabado', fecha: '', inicio: '08:00', fin: '18:00' });
  }

  guardar(): void {
    this.error = '';
    this.guardado = false;
    const horario: Franja[] = this.horario.map((f) =>
      f.tipo === 'fecha' ? { fecha: f.fecha, inicio: f.inicio, fin: f.fin } : { dia: f.dia, inicio: f.inicio, fin: f.fin });
    if (horario.some((f) => !f.inicio || !f.fin || f.inicio >= f.fin || ('fecha' in f && !f.fecha))) {
      this.error = this.t.instant('wg.admin.hor.errorHoras');
      return;
    }
    this.guardando = true;
    this.willGo.actualizarEdicion(this.edicion.id, { horario }).subscribe({
      next: (e) => { this.guardando = false; this.guardado = true; this.guardada.emit(e); },
      error: (err) => { this.guardando = false; this.error = WillGoService.mensajeDeError(err); },
    });
  }
}
