import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NumeroMilesDirective } from '../../../numero-miles.directive';
import { TarjetaFondoComponent } from '../../../tarjeta-fondo.component';
import { Edicion, Fondo, WillGoService } from '../../../../../core/services/will-go.service';
import { reducirFoto } from '../estado-edicion';

type FondoEditable = Fondo & { base: number; alterno: number | null; varia: number; logoVista?: string | null };

@Component({
  selector: 'app-tab-fondos',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, TarjetaFondoComponent],
  template: `
    <p class="text-sm text-gray-500">Así ven las empresas los estudiantes y acudientes.</p>
    @if (cargando) {
      <div class="mt-4 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando fondos…</div>
    } @else {
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        @for (f of fondos; track f.id) {
          <wg-tarjeta-fondo [fondo]="f" [logoUrl]="logo(f)" [class.opacity-50]="!f.activo">
            <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100">
              <span class="text-xs text-gray-500">{{ f.activo ? 'Disponible' : 'No disponible' }}{{ guardado === f.id ? ' · ✓ Guardado' : '' }}</span>
              <button type="button" (click)="editar(f)" class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900">Editar</button>
            </div>
          </wg-tarjeta-fondo>
        }
      </div>
      @if (error && !borrador) { <p class="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p> }
    }

    @if (borrador; as b) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrar()">
        <div class="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-fondo">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <h2 id="titulo-fondo" class="text-lg font-bold text-gray-800">Editar empresa</h2>
            <button type="button" (click)="cerrar()" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
            <div class="flex items-center gap-4">
              <label class="w-20 h-20 shrink-0 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-orange-400">
                @if (b.logoVista || b.logo) {
                  <img [src]="b.logoVista || logo(b)" alt="Logo" class="w-full h-full object-cover">
                } @else {
                  <span class="text-xs text-gray-500 text-center px-1">Subir logo</span>
                }
                <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="elegirLogo($event)" aria-label="Logo de la empresa">
              </label>
              <div class="flex-1 min-w-0">
                <label class="etiqueta" for="f-nombre">Nombre</label>
                <input id="f-nombre" [(ngModel)]="b.nombre" class="campo font-bold">
                @if (subiendo) { <p class="text-xs text-gray-500 mt-1">Subiendo logo…</p> }
                @else if (b.logo) { <button type="button" (click)="b.logo = null; b.logoVista = null" class="text-xs text-red-600 mt-1 hover:underline">Quitar logo</button> }
              </div>
            </div>

            <div>
              <label class="etiqueta" for="f-dedica">¿A qué se dedica?</label>
              <textarea id="f-dedica" [(ngModel)]="b.a_que_se_dedica" rows="2" maxlength="160" class="campo" placeholder="Ej.: Limpiamos los océanos y reciclamos plástico."></textarea>
            </div>
            <div>
              <label class="etiqueta" for="f-razones">¿Por qué invertir? <span class="font-normal text-gray-400">(una razón por línea)</span></label>
              <textarea id="f-razones" [(ngModel)]="b.por_que_invertir" rows="5" maxlength="600" class="campo" placeholder="Todo el mundo necesita…"></textarea>
              @if (b.ejemplo) {
                <button type="button" (click)="usarEjemplo(b)" class="mt-1 text-sm font-semibold text-orange-600 hover:underline">Usar texto de ejemplo</button>
              }
            </div>

            <details class="rounded-xl border border-gray-200 p-3" [open]="!b.a_que_se_dedica">
              <summary class="text-sm font-semibold text-gray-700 cursor-pointer">Datos del juego <span class="font-normal text-gray-400">(solo los ve el equipo)</span></summary>
              <div class="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label class="etiqueta" for="f-riesgo">Riesgo</label>
                  <select id="f-riesgo" [(ngModel)]="b.riesgo" class="campo">
                    <option value="bajo">Bajo</option><option value="medio">Medio</option><option value="alto">Alto</option>
                  </select>
                </div>
                <div>
                  <label class="etiqueta" for="f-base">Base %</label>
                  <input id="f-base" wgNumero [decimales]="2" [negativos]="true" [(ngModel)]="b.base" class="campo">
                </div>
                <div>
                  <label class="etiqueta" for="f-alterno">Alterno %</label>
                  <input id="f-alterno" wgNumero [decimales]="2" [negativos]="true" [(ngModel)]="b.alterno" class="campo" placeholder="—" [disabled]="b.riesgo !== 'alto'">
                </div>
                <div>
                  <label class="etiqueta" for="f-varia">Variación ±%</label>
                  <input id="f-varia" wgNumero [decimales]="2" [(ngModel)]="b.varia" class="campo">
                </div>
              </div>
              <label class="flex items-center gap-2 text-sm text-gray-700 mt-3"><input type="checkbox" [(ngModel)]="b.activo"> Disponible para invertir</label>
            </details>
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            @if (error) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ error }}</p> }
            <button type="button" (click)="guardar()" [disabled]="guardando || subiendo || !b.nombre.trim()"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              {{ guardando ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
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

  fondos: FondoEditable[] = [];
  borrador: FondoEditable | null = null;
  cargando = true;
  guardando = false;
  subiendo = false;
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

  logo(f: Fondo): string | null { return f.logo ? this.willGo.urlFoto(f.logo) : null; }

  editar(f: FondoEditable): void {
    this.error = '';
    this.guardado = null;
    this.borrador = { ...f, logoVista: null };
  }

  cerrar(): void {
    if (!this.guardando) this.borrador = null;
  }

  usarEjemplo(b: FondoEditable): void {
    if (!b.ejemplo) return;
    b.a_que_se_dedica = b.ejemplo.a_que_se_dedica;
    b.por_que_invertir = b.ejemplo.por_que_invertir;
  }

  async elegirLogo(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    const b = this.borrador;
    if (!archivo || !b) return;
    this.subiendo = true;
    this.error = '';
    try {
      const { base64, tipo } = await reducirFoto(archivo);
      b.logoVista = `data:${tipo};base64,${base64}`;
      this.willGo.subirFoto(`logo-${b.nombre}`.replace(/[^\w.\- ]/g, '') + '.jpg', tipo, base64).subscribe({
        next: ({ id }) => { b.logo = id; this.subiendo = false; },
        error: (e) => { this.subiendo = false; b.logoVista = null; this.error = WillGoService.mensajeDeError(e); },
      });
    } catch (e) {
      this.subiendo = false;
      this.error = (e as Error).message;
    }
  }

  guardar(): void {
    const b = this.borrador;
    if (!b) return;
    this.guardando = true;
    this.error = '';
    const fr = (v: unknown) => Math.round(Number(v) * 100) / 10000;
    const limpio = (t: string | null) => (t ?? '').split('\n').map((x) => x.trim()).filter(Boolean).join('\n') || null;
    this.willGo.actualizarEnSeccion<Fondo>('fondos', b.id, {
      nombre: b.nombre.trim(), riesgo: b.riesgo, activo: b.activo, logo: b.logo ?? null,
      a_que_se_dedica: (b.a_que_se_dedica ?? '').replace(/\s+/g, ' ').trim() || null, por_que_invertir: limpio(b.por_que_invertir),
      rendimiento_base: fr(b.base),
      rendimiento_alterno: b.riesgo === 'alto' && b.alterno != null && String(b.alterno) !== '' ? fr(b.alterno) : null,
      variacion: fr(b.varia),
    }).subscribe({
      next: (nuevo) => {
        this.fondos = this.fondos.map((x) => (x.id === nuevo.id ? this.editable({ ...nuevo, ejemplo: x.ejemplo }) : x));
        this.guardando = false;
        this.guardado = nuevo.id;
        this.borrador = null;
      },
      error: (e) => { this.guardando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
