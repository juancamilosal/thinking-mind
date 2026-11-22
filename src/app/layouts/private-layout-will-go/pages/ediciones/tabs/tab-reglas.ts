import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Edicion, WillGoService } from '../../../../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from '../../../numero-miles.directive';
import { ESTILOS_CAMPOS } from './estilos-tabs';

/** Economía: tasa inicial, topes de la tasa y billetes de bienvenida. */
@Component({
  selector: 'app-tab-reglas',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective],
  template: `
    <section class="tarjeta max-w-2xl space-y-5">
      <div>
        <label for="r-tasa" class="etiqueta">Tasa inicial</label>
        <div class="flex items-center gap-2">
          <input id="r-tasa" wgNumero [(ngModel)]="datos.tasa_inicial" class="campo" [disabled]="bloqueado">
          <span class="text-sm text-gray-500 whitespace-nowrap">pesos = 1 billete</span>
        </div>
        <p class="ayuda">Ej.: 5.000 pesos = {{ miles(ejemploPrecio) }} billetes</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="r-min" class="etiqueta">Tope mínimo</label>
          <input id="r-min" wgNumero [decimales]="2" [(ngModel)]="datos.tope_minimo" class="campo">
          <p class="ayuda">Nunca baja de {{ miles(minimo) }}</p>
        </div>
        <div>
          <label for="r-max" class="etiqueta">Tope máximo</label>
          <input id="r-max" wgNumero [decimales]="2" [(ngModel)]="datos.tope_maximo" class="campo">
          <p class="ayuda">Nunca sube de {{ miles(maximo) }}</p>
        </div>
      </div>
      <div>
        <label for="r-bill" class="etiqueta">Billetes de bienvenida</label>
        <input id="r-bill" wgNumero [(ngModel)]="datos.investment_bill" class="campo" [disabled]="bloqueado">
        <p class="ayuda">Por estudiante. 0 si no aplica.</p>
      </div>
      @if (bloqueado) {
        <p class="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">La tasa inicial y la bienvenida no cambian con la edición abierta.</p>
      }
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        @if (error) { <p class="text-sm text-red-700 sm:mr-auto" role="alert">{{ error }}</p> }
        @if (guardado) { <p class="text-sm text-emerald-700 sm:mr-auto" role="status">Guardado.</p> }
        <button type="button" (click)="guardar()" [disabled]="guardando" class="boton-guardar sm:ml-auto">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
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
  guardando = false;
  guardado = false;
  error = '';

  get bloqueado(): boolean {
    return this.edicion.estado !== 'borrador';
  }

  ngOnInit(): void {
    const e = this.edicion;
    this.datos = { tasa_inicial: e.tasa_inicial, tope_minimo: Number(e.tope_minimo), tope_maximo: Number(e.tope_maximo), investment_bill: e.investment_bill };
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
    const cambios: Partial<Edicion> = { tope_minimo: this.datos.tope_minimo, tope_maximo: this.datos.tope_maximo };
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
