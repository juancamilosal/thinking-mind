import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NumeroMilesDirective, formatearNumero } from '../../../numero-miles.directive';
import { DecimalPipe } from '@angular/common';
import { Edicion, Pais, WillGoService } from '../../../../../core/services/will-go.service';

@Component({
  selector: 'app-tab-paises',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, DecimalPipe],
  template: `
    <p class="text-sm text-gray-500 mb-4">Cada país tiene su moneda. La <b>provisión</b> son los billetes que recibe el banco de ese país al abrir la edición; de ahí salen la bienvenida de los estudiantes y lo que el banco reparte a los docentes.</p>
    @if (cargando) {
      <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando países…</div>
    } @else {
      <div class="grid gap-4 md:grid-cols-3">
        @for (p of paises; track p.id) {
          <section class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="h-2" [style.background]="p.color || '#94a3b8'"></div>
            <div class="p-5 space-y-3">
              <div class="flex items-center gap-3">
                <input type="color" [(ngModel)]="p.color" class="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" [attr.aria-label]="'Color de ' + p.nombre">
                <input [(ngModel)]="p.nombre" class="campo font-bold" [attr.aria-label]="'Nombre del país'">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1" [attr.for]="'mon-' + p.id">Código de la moneda</label>
                <input [id]="'mon-' + p.id" [(ngModel)]="p.codigo_moneda" maxlength="5" class="campo uppercase" placeholder="WON">
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1" [attr.for]="'prov-' + p.id">Provisión del banco (billetes)</label>
                <input [id]="'prov-' + p.id" wgNumero [(ngModel)]="p.provision_inicial" class="campo" [disabled]="edicion.estado !== 'borrador'">
                @if (necesarios(p) > (p.provision_inicial || 0)) {
                  <p class="text-xs text-red-700 mt-1">La bienvenida necesita al menos {{ necesarios(p) | number }} billetes en este país.</p>
                }
              </div>
              <div class="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
                <span class="text-gray-500">Tasa actual</span>
                <span class="font-semibold text-gray-800">{{ (p.tasa_actual || edicion.tasa_inicial) | number }} pesos</span>
              </div>
              <div class="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
                <span class="text-gray-500">Participantes</span>
                <span class="font-semibold text-gray-800">{{ conteo[p.id] || 0 }}</span>
              </div>
              <button type="button" (click)="guardar(p)" [disabled]="guardando === p.id"
                      class="w-full py-2.5 rounded-xl font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-60">
                {{ guardando === p.id ? 'Guardando…' : (guardado === p.id ? '✓ Guardado' : 'Guardar') }}
              </button>
            </div>
          </section>
        }
      </div>
      @if (error) { <p class="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p> }
    }
  `,
  styles: [`
    .campo { width: 100%; padding: 0.5rem 0.875rem; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 0.75rem; }
    .campo:focus { outline: none; border-color: #fb923c; box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2); }
    .campo:disabled { color: #6b7280; background: #f3f4f6; cursor: not-allowed; }
  `],
})
export class TabPaises implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() paisesCambiaron = new EventEmitter<Pais[]>();
  private willGo = inject(WillGoService);

  paises: Pais[] = [];
  conteo: Record<string, number> = {};
  cargando = true;
  guardando: string | null = null;
  guardado: string | null = null;
  error = '';

  ngOnInit(): void {
    this.willGo.seccion<Pais>(this.edicion.id, 'paises').subscribe({
      next: (lista) => { this.paises = lista; this.cargando = false; this.paisesCambiaron.emit(lista); },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
    this.willGo.participantes(this.edicion.id).subscribe({
      next: (lista) => {
        this.conteo = {};
        for (const p of lista) if (p.pais_id) this.conteo[p.pais_id] = (this.conteo[p.pais_id] ?? 0) + 1;
      },
    });
  }

  /** Billetes que el banco necesita para dar la bienvenida a los participantes de ese país. */
  necesarios(p: Pais): number {
    return (this.conteo[p.id] ?? 0) * (this.edicion.investment_bill || 0);
  }

  guardar(p: Pais): void {
    this.guardando = p.id;
    this.guardado = null;
    this.error = '';
    const datos: Partial<Pais> = { nombre: p.nombre, codigo_moneda: (p.codigo_moneda || '').toUpperCase() || null, color: p.color };
    if (this.edicion.estado === 'borrador') datos.provision_inicial = Number(p.provision_inicial) || 0;
    this.willGo.actualizarEnSeccion<Pais>('paises', p.id, datos).subscribe({
      next: (nuevo) => {
        this.paises = this.paises.map((x) => (x.id === nuevo.id ? nuevo : x));
        this.guardando = null;
        this.guardado = p.id;
        this.paisesCambiaron.emit(this.paises);
      },
      error: (e) => { this.guardando = null; this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
