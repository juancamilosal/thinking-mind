import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Edicion, Oferta, WillGoService } from '../../../../core/services/will-go.service';
import { ESTADO_EDICION } from './estado-edicion';
import { BuscadorOfertaComponent, OfertaElegida } from '../../buscador-oferta.component';
import { EliminarEdicionComponent } from './eliminar-edicion.component';

@Component({
  selector: 'app-ediciones-will-go',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, BuscadorOfertaComponent, EliminarEdicionComponent],
  template: `
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Ediciones</h1>
          <p class="text-gray-500 mt-1">Cada fin de semana de Will-Go es una edición.</p>
        </div>
        <button type="button" (click)="abrirFormulario()"
                class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow hover:brightness-110">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Nueva edición
        </button>
      </div>

      <div class="mt-6">
        @if (cargando) {
          <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando ediciones…</div>
        } @else if (error) {
          <div class="bg-white rounded-2xl border border-red-200 p-8 text-center">
            <p class="text-red-700">{{ error }}</p>
            <button type="button" (click)="cargar()" class="mt-3 text-orange-700 font-semibold hover:underline">Reintentar</button>
          </div>
        } @else if (!ediciones.length) {
          <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <p class="text-gray-700 font-semibold">Todavía no hay ediciones</p>
            <p class="text-gray-500 text-sm mt-1">Crea la primera con «Nueva edición». Viene lista con los 3 países y los 5 fondos.</p>
          </div>
        } @else {
          <!-- Vigentes / Terminadas (terminada = ya pasó su fecha de fin o está cerrada) -->
          <div class="mb-4 inline-flex gap-1 bg-white border border-gray-200 rounded-xl p-1" role="tablist">
            @for (v of vistas; track v.id) {
              <button type="button" role="tab" [attr.aria-selected]="vista === v.id" (click)="vista = v.id"
                      class="px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5" [class]="vista === v.id ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:bg-gray-100'">
                {{ v.texto }} <span class="text-xs font-bold px-1.5 rounded-full" [class]="vista === v.id ? 'bg-orange-200' : 'bg-gray-100'">{{ v.id === 'vigentes' ? vigentes.length : terminadas.length }}</span>
              </button>
            }
          </div>
          @if (!visibles.length) {
            <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">
              {{ vista === 'vigentes' ? 'No hay ediciones vigentes. Crea una con «Nueva edición».' : 'Todavía no hay ediciones terminadas.' }}
            </div>
          }
          <div class="grid gap-4 md:grid-cols-2">
            @for (e of visibles; track e.id) {
              <article class="group bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-orange-300 transition flex flex-col" [class.opacity-75]="terminada(e)">
                <a [routerLink]="['/private-will-go/ediciones', e.id]" class="block">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="font-bold text-gray-800 text-lg truncate">{{ e.nombre }}</p>
                      <p class="text-sm text-gray-500 truncate">{{ e.colegio_nombre || 'Sin colegio' }} · {{ e.programa_nombre || 'Sin programa' }}{{ e.edicion_programa ? ' · Edición ' + e.edicion_programa : '' }}</p>
                    </div>
                    @if (terminada(e)) {
                      <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-700">Terminada</span>
                    } @else {
                      <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full" [class]="estado[e.estado].clase">{{ estado[e.estado].texto }}</span>
                    }
                  </div>
                  <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                    <span>📅 {{ fechas(e) }}</span>
                    <span>👥 {{ e.participantes }} estudiantes</span>
                    @if (e.sin_pais) { <span class="text-amber-700">⚠ {{ e.sin_pais }} sin país</span> }
                  </div>
                </a>
                <div class="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                  <a [routerLink]="['/private-will-go/ediciones', e.id]" class="text-sm font-semibold text-orange-700 hover:underline mr-auto">Administrar →</a>
                  <a [routerLink]="['/private-will-go/ediciones', e.id]" [queryParams]="{ pestana: 'general' }" class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">Editar</a>
                  <button type="button" (click)="aEliminar = e" class="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50">Eliminar</button>
                </div>
              </article>
            }
          </div>
        }
      </div>
    </div>

    @if (aEliminar) {
      <wg-eliminar-edicion [edicion]="aEliminar" (cancelar)="aEliminar = null" (eliminada)="alEliminar()" />
    }

    @if (aviso) {
      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 text-white px-5 py-3 shadow-lg text-sm" role="status">{{ aviso }}</div>
    }

    @if (formularioAbierto) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="formularioAbierto = false">
        <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="px-6 pt-6 pb-2 flex items-start justify-between">
            <h2 class="text-xl font-bold text-gray-800">Nueva edición</h2>
            <button type="button" (click)="formularioAbierto = false" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="crear()" class="px-6 pb-6 space-y-4" novalidate>
            <div>
              <label for="e-nombre" class="block text-sm font-semibold text-gray-700 mb-1">Nombre</label>
              <input id="e-nombre" formControlName="nombre" placeholder="Ej.: Will-Go Economy · Noviembre 2026" class="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
            </div>
            <div>
              <label for="e-oferta" class="block text-sm font-semibold text-gray-700 mb-1">Colegio, programa y edición</label>
              <wg-buscador-oferta inputId="e-oferta" [ofertas]="ofertas" [actual]="ofertaElegida" (elegida)="alElegirOferta($event)" />
              <p class="text-xs text-gray-500 mt-1">Solo entran los estudiantes inscritos en esa edición del programa en ese colegio.</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="e-inicio" class="block text-sm font-semibold text-gray-700 mb-1">Inicia</label>
                <input id="e-inicio" type="date" formControlName="fecha_inicio" class="w-full px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
              </div>
              <div>
                <label for="e-fin" class="block text-sm font-semibold text-gray-700 mb-1">Termina</label>
                <input id="e-fin" type="date" formControlName="fecha_fin" class="w-full px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
              </div>
            </div>
            <p class="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">Se crea con Wonderland, Neverland y Dreamland, los 5 fondos y horario sábado y domingo de 8:00 a 18:00. Todo se puede cambiar después.</p>
            @if (errorFormulario) {
              <p class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ errorFormulario }}</p>
            }
            <div class="flex gap-3 pt-2">
              <button type="button" (click)="formularioAbierto = false" class="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button type="submit" [disabled]="guardando" class="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-60">
                {{ guardando ? 'Creando…' : 'Crear edición' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class EdicionesWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  readonly estado = ESTADO_EDICION;

  ediciones: Edicion[] = [];
  readonly vistas: { id: 'vigentes' | 'terminadas'; texto: string }[] = [{ id: 'vigentes', texto: 'Vigentes' }, { id: 'terminadas', texto: 'Terminadas' }];
  vista: 'vigentes' | 'terminadas' = 'vigentes';

  /** Hoy en Colombia (AAAA-MM-DD), para comparar con las fechas del programa. */
  private get hoy(): string { return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); }
  /** Terminada = ya pasó su fecha de fin (o está cerrada). */
  terminada(e: Edicion): boolean { return e.estado === 'cerrada' || (!!e.fecha_fin && String(e.fecha_fin).slice(0, 10) < this.hoy); }
  get vigentes(): Edicion[] { return this.ediciones.filter((e) => !this.terminada(e)); }
  get terminadas(): Edicion[] { return this.ediciones.filter((e) => this.terminada(e)); }
  get visibles(): Edicion[] { return this.vista === 'vigentes' ? this.vigentes : this.terminadas; }

  /** «19 – 20 dic 2026»: las fechas se guardan sin hora y se leen tal cual (sin correrse por la zona horaria). */
  fechas(e: Edicion): string {
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const partes = (v: string | null | undefined) => {
      if (!v) return null;
      const [a, m, d] = String(v).slice(0, 10).split('-').map(Number);
      return { a, m: MESES[m - 1], d };
    };
    const i = partes(e.fecha_inicio), f = partes(e.fecha_fin);
    if (!i && !f) return 'Sin fecha';
    if (!i || !f) { const x = (i ?? f)!; return `${x.d} ${x.m} ${x.a}`; }
    if (i.a === f.a && i.m === f.m) return i.d === f.d ? `${i.d} ${i.m} ${i.a}` : `${i.d} – ${f.d} ${f.m} ${f.a}`;
    if (i.a === f.a) return `${i.d} ${i.m} – ${f.d} ${f.m} ${f.a}`;
    return `${i.d} ${i.m} ${i.a} – ${f.d} ${f.m} ${f.a}`;
  }

  aEliminar: Edicion | null = null;
  aviso = '';
  cargando = true;
  error = '';
  ofertas: Oferta[] = [];
  ofertaElegida: OfertaElegida | null = null;
  formularioAbierto = false;
  guardando = false;
  errorFormulario = '';
  form = this.fb.group({
    nombre: ['', Validators.required],
    colegio_id: [null as string | null],
    curso_id: ['', Validators.required],
    edicion_programa: ['', Validators.required],
    fecha_inicio: [''],
    fecha_fin: [''],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.willGo.ediciones().subscribe({
      next: (lista) => { this.ediciones = lista; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  alEliminar(): void {
    const nombre = this.aEliminar?.nombre;
    this.ediciones = this.ediciones.filter((x) => x.id !== this.aEliminar?.id);
    this.aEliminar = null;
    this.aviso = `Se eliminó «${nombre}».`;
    setTimeout(() => (this.aviso = ''), 4000);
  }

  abrirFormulario(): void {
    this.form.reset({ nombre: '', colegio_id: null, curso_id: '', edicion_programa: '', fecha_inicio: '', fecha_fin: '' });
    this.ofertaElegida = null;
    this.errorFormulario = '';
    this.formularioAbierto = true;
    this.willGo.catalogos().subscribe({
      next: (c) => (this.ofertas = c.ofertas),
      error: (e) => (this.errorFormulario = WillGoService.mensajeDeError(e)),
    });
  }

  alElegirOferta(o: Oferta): void {
    this.ofertaElegida = { colegio_id: o.colegio_id, curso_id: o.curso_id, edicion_programa: String(o.edicion) };
    this.form.patchValue({ colegio_id: o.colegio_id, curso_id: o.curso_id, edicion_programa: String(o.edicion) });
    // Propone un nombre si todavía no lo escribieron
    if (!this.form.value.nombre) this.form.patchValue({ nombre: `${o.programa} · ${o.colegio ?? 'Independiente'} · Edición ${o.edicion}` });
    if (!this.form.value.fecha_fin && o.fecha_finalizacion) this.form.patchValue({ fecha_fin: o.fecha_finalizacion.slice(0, 10) });
  }

  crear(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.errorFormulario = 'Escribe el nombre y elige el colegio, programa y edición.';
      return;
    }
    this.guardando = true;
    this.errorFormulario = '';
    const v = this.form.value;
    this.willGo.crearEdicion({
      nombre: v.nombre!, colegio_id: v.colegio_id || null, curso_id: v.curso_id || null, edicion_programa: v.edicion_programa || null,
      fecha_inicio: v.fecha_inicio || null, fecha_fin: v.fecha_fin || null,
    }).subscribe({
      next: (e) => { this.guardando = false; this.formularioAbierto = false; this.router.navigate(['/private-will-go/ediciones', e.id]); },
      error: (e) => { this.guardando = false; this.errorFormulario = WillGoService.mensajeDeError(e); },
    });
  }
}
