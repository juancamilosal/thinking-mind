import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Edicion, WillGoService } from '../../../../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from '../../../numero-miles.directive';
import { ESTILOS_CAMPOS } from './estilos-tabs';

/** Economía: tasa inicial, topes de la tasa, cada cuánto cambia y billetes de bienvenida. */
@Component({
  selector: 'app-tab-reglas',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, TranslatePipe],
  template: `
    <section class="tarjeta max-w-2xl space-y-5">
      <div>
        <label for="r-tasa" class="etiqueta">{{ 'wg.admin.reg.tasaInicial' | translate }}</label>
        <div class="flex items-center gap-2">
          <input id="r-tasa" wgNumero [(ngModel)]="datos.tasa_inicial" class="campo" [disabled]="bloqueado">
          <span class="text-sm text-gray-500 whitespace-nowrap">{{ 'wg.admin.reg.pesosBillete' | translate }}</span>
        </div>
        <p class="ayuda">{{ 'wg.admin.reg.ejemplo' | translate: { n: miles(ejemploPrecio) } }}</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="r-min" class="etiqueta">{{ 'wg.admin.reg.topeMinimo' | translate }}</label>
          <input id="r-min" wgNumero [decimales]="2" [(ngModel)]="datos.tope_minimo" class="campo">
          <p class="ayuda">{{ 'wg.admin.reg.nuncaBaja' | translate: { n: miles(minimo) } }}</p>
        </div>
        <div>
          <label for="r-max" class="etiqueta">{{ 'wg.admin.reg.topeMaximo' | translate }}</label>
          <input id="r-max" wgNumero [decimales]="2" [(ngModel)]="datos.tope_maximo" class="campo">
          <p class="ayuda">{{ 'wg.admin.reg.nuncaSube' | translate: { n: miles(maximo) } }}</p>
        </div>
      </div>
      <div>
        <span class="etiqueta">{{ 'wg.admin.reg.cambiaCada' | translate }}</span>
        <div class="grid grid-cols-5 gap-2" role="radiogroup" [attr.aria-label]="'wg.admin.reg.cambiaCadaAria' | translate">
          @for (m of intervalos; track m) {
            <button type="button" role="radio" [attr.aria-checked]="intervalo === m" (click)="intervalo = m"
                    class="py-2.5 px-1 rounded-xl text-sm font-bold border-2 whitespace-nowrap"
                    [class]="intervalo === m ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'">{{ m === 60 ? '1 h' : m + "'" }}</button>
          }
        </div>
        <p class="ayuda">{{ 'wg.admin.reg.ayudaIntervalo' | translate }}</p>
      </div>
      <div>
        <label for="r-bill" class="etiqueta">{{ 'wg.admin.billetesBienvenida' | translate }}</label>
        <input id="r-bill" wgNumero [(ngModel)]="datos.investment_bill" class="campo" [disabled]="bloqueado">
        <p class="ayuda">{{ 'wg.admin.reg.porEstudiante' | translate }}</p>
      </div>
      @if (bloqueado) {
        <p class="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{{ 'wg.admin.reg.bloqueado' | translate }}</p>
      }
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        @if (error) { <p class="text-sm text-red-700 sm:mr-auto" role="alert">{{ error }}</p> }
        @if (guardado) { <p class="text-sm text-emerald-700 sm:mr-auto" role="status">{{ 'wg.admin.guardado' | translate }}</p> }
        <button type="button" (click)="guardar()" [disabled]="guardando" class="boton-guardar sm:ml-auto">{{ (guardando ? 'wg.admin.guardando' : 'wg.admin.guardar') | translate }}</button>
      </div>
    </section>
  `,
  styles: [ESTILOS_CAMPOS],
})
export class TabReglas implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() guardada = new EventEmitter<Edicion>();
  private willGo = inject(WillGoService);
  readonly miles = (v: unknown) => formatearNumero(v as number);

  datos: Partial<Edicion> = {};
  readonly intervalos = [10, 15, 20, 30, 60];
  intervalo = 30;
  guardando = false;
  guardado = false;
  error = '';

  get bloqueado(): boolean {
    return this.edicion.estado !== 'borrador';
  }

  ngOnInit(): void {
    const e = this.edicion;
    this.datos = { tasa_inicial: e.tasa_inicial, tope_minimo: Number(e.tope_minimo), tope_maximo: Number(e.tope_maximo), investment_bill: e.investment_bill };
    this.intervalo = Number(this.parametros()['intervalo_minutos']) || 30;
  }

  /** Parámetros del tipo de cambio guardados (se conservan los demás al cambiar el intervalo). */
  private parametros(): Record<string, unknown> {
    const p = this.edicion.parametros_fx;
    try { return (typeof p === 'string' ? JSON.parse(p) : p) ?? {}; } catch { return {}; }
  }

  get ejemploPrecio(): number {
    return Math.ceil(5000 / Math.max(Number(this.datos.tasa_inicial) || 1, 1));
  }
  get minimo(): number {
    return Math.round((Number(this.datos.tope_minimo) || 0) * (Number(this.datos.tasa_inicial) || 0));
  }
  get maximo(): number {
    return Math.round((Number(this.datos.tope_maximo) || 0) * (Number(this.datos.tasa_inicial) || 0));
  }

  guardar(): void {
    this.error = '';
    this.guardado = false;
    const cambios: Partial<Edicion> = {
      tope_minimo: this.datos.tope_minimo, tope_maximo: this.datos.tope_maximo,
      parametros_fx: { ...this.parametros(), intervalo_minutos: this.intervalo },
    };
    if (!this.bloqueado) {
      cambios.tasa_inicial = this.datos.tasa_inicial;
      cambios.investment_bill = this.datos.investment_bill;
    }
    this.guardando = true;
    this.willGo.actualizarEdicion(this.edicion.id, cambios).subscribe({
      next: (e) => { this.guardando = false; this.guardado = true; this.guardada.emit(e); },
      error: (err) => { this.guardando = false; this.error = WillGoService.mensajeDeError(err); },
    });
  }
}
