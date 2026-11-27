import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Edicion, Grupo, Pais, Participante, WillGoService } from '../../../../../core/services/will-go.service';
import { ConfirmacionService } from '../../../../../core/services/confirmacion.service';

/** Colores sugeridos para los grupos. */
const COLORES = ['#F97316', '#3B82F6', '#22C55E', '#A855F7', '#EF4444', '#14B8A6', '#EAB308', '#EC4899'];

/**
 * Grupos (administrativo): dentro de cada país se crean grupos con nombre y color y se ubican los estudiantes.
 * Quienes están en el país sin grupo aparecen en «Sin grupo asignado» (solo los ve el administrativo).
 */
@Component({
  selector: 'app-tab-grupos',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    @if (cargando) {
      <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.pestanas.comun.cargando' | translate }}</div>
    } @else if (!paises.length) {
      <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.grupos.sinPaises' | translate }}</div>
    } @else {
      <p class="text-sm text-gray-500">{{ 'wg.grupos.intro' | translate }}</p>

      <!-- País -->
      <div class="mt-4 flex flex-wrap gap-2">
        @for (p of paises; track p.id) {
          <button type="button" (click)="elegirPais(p)" class="px-4 py-2 rounded-xl text-sm font-semibold border-2"
                  [style.background]="pais?.id === p.id ? (p.color || '#1e293b') : '#fff'" [style.border-color]="p.color || '#cbd5e1'"
                  [style.color]="pais?.id === p.id ? '#fff' : '#334155'">{{ p.nombre }} · {{ delPais(p.id).length }}</button>
        }
      </div>

      @if (aviso) { <p class="mt-4 rounded-xl px-4 py-3 text-sm" [class]="avisoError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'" role="status">{{ aviso }}</p> }

      @if (pais) {
        <!-- Grupos del país -->
        <div class="mt-5 flex items-center justify-between gap-3">
          <h3 class="font-bold text-gray-800">{{ 'wg.grupos.gruposDe' | translate: { pais: pais.nombre } }}</h3>
          <button type="button" (click)="nuevo()" class="shrink-0 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow hover:brightness-110">{{ 'wg.grupos.nuevo' | translate }}</button>
        </div>
        @if (!gruposPais.length) {
          <div class="mt-3 bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">{{ 'wg.grupos.vacio' | translate }}</div>
        } @else {
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            @for (g of gruposPais; track g.id) {
              <article class="relative overflow-hidden rounded-2xl text-white shadow-md" [style.background]="fondo(g.color)">
                <span class="absolute -right-6 -bottom-8 w-28 h-28 rounded-full bg-white/15"></span>
                <div class="relative p-4">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-lg font-extrabold break-words min-w-0">{{ g.nombre }}</p>
                    <span class="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-white/20">{{ deGrupo(g.id).length }}</span>
                  </div>
                  <ul class="mt-2 space-y-1 max-h-40 overflow-y-auto pr-1">
                    @for (e of deGrupo(g.id); track e.id) {
                      <li class="flex items-center justify-between gap-2 text-sm bg-white/10 rounded-lg px-2 py-1">
                        <span class="truncate">{{ e.nombre }} {{ e.apellido }}</span>
                        <button type="button" (click)="mover([e.id], null)" class="shrink-0 text-xs font-semibold underline opacity-90 hover:opacity-100">{{ 'wg.grupos.quitar' | translate }}</button>
                      </li>
                    } @empty {
                      <li class="text-sm opacity-80">{{ 'wg.grupos.sinEstudiantes' | translate }}</li>
                    }
                  </ul>
                  <div class="mt-3 flex gap-3 text-sm font-semibold">
                    <button type="button" (click)="editar(g)" class="underline opacity-90 hover:opacity-100">{{ 'wg.pestanas.comun.editar' | translate }}</button>
                    <button type="button" (click)="borrar(g)" class="underline opacity-90 hover:opacity-100">{{ 'wg.pestanas.comun.eliminar' | translate }}</button>
                  </div>
                </div>
              </article>
            }
          </div>
        }

        <!-- Sin grupo asignado -->
        <section class="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div class="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <h3 class="font-bold text-gray-800">{{ 'wg.grupos.sinGrupo' | translate }} · {{ sinGrupo.length }}</h3>
            @if (sinGrupo.length && gruposPais.length) {
              <div class="flex flex-col sm:flex-row gap-2">
                <select [(ngModel)]="destino" [attr.aria-label]="'wg.grupos.agregarA' | translate"
                        class="px-3 py-2 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <option value="">{{ 'wg.grupos.eligeGrupo' | translate }}</option>
                  @for (g of gruposPais; track g.id) { <option [value]="g.id">{{ g.nombre }}</option> }
                </select>
                <button type="button" (click)="agregarElegidos()" [disabled]="!destino || !elegidos.size || trabajando"
                        class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40">
                  {{ 'wg.grupos.agregarN' | translate: { n: elegidos.size } }}
                </button>
              </div>
            }
          </div>
          @if (!sinGrupo.length) {
            <p class="px-4 py-6 text-center text-sm text-gray-500">{{ 'wg.grupos.todosConGrupo' | translate }}</p>
          } @else {
            <label class="flex items-center gap-2 px-4 py-2 border-b border-gray-100 text-sm text-gray-600">
              <input type="checkbox" [checked]="elegidos.size === sinGrupo.length" (change)="alternarTodos()"> {{ 'wg.grupos.todos' | translate }}
            </label>
            <ul class="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              @for (e of sinGrupo; track e.id) {
                <li>
                  <label class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" [checked]="elegidos.has(e.id)" (change)="alternar(e.id)">
                    <span class="min-w-0 flex-1 truncate text-gray-800">{{ e.nombre }} {{ e.apellido }}</span>
                    @if (e.grado) { <span class="text-xs text-gray-500 whitespace-nowrap">{{ e.grado }}</span> }
                  </label>
                </li>
              }
            </ul>
          }
        </section>
      }
    }

    <!-- Crear / editar grupo -->
    @if (borrador) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="borrador = null">
        <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-grupo">
          <h2 id="titulo-grupo" class="text-lg font-bold text-gray-800">{{ (borrador.id ? 'wg.grupos.editarTitulo' : 'wg.grupos.nuevoTitulo') | translate: { pais: pais?.nombre } }}</h2>
          <label for="g-nombre-grupo" class="mt-4 block text-sm font-semibold text-gray-700 mb-1">{{ 'wg.pestanas.comun.nombre' | translate }}</label>
          <input id="g-nombre-grupo" [(ngModel)]="borrador.nombre" maxlength="60" [placeholder]="'wg.grupos.ejemploNombre' | translate"
                 class="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
          <p class="mt-4 text-sm font-semibold text-gray-700 mb-2">{{ 'wg.grupos.color' | translate }}</p>
          <div class="flex flex-wrap items-center gap-2">
            @for (c of colores; track c) {
              <button type="button" (click)="borrador.color = c" class="w-9 h-9 rounded-full ring-offset-2 transition" [style.background]="c"
                      [class]="borrador.color === c ? 'ring-2 ring-gray-800' : ''" [attr.aria-label]="c"></button>
            }
            <input type="color" [(ngModel)]="borrador.color" class="w-9 h-9 rounded-full border border-gray-200 p-0.5 bg-white" [attr.aria-label]="'wg.grupos.otroColor' | translate">
          </div>
          <div class="mt-4 rounded-xl p-4 text-white font-extrabold text-lg" [style.background]="fondo(borrador.color || null)">{{ borrador.nombre || ('wg.grupos.ejemploNombre' | translate) }}</div>
          @if (errorForm) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorForm }}</p> }
          <div class="mt-5 flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" (click)="borrador = null" class="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.pestanas.comun.cancelar' | translate }}</button>
            <button type="button" (click)="guardar()" [disabled]="trabajando || !borrador.nombre.trim()" class="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-50">{{ (trabajando ? 'wg.pestanas.comun.guardando' : 'wg.pestanas.comun.guardar') | translate }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TabGrupos implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  private confirmacion = inject(ConfirmacionService);
  readonly colores = COLORES;

  paises: Pais[] = [];
  grupos: Grupo[] = [];
  estudiantes: Participante[] = [];
  pais: Pais | null = null;
  cargando = true;
  trabajando = false;
  aviso = '';
  avisoError = false;
  elegidos = new Set<string>();
  destino = '';
  borrador: { id?: string; nombre: string; color: string } | null = null;
  errorForm = '';

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    let pendientes = 3;
    const listo = () => { if (--pendientes === 0) { this.cargando = false; this.pais ??= this.paises[0] ?? null; } };
    const fallo = (e: unknown) => { this.mostrar(WillGoService.mensajeDeError(e), true); listo(); };
    this.willGo.seccion<Pais>(this.edicion.id, 'paises').subscribe({ next: (p) => { this.paises = p; this.pais = p.find((x) => x.id === this.pais?.id) ?? null; listo(); }, error: fallo });
    this.willGo.seccion<Grupo>(this.edicion.id, 'grupos').subscribe({ next: (g) => { this.grupos = g; listo(); }, error: fallo });
    this.willGo.participantes(this.edicion.id).subscribe({ next: (l) => { this.estudiantes = l.filter((e) => !e.retirado); listo(); }, error: fallo });
  }

  elegirPais(p: Pais): void { this.pais = p; this.elegidos.clear(); this.destino = ''; }
  delPais(id: string): Participante[] { return this.estudiantes.filter((e) => e.pais_id === id); }
  get gruposPais(): Grupo[] { return this.grupos.filter((g) => g.pais_id === this.pais?.id); }
  deGrupo(id: string): Participante[] {
    return this.estudiantes.filter((e) => e.grupo_id === id).sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`));
  }
  get sinGrupo(): Participante[] {
    const ids = new Set(this.gruposPais.map((g) => g.id));
    return this.delPais(this.pais?.id ?? '').filter((e) => !e.grupo_id || !ids.has(e.grupo_id))
      .sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`));
  }

  fondo(color: string | null): string {
    const c = color || '#475569';
    return `linear-gradient(135deg, ${c} 0%, color-mix(in srgb, ${c} 70%, #000) 100%)`;
  }

  alternar(id: string): void { if (this.elegidos.has(id)) this.elegidos.delete(id); else this.elegidos.add(id); }
  alternarTodos(): void {
    if (this.elegidos.size === this.sinGrupo.length) this.elegidos.clear();
    else this.sinGrupo.forEach((e) => this.elegidos.add(e.id));
  }

  nuevo(): void {
    this.errorForm = '';
    this.borrador = { nombre: '', color: COLORES[this.gruposPais.length % COLORES.length] };
  }
  editar(g: Grupo): void { this.errorForm = ''; this.borrador = { id: g.id, nombre: g.nombre, color: g.color || COLORES[0] }; }

  guardar(): void {
    const b = this.borrador;
    if (!b || !this.pais || !b.nombre.trim()) return;
    this.trabajando = true;
    this.errorForm = '';
    const datos: Partial<Grupo> = { nombre: b.nombre.trim(), color: b.color, pais_id: this.pais.id };
    const peticion = b.id
      ? this.willGo.actualizarEnSeccion<Grupo>('grupos', b.id, datos)
      : this.willGo.crearEnSeccion<Grupo>(this.edicion.id, 'grupos', { ...datos, orden: this.gruposPais.length + 1 });
    peticion.subscribe({
      next: (g) => {
        this.trabajando = false;
        this.borrador = null;
        this.grupos = b.id ? this.grupos.map((x) => (x.id === g.id ? g : x)) : [...this.grupos, g];
        this.mostrar(this.t.instant('wg.grupos.guardado', { nombre: g.nombre }), false);
      },
      error: (e) => { this.trabajando = false; this.errorForm = WillGoService.mensajeDeError(e); },
    });
  }

  async borrar(g: Grupo): Promise<void> {
    const ok = await this.confirmacion.pedir({
      titulo: this.t.instant('wg.grupos.confirmarBorrar', { nombre: g.nombre }),
      texto: this.t.instant('wg.grupos.confirmarBorrarTexto'),
      aceptar: this.t.instant('wg.pestanas.comun.eliminar'), peligro: true,
    });
    if (!ok) return;
    this.willGo.borrarGrupo(g.id).subscribe({
      next: () => {
        this.grupos = this.grupos.filter((x) => x.id !== g.id);
        this.estudiantes.forEach((e) => { if (e.grupo_id === g.id) e.grupo_id = null; });
        this.mostrar(this.t.instant('wg.grupos.borrado', { nombre: g.nombre }), false);
      },
      error: (e) => this.mostrar(WillGoService.mensajeDeError(e), true),
    });
  }

  agregarElegidos(): void { if (this.destino) this.mover([...this.elegidos], this.destino); }

  /** Mete estudiantes a un grupo (o los saca, con grupoId null). */
  mover(ids: string[], grupoId: string | null): void {
    if (!ids.length) return;
    this.trabajando = true;
    this.willGo.actualizarParticipantes(ids, { grupo_id: grupoId }).subscribe({
      next: () => {
        this.trabajando = false;
        this.estudiantes.forEach((e) => { if (ids.includes(e.id)) e.grupo_id = grupoId; });
        this.elegidos.clear();
        this.destino = '';
      },
      error: (e) => { this.trabajando = false; this.mostrar(WillGoService.mensajeDeError(e), true); },
    });
  }

  private mostrar(texto: string, esError: boolean): void {
    this.aviso = texto;
    this.avisoError = esError;
    if (!esError) setTimeout(() => { if (this.aviso === texto) this.aviso = ''; }, 4000);
  }
}
