import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NumeroMilesDirective, formatearNumero } from '../../../numero-miles.directive';
import { Edicion, Franja, WillGoService } from '../../../../../core/services/will-go.service';
import { DIAS_SEMANA } from '../estado-edicion';
import { BuscadorColegioComponent } from '../../../buscador-colegio.component';

@Component({
  selector: 'app-tab-general',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, BuscadorColegioComponent],
  template: `
    <div class="grid gap-5 lg:grid-cols-2">
      <!-- Datos de la edición -->
      <section class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <h2 class="font-bold text-gray-800">Datos de la edición</h2>
        <div class="mt-4 space-y-4">
          <div>
            <label for="g-nombre" class="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
            <input id="g-nombre" [(ngModel)]="datos.nombre" class="campo">
          </div>
          <div>
            <label for="g-colegio" class="block text-sm font-semibold text-gray-700 mb-1">Colegio</label>
            <wg-buscador-colegio [(ngModel)]="datos.colegio_id" [colegios]="colegios" inputId="g-colegio" />
          </div>
          <div>
            <label for="g-programa" class="block text-sm font-semibold text-gray-700 mb-1">Programa</label>
            <select id="g-programa" [(ngModel)]="datos.curso_id" class="campo" [disabled]="edicion.participantes > 0">
              <option [ngValue]="null">Elige el programa</option>
              @for (p of programas; track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
            </select>
            @if (edicion.participantes > 0) {
              <p class="text-xs text-gray-500 mt-1">No se puede cambiar: la edición ya tiene participantes.</p>
            }
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="g-inicio" class="block text-sm font-semibold text-gray-700 mb-1">Inicia</label>
              <input id="g-inicio" type="date" [(ngModel)]="datos.fecha_inicio" class="campo">
            </div>
            <div>
              <label for="g-fin" class="block text-sm font-semibold text-gray-700 mb-1">Termina</label>
              <input id="g-fin" type="date" [(ngModel)]="datos.fecha_fin" class="campo">
            </div>
          </div>
        </div>
      </section>

      <!-- Economía -->
      <section class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
        <h2 class="font-bold text-gray-800">Economía</h2>
        <div class="mt-4 space-y-4">
          <div>
            <label for="g-tasa" class="block text-sm font-semibold text-gray-700 mb-1">Tasa inicial (R0)</label>
            <div class="flex items-center gap-2">
              <input id="g-tasa" wgNumero [(ngModel)]="datos.tasa_inicial" class="campo" [disabled]="edicion.estado !== 'borrador'">
              <span class="text-sm text-gray-500 whitespace-nowrap">pesos = 1 billete</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">Con una tasa de {{ miles(datos.tasa_inicial) }}, un producto de 5.000 pesos cuesta {{ miles(ejemploPrecio) }} billetes.</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="g-min" class="block text-sm font-semibold text-gray-700 mb-1">Tope mínimo</label>
              <input id="g-min" wgNumero [decimales]="2" [(ngModel)]="datos.tope_minimo" class="campo">
              <p class="text-xs text-gray-500 mt-1">La tasa nunca baja de {{ miles(minimo) }}</p>
            </div>
            <div>
              <label for="g-max" class="block text-sm font-semibold text-gray-700 mb-1">Tope máximo</label>
              <input id="g-max" wgNumero [decimales]="2" [(ngModel)]="datos.tope_maximo" class="campo">
              <p class="text-xs text-gray-500 mt-1">La tasa nunca sube de {{ miles(maximo) }}</p>
            </div>
          </div>
          <div>
            <label for="g-bill" class="block text-sm font-semibold text-gray-700 mb-1">Investment Bill (billetes de bienvenida por estudiante)</label>
            <input id="g-bill" wgNumero [(ngModel)]="datos.investment_bill" class="campo" [disabled]="edicion.estado !== 'borrador'">
            <p class="text-xs text-gray-500 mt-1">Salen del banco de su país al abrir la edición. Déjalo en 0 si no aplica.</p>
          </div>
        </div>
      </section>

      <!-- Horario -->
      <section class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 lg:col-span-2">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-bold text-gray-800">Horario de la economía</h2>
            <p class="text-sm text-gray-500 mt-1">La tasa de cambio solo se mueve dentro de estas franjas (hora de Colombia). Fuera de ellas queda congelada, y al día siguiente sigue desde el último valor.</p>
          </div>
        </div>
        <div class="mt-4 space-y-2">
          @for (f of horario; track $index; let i = $index) {
            <div class="flex flex-wrap items-center gap-2 bg-gray-50 rounded-xl p-2">
              <select [(ngModel)]="f.tipo" class="campo !w-auto !py-2" [attr.aria-label]="'Tipo de la franja ' + (i + 1)">
                <option value="dia">Cada semana</option>
                <option value="fecha">Fecha exacta</option>
              </select>
              @if (f.tipo === 'dia') {
                <select [(ngModel)]="f.dia" class="campo !w-auto !py-2" aria-label="Día">
                  @for (d of dias; track d.id) { <option [value]="d.id">{{ d.texto }}</option> }
                </select>
              } @else {
                <input type="date" [(ngModel)]="f.fecha" class="campo !w-auto !py-2" aria-label="Fecha">
              }
              <span class="text-sm text-gray-500">de</span>
              <input type="time" [(ngModel)]="f.inicio" class="campo !w-auto !py-2" aria-label="Hora de inicio">
              <span class="text-sm text-gray-500">a</span>
              <input type="time" [(ngModel)]="f.fin" class="campo !w-auto !py-2" aria-label="Hora de fin">
              <button type="button" (click)="horario.splice(i, 1)" class="ml-auto px-3 py-2 text-sm rounded-lg text-red-700 hover:bg-red-50" aria-label="Quitar franja">Quitar</button>
            </div>
          }
          @if (!horario.length) {
            <p class="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">Sin franjas, la tasa de cambio no se moverá nunca.</p>
          }
          <button type="button" (click)="agregarFranja()" class="mt-1 px-4 py-2 text-sm font-semibold rounded-xl border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50">+ Agregar franja</button>
        </div>
      </section>
    </div>

    <div class="sticky bottom-0 mt-5 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-gray-50/90 backdrop-blur flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end">
      @if (error) { <p class="text-sm text-red-700 sm:mr-auto" role="alert">{{ error }}</p> }
      @if (guardado) { <p class="text-sm text-emerald-700 sm:mr-auto" role="status">Cambios guardados.</p> }
      <button type="button" (click)="guardar()" [disabled]="guardando"
              class="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-60">
        {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </div>
  `,
  styles: [`
    .campo { width: 100%; padding: 0.625rem 1rem; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 0.75rem; }
    .campo:focus { outline: none; border-color: #fb923c; box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2); }
    .campo:disabled { color: #6b7280; background: #f3f4f6; cursor: not-allowed; }
  `],
})
export class TabGeneral implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() guardada = new EventEmitter<Edicion>();
  private willGo = inject(WillGoService);
  readonly dias = DIAS_SEMANA;
  readonly miles = (v: unknown) => formatearNumero(v as number);

  datos: Partial<Edicion> = {};
  horario: { tipo: 'dia' | 'fecha'; dia: string; fecha: string; inicio: string; fin: string }[] = [];
  colegios: { id: string; nombre: string }[] = [];
  programas: { id: string; nombre: string }[] = [];
  guardando = false;
  guardado = false;
  error = '';

  ngOnInit(): void {
    const e = this.edicion;
    this.datos = {
      nombre: e.nombre, colegio_id: e.colegio_id, curso_id: e.curso_id,
      fecha_inicio: e.fecha_inicio?.slice(0, 10) ?? null, fecha_fin: e.fecha_fin?.slice(0, 10) ?? null,
      tasa_inicial: e.tasa_inicial, tope_minimo: Number(e.tope_minimo), tope_maximo: Number(e.tope_maximo),
      investment_bill: e.investment_bill,
    };
    this.horario = (e.horario ?? []).map((f) => ({
      tipo: f.fecha ? 'fecha' : 'dia', dia: f.dia ?? 'sabado', fecha: f.fecha ?? '', inicio: f.inicio, fin: f.fin,
    }));
    this.willGo.catalogos().subscribe({ next: (c) => { this.colegios = c.colegios; this.programas = c.programas; } });
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

  agregarFranja(): void {
    this.horario.push({ tipo: 'dia', dia: 'sabado', fecha: '', inicio: '08:00', fin: '18:00' });
  }

  guardar(): void {
    this.error = '';
    this.guardado = false;
    const horario: Franja[] = this.horario.map((f) =>
      f.tipo === 'fecha' ? { fecha: f.fecha, inicio: f.inicio, fin: f.fin } : { dia: f.dia, inicio: f.inicio, fin: f.fin });
    if (horario.some((f) => !f.inicio || !f.fin || f.inicio >= f.fin || ('fecha' in f && !f.fecha))) {
      this.error = 'Revisa el horario: cada franja necesita su día o fecha, y la hora de inicio debe ser antes que la de fin.';
      return;
    }
    const cambios: Partial<Edicion> = { ...this.datos, horario };
    if (this.edicion.estado !== 'borrador') delete cambios.tasa_inicial;
    if (this.edicion.participantes > 0) delete cambios.curso_id;
    this.guardando = true;
    this.willGo.actualizarEdicion(this.edicion.id, cambios).subscribe({
      next: (e) => { this.guardando = false; this.guardado = true; this.guardada.emit(e); },
      error: (err) => { this.guardando = false; this.error = WillGoService.mensajeDeError(err); },
    });
  }
}
