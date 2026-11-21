import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Edicion, Fondo, WillGoService } from '../../../../../core/services/will-go.service';

type FondoEditable = Fondo & { base: number; alterno: number | null; varia: number };

@Component({
  selector: 'app-tab-fondos',
  standalone: true,
  imports: [FormsModule],
  template: `
    <p class="text-sm text-gray-500">Al cerrar cada ronda, el rendimiento de un fondo es: <b>base</b> + bono por los votos de los acudientes (hasta ±2 %) + una <b>variación</b> al azar, con un límite de ±20 %. En riesgo alto, la mitad de las veces se usa el <b>escenario alterno</b>.</p>
    @if (cargando) {
      <div class="mt-4 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando fondos…</div>
    } @else {
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        @for (f of fondos; track f.id) {
          <section class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5" [class.opacity-60]="!f.activo">
            <div class="flex items-center gap-3">
              <input [(ngModel)]="f.nombre" class="campo font-bold" aria-label="Nombre del fondo">
              <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full" [class]="riesgos[f.riesgo].clase">Riesgo {{ f.riesgo }}</span>
            </div>
            <textarea [(ngModel)]="f.historia" rows="2" class="campo mt-3 text-sm" placeholder="Historia del fondo (lo que leen los acudientes al votar)" aria-label="Historia"></textarea>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              <div>
                <label class="etiqueta" [attr.for]="'r-' + f.id">Riesgo</label>
                <select [id]="'r-' + f.id" [(ngModel)]="f.riesgo" class="campo">
                  <option value="bajo">Bajo</option><option value="medio">Medio</option><option value="alto">Alto</option>
                </select>
              </div>
              <div>
                <label class="etiqueta" [attr.for]="'b-' + f.id">Base %</label>
                <input [id]="'b-' + f.id" type="number" step="0.5" [(ngModel)]="f.base" class="campo">
              </div>
              <div>
                <label class="etiqueta" [attr.for]="'a-' + f.id">Alterno %</label>
                <input [id]="'a-' + f.id" type="number" step="0.5" [(ngModel)]="f.alterno" class="campo" placeholder="—" [disabled]="f.riesgo !== 'alto'">
              </div>
              <div>
                <label class="etiqueta" [attr.for]="'v-' + f.id">Variación ±%</label>
                <input [id]="'v-' + f.id" type="number" min="0" step="0.5" [(ngModel)]="f.varia" class="campo">
              </div>
            </div>
            <div class="flex items-center justify-between mt-4">
              <label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" [(ngModel)]="f.activo"> Disponible</label>
              <button type="button" (click)="guardar(f)" [disabled]="guardando === f.id" class="px-5 py-2 rounded-xl font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-60">
                {{ guardando === f.id ? 'Guardando…' : (guardado === f.id ? '✓ Guardado' : 'Guardar') }}
              </button>
            </div>
          </section>
        }
      </div>
      @if (error) { <p class="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p> }
    }
  `,
  styles: [`
    .campo { width: 100%; padding: 0.5rem 0.75rem; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 0.75rem; }
    .campo:focus { outline: none; border-color: #fb923c; box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2); }
    .campo:disabled { background: #f3f4f6; color: #9ca3af; }
    .etiqueta { display: block; font-size: 0.75rem; font-weight: 600; color: #4b5563; margin-bottom: 0.25rem; }
  `],
})
export class TabFondos implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  private willGo = inject(WillGoService);
  readonly riesgos: Record<string, { clase: string }> = {
    bajo: { clase: 'bg-emerald-100 text-emerald-800' },
    medio: { clase: 'bg-amber-100 text-amber-800' },
    alto: { clase: 'bg-red-100 text-red-800' },
  };

  fondos: FondoEditable[] = [];
  cargando = true;
  guardando: string | null = null;
  guardado: string | null = null;
  error = '';

  ngOnInit(): void {
    this.willGo.seccion<Fondo>(this.edicion.id, 'fondos').subscribe({
      next: (l) => { this.fondos = l.map((f) => this.editable(f)); this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  /** En pantalla se muestran porcentajes (3); en la base se guardan fracciones (0.03). */
  private editable(f: Fondo): FondoEditable {
    const pct = (v: unknown) => Math.round(Number(v) * 10000) / 100;
    return { ...f, base: pct(f.rendimiento_base), alterno: f.rendimiento_alterno == null ? null : pct(f.rendimiento_alterno), varia: pct(f.variacion) };
  }

  guardar(f: FondoEditable): void {
    this.guardando = f.id;
    this.guardado = null;
    this.error = '';
    const fr = (v: unknown) => Math.round(Number(v) * 100) / 10000;
    this.willGo.actualizarEnSeccion<Fondo>('fondos', f.id, {
      nombre: f.nombre, historia: f.historia, riesgo: f.riesgo, activo: f.activo,
      rendimiento_base: fr(f.base),
      rendimiento_alterno: f.riesgo === 'alto' && f.alterno != null && String(f.alterno) !== '' ? fr(f.alterno) : null,
      variacion: fr(f.varia),
    }).subscribe({
      next: (nuevo) => {
        this.fondos = this.fondos.map((x) => (x.id === nuevo.id ? this.editable(nuevo) : x));
        this.guardando = null;
        this.guardado = f.id;
      },
      error: (e) => { this.guardando = null; this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
