import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Edicion, Funcionario, MiembroEquipo, Pais, WillGoService } from '../../../../../core/services/will-go.service';
import { formatearNumero } from '../../../numero-miles.directive';
import { TransaccionesEquipoComponent } from './transacciones-equipo.component';

type Rol = NonNullable<MiembroEquipo['rol']>;

@Component({
  selector: 'app-tab-equipo',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, TransaccionesEquipoComponent],
  template: `
    <div class="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <p class="text-sm text-gray-500">{{ 'wg.pestanas.equipo.intro' | translate }}</p>
      <div class="flex flex-col sm:flex-row gap-2 shrink-0">
        @if (equipo.length) {
          <button type="button" (click)="verTransacciones(null)" class="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>
            {{ 'wg.pestanas.transacciones.verTodas' | translate }}
          </button>
          <button type="button" (click)="avisar()" [disabled]="avisando" class="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            {{ avisando ? ('wg.pestanas.equipo.enviandoAviso' | translate) : ('wg.pestanas.equipo.enviarAviso' | translate) }}
          </button>
        }
        <button type="button" (click)="abrirAgregar()" class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow hover:brightness-110">
          {{ 'wg.pestanas.equipo.agregarColaboradores' | translate }}
        </button>
      </div>
    </div>
    <p class="mt-2 text-xs text-gray-500">{{ 'wg.pestanas.equipo.notaCorreo' | translate }}</p>

    @if (aviso) {
      <p class="mt-4 rounded-xl px-4 py-3 text-sm" [class]="avisoError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'" role="status">{{ aviso }}</p>
    }

    @if (cargando) {
      <div class="mt-4 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.pestanas.equipo.cargando' | translate }}</div>
    } @else if (!equipo.length) {
      <div class="mt-4 bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
        <p class="font-semibold text-gray-700">{{ 'wg.pestanas.equipo.sinEquipo' | translate }}</p>
        <p class="text-sm text-gray-500 mt-1">{{ 'wg.pestanas.equipo.sinEquipoAyuda' | translate }}</p>
      </div>
    } @else {
      <!-- Buscador y filtro por rol (quien tiene varios roles cuenta en cada uno) -->
      <div class="mt-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <input type="search" [(ngModel)]="busquedaLista" [placeholder]="'wg.pestanas.equipo.buscarEnEquipo' | translate" [attr.aria-label]="'wg.pestanas.equipo.buscarEnEquipo' | translate"
               class="w-full lg:w-80 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="chip" [class.activo]="filtroLista === ''" (click)="filtroLista = ''">{{ 'wg.pestanas.comun.todos' | translate }} · {{ equipo.length }}</button>
          @for (g of grupos; track g.rol) {
            @if (deRol(g.rol).length) {
              <button type="button" class="chip" [class.activo]="filtroLista === g.rol" (click)="filtroLista = g.rol">{{ g.titulo | translate }} · {{ deRol(g.rol).length }}</button>
            }
          }
        </div>
      </div>

      <!-- Lista ordenada por nombre: en computador como tabla (colaborador · roles · país · acciones) -->
      <div class="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="hidden lg:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-4 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <span>{{ 'wg.pestanas.equipo.colColaborador' | translate }}</span>
          <span>{{ 'wg.pestanas.equipo.colRoles' | translate }}</span>
          <span>{{ 'wg.pestanas.equipo.colPais' | translate }}</span>
          <span class="text-right">{{ 'wg.pestanas.equipo.colAcciones' | translate }}</span>
        </div>
        <ul class="divide-y divide-gray-100">
          @for (m of listaEquipo; track m.id) {
            <li class="px-4 sm:px-5 py-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 lg:gap-4 lg:items-center">
              <!-- Colaborador -->
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-white" [class]="colorDe(rolesDe(m)[0])">{{ (m.nombre[0] || '') + (m.apellido[0] || '') }}</div>
                <div class="min-w-0">
                  <p class="font-semibold text-gray-800 truncate">{{ m.nombre }} {{ m.apellido }}</p>
                  <p class="text-xs text-gray-500 truncate">{{ m.email }}{{ m.estado !== 'active' ? ' · ' + ('wg.pestanas.equipo.inactivo' | translate) : '' }}</p>
                </div>
              </div>
              <!-- Roles -->
              <div class="flex flex-wrap items-center gap-1.5 pl-[3.25rem] lg:pl-0">
                @for (r of rolesDe(m); track r) {
                  <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" [class]="etiquetaDe(r)">{{ ('wg.pestanas.equipo.roles.' + r) | translate }}</span>
                }
                @if (m.rol !== 'administrativo') {
                  <button type="button" (click)="abrirRoles(m)" class="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-700"
                          [attr.aria-label]="'wg.pestanas.equipo.editarRolesDe' | translate: { nombre: m.nombre }">{{ 'wg.pestanas.equipo.editarRoles' | translate }}</button>
                }
              </div>
              <!-- País y dinero (solo docentes) -->
              <div class="pl-[3.25rem] lg:pl-0 min-w-0" [class.hidden]="!rolesDe(m).includes('docente')" [class.lg:block]="!rolesDe(m).includes('docente')">
                @if (rolesDe(m).includes('docente')) {
                  <div class="flex flex-wrap items-center gap-2">
                    <select [id]="'pais-' + m.id" [ngModel]="m.pais_id" (ngModelChange)="asignarPais(m, $event)" [attr.aria-label]="'wg.pestanas.comun.pais' | translate"
                            class="max-w-full px-3 py-1.5 rounded-lg border-2 border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
                      <option [ngValue]="null">{{ 'wg.pestanas.equipo.todosPaises' | translate }}</option>
                      @for (p of paises; track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
                    </select>
                    @if (m.billetes) { <span class="text-sm text-gray-600 whitespace-nowrap" [innerHTML]="'wg.pestanas.equipo.tieneBilletes' | translate: { n: miles(m.billetes) }"></span> }
                  </div>
                } @else {
                  <span class="text-sm text-gray-300">—</span>
                }
              </div>
              <!-- Acciones -->
              <div class="pl-[3.25rem] lg:pl-0 flex items-center gap-x-4 lg:justify-end">
                <button type="button" (click)="verTransacciones(m)" class="text-sm font-semibold text-orange-700 hover:underline whitespace-nowrap">{{ 'wg.pestanas.transacciones.ver' | translate }}</button>
                <button type="button" (click)="quitar(m)" class="text-sm font-semibold text-red-700 hover:underline whitespace-nowrap">{{ 'wg.pestanas.equipo.quitar' | translate }}</button>
              </div>
            </li>
          } @empty {
            <li class="px-5 py-8 text-center text-sm text-gray-500">{{ 'wg.pestanas.equipo.sinCoincidencias' | translate }}</li>
          }
        </ul>
      </div>
    }

    <!-- Editar los roles de un colaborador -->
    @if (rolesEditando) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="rolesEditando = null">
        <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-roles">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 id="titulo-roles" class="text-lg font-bold text-gray-800">{{ 'wg.pestanas.equipo.rolesDe' | translate }}</h2>
              <p class="text-sm text-gray-500 truncate">{{ rolesEditando.miembro.nombre }} {{ rolesEditando.miembro.apellido }}</p>
            </div>
            <button type="button" (click)="rolesEditando = null" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.pestanas.comun.cerrar' | translate">✕</button>
          </div>
          <div class="mt-4 grid grid-cols-1 gap-2">
            @for (g of gruposCombinables; track g.rol) {
              <label class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer" [class]="rolesEditando.roles.includes(g.rol) ? 'border-orange-300 bg-orange-50' : 'border-gray-200'">
                <input type="checkbox" [checked]="rolesEditando.roles.includes(g.rol)" (change)="alternarRolEditando(g.rol)" class="w-4 h-4 accent-orange-600">
                <span class="font-semibold text-gray-800">{{ ('wg.pestanas.equipo.roles.' + g.rol) | translate }}</span>
              </label>
            }
          </div>
          <p class="mt-2 text-xs text-gray-500">{{ 'wg.pestanas.equipo.rolesAyuda' | translate }}</p>
          @if (rolesEditando.error) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ rolesEditando.error }}</p> }
          <div class="mt-5 flex flex-col-reverse sm:flex-row gap-2">
            <button type="button" (click)="rolesEditando = null" class="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.pestanas.comun.cancelar' | translate }}</button>
            <button type="button" (click)="guardarRoles()" [disabled]="rolesEditando.guardando || !rolesEditando.roles.length" class="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-50">
              {{ (rolesEditando.guardando ? 'wg.pestanas.comun.guardando' : 'wg.pestanas.comun.guardar') | translate }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (transacciones) {
      <wg-transacciones-equipo [edicionId]="edicion.id" [miembro]="transacciones.miembro" [equipo]="equipo" (cerrar)="transacciones = null" />
    }

    @if (agregando) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="agregando = false">
        <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-agregar">
          <div class="px-6 pt-6 pb-3">
            <div class="flex items-start justify-between">
              <h2 id="titulo-agregar" class="text-xl font-bold text-gray-800">{{ 'wg.pestanas.equipo.tituloAgregar' | translate }}</h2>
              <button type="button" (click)="agregando = false" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.pestanas.comun.cerrar' | translate">✕</button>
            </div>
            <input type="search" [(ngModel)]="busqueda" [placeholder]="'wg.pestanas.equipo.buscar' | translate" [attr.aria-label]="'wg.pestanas.equipo.buscarAria' | translate"
                   class="mt-3 w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" class="chip" [class.activo]="filtroRol === ''" (click)="filtroRol = ''">{{ 'wg.pestanas.comun.todos' | translate }}</button>
              @for (g of grupos; track g.rol) { <button type="button" class="chip" [class.activo]="filtroRol === g.rol" (click)="filtroRol = g.rol">{{ g.titulo | translate }}</button> }
            </div>
          </div>
          <ul class="flex-1 overflow-y-auto px-3 pb-2">
            @for (c of disponibles; track c.id) {
              <li>
                <label class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" [checked]="elegidos.has(c.id)" (change)="alternar(c.id)">
                  <span class="flex-1 min-w-0">
                    <span class="block font-semibold text-gray-800 truncate">{{ c.nombre }} {{ c.apellido }}</span>
                    <span class="block text-xs text-gray-500 truncate">{{ c.email }}</span>
                  </span>
                  <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{{ ('wg.pestanas.equipo.roles.' + c.rol) | translate }}</span>
                </label>
              </li>
            }
            @if (!disponibles.length) {
              <li class="px-3 py-6 text-center text-sm text-gray-500">
                {{ (todos.length ? 'wg.pestanas.equipo.sinCoincidencias' : 'wg.pestanas.equipo.sinColaboradores') | translate }}
                <a routerLink="/private-will-go/colaboradores" class="block mt-2 font-semibold text-orange-700 hover:underline">{{ 'wg.pestanas.equipo.crearColaborador' | translate }}</a>
              </li>
            }
          </ul>
          @if (errorAgregar) { <p class="mx-6 mb-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ errorAgregar }}</p> }
          <div class="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button type="button" (click)="agregando = false" class="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.pestanas.comun.cancelar' | translate }}</button>
            <button type="button" (click)="agregar()" [disabled]="!elegidos.size || trabajando" class="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-50">
              {{ trabajando ? ('wg.pestanas.comun.agregando' | translate) : ('wg.pestanas.equipo.agregarN' | translate: { n: elegidos.size || '' }) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .chip { display: inline-flex; align-items: center; padding: 0.35rem 0.8rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; background: #fff; border: 1px solid #e5e7eb; color: #4b5563; }
    .chip.activo { background: #1e293b; color: #fff; border-color: #1e293b; }
  `],
})
export class TabEquipo implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() cambio = new EventEmitter<void>();
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  readonly miles = (v: unknown) => formatearNumero(v as number);
  readonly grupos: { rol: Rol; titulo: string; color: string }[] = [
    { rol: 'docente', titulo: 'wg.pestanas.equipo.grupos.docente', color: 'bg-teal-600' },
    { rol: 'banco', titulo: 'wg.pestanas.equipo.grupos.banco', color: 'bg-blue-600' },
    { rol: 'cajero', titulo: 'wg.pestanas.equipo.grupos.cajero', color: 'bg-amber-500' },
    { rol: 'administrativo', titulo: 'wg.pestanas.equipo.grupos.administrativo', color: 'bg-slate-700' },
  ];

  equipo: MiembroEquipo[] = [];
  paises: Pais[] = [];
  todos: Funcionario[] = [];
  cargando = true;
  trabajando = false;
  aviso = '';
  avisoError = false;
  agregando = false;
  busqueda = '';
  filtroRol: Rol | '' = '';
  elegidos = new Set<string>();
  errorAgregar = '';

  ngOnInit(): void {
    this.willGo.seccion<Pais>(this.edicion.id, 'paises').subscribe({ next: (p) => (this.paises = p) });
    this.cargar();
  }

  /** Filtro de la lista por rol ('' = todos). */
  filtroLista: Rol | '' = '';

  rolesDe(m: { rol: Rol | null; roles?: Rol[] }): Rol[] {
    return m.roles?.length ? m.roles : m.rol ? [m.rol] : [];
  }

  deRol(rol: Rol): MiembroEquipo[] {
    return this.equipo.filter((m) => this.rolesDe(m).includes(rol));
  }

  /** Búsqueda por nombre o correo dentro del equipo. */
  busquedaLista = '';

  /** La lista, filtrada por rol y por nombre, y ordenada por nombre. */
  get listaEquipo(): MiembroEquipo[] {
    const q = this.busquedaLista.trim().toLowerCase();
    return (this.filtroLista ? this.deRol(this.filtroLista) : this.equipo)
      .filter((m) => !q || `${m.nombre} ${m.apellido} ${m.email}`.toLowerCase().includes(q))
      .slice().sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`));
  }

  /** Roles que se pueden marcar aquí (el administrativo no). */
  get gruposCombinables() {
    return this.grupos.filter((g) => g.rol !== 'administrativo');
  }

  /** Ventana para cambiar los roles de un colaborador (aplica en toda la plataforma, no solo en esta edición). */
  rolesEditando: { miembro: MiembroEquipo; roles: Rol[]; guardando: boolean; error: string } | null = null;

  abrirRoles(m: MiembroEquipo): void {
    this.rolesEditando = { miembro: m, roles: [...this.rolesDe(m)], guardando: false, error: '' };
  }

  alternarRolEditando(r: Rol): void {
    const e = this.rolesEditando;
    if (!e) return;
    e.roles = e.roles.includes(r) ? e.roles.filter((x) => x !== r) : [...e.roles, r];
  }

  guardarRoles(): void {
    const e = this.rolesEditando;
    if (!e || !e.roles.length) return;
    e.guardando = true;
    e.error = '';
    const roles = e.roles as Exclude<Rol, 'administrativo'>[];
    this.willGo.actualizarFuncionario(e.miembro.usuario_id, { rol: roles[0], roles }).subscribe({
      next: (f) => {
        e.miembro.rol = f.rol;
        e.miembro.roles = f.roles ?? roles;
        this.rolesEditando = null;
        this.mostrar(this.t.instant('wg.pestanas.equipo.rolesGuardados', { nombre: e.miembro.nombre }), false);
      },
      error: (err) => { e.guardando = false; e.error = WillGoService.mensajeDeError(err); },
    });
  }

  colorDe(rol: Rol | undefined): string {
    return this.grupos.find((g) => g.rol === rol)?.color ?? 'bg-slate-700';
  }

  etiquetaDe(rol: Rol): string {
    return ({ docente: 'bg-teal-50 text-teal-800 ring-1 ring-teal-200', banco: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200', cajero: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' } as Record<string, string>)[rol] ?? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
  }

  get disponibles(): Funcionario[] {
    const enEquipo = new Set(this.equipo.map((m) => m.usuario_id));
    const q = this.busqueda.trim().toLowerCase();
    return this.todos.filter((c) => !enEquipo.has(c.id) && c.estado === 'active'
      && (!this.filtroRol || (c.roles ?? [c.rol]).includes(this.filtroRol))
      && (!q || `${c.nombre} ${c.apellido} ${c.email}`.toLowerCase().includes(q)));
  }

  cargar(): void {
    this.willGo.equipo(this.edicion.id).subscribe({
      next: (l) => { this.equipo = l; this.cargando = false; },
      error: (e) => { this.cargando = false; this.mostrar(WillGoService.mensajeDeError(e), true); },
    });
  }

  abrirAgregar(): void {
    this.agregando = true;
    this.elegidos.clear();
    this.busqueda = '';
    this.filtroRol = '';
    this.errorAgregar = '';
    this.willGo.funcionarios().subscribe({ next: (l) => (this.todos = l), error: (e) => (this.errorAgregar = WillGoService.mensajeDeError(e)) });
  }

  alternar(id: string): void {
    if (this.elegidos.has(id)) this.elegidos.delete(id); else this.elegidos.add(id);
  }

  agregar(): void {
    this.trabajando = true;
    this.willGo.agregarAlEquipo(this.edicion.id, [...this.elegidos]).subscribe({
      next: (r) => {
        this.trabajando = false;
        this.agregando = false;
        this.mostrar((r.agregados === 1 ? this.t.instant('wg.pestanas.equipo.agregadoUno') : this.t.instant('wg.pestanas.equipo.agregadosN', { n: r.agregados }))
          + (r.agregados ? ' ' + this.t.instant('wg.pestanas.equipo.lesLlegaCorreo') : ''), false);
        this.cargar();
        this.cambio.emit();
      },
      error: (e) => { this.trabajando = false; this.errorAgregar = WillGoService.mensajeDeError(e); },
    });
  }

  asignarPais(m: MiembroEquipo, paisId: string | null): void {
    const anterior = m.pais_id;
    m.pais_id = paisId;
    this.willGo.asignarPaisDocente(m.id, paisId).subscribe({
      next: () => this.mostrar(this.t.instant('wg.pestanas.equipo.docenteDe', {
        nombre: m.nombre,
        pais: this.paises.find((p) => p.id === paisId)?.nombre ?? this.t.instant('wg.pestanas.equipo.todosPaisesMin'),
      }), false),
      error: (e) => { m.pais_id = anterior; this.mostrar(WillGoService.mensajeDeError(e), true); },
    });
  }

  quitar(m: MiembroEquipo): void {
    if (!confirm(this.t.instant('wg.pestanas.equipo.confirmarQuitar', { nombre: `${m.nombre} ${m.apellido}` }))) return;
    this.willGo.quitarDelEquipo(m.id).subscribe({
      next: () => {
        this.equipo = this.equipo.filter((x) => x.id !== m.id);
        this.mostrar(this.t.instant('wg.pestanas.equipo.yaNoEquipo', { nombre: m.nombre }), false);
        this.cambio.emit();
      },
      error: (e) => this.mostrar(WillGoService.mensajeDeError(e), true),
    });
  }

  /** Modal de transacciones: de un colaborador o de todo el equipo (miembro null). */
  transacciones: { miembro: MiembroEquipo | null } | null = null;
  verTransacciones(miembro: MiembroEquipo | null): void {
    this.transacciones = { miembro };
  }

  avisando = false;
  /** Reenvía el correo con la edición, el rol, las fechas y el horario a todo el equipo. */
  avisar(): void {
    if (this.avisando) return;
    this.avisando = true;
    this.willGo.avisarEquipo(this.edicion.id).subscribe({
      next: (r) => { this.avisando = false; this.mostrar(this.t.instant('wg.pestanas.equipo.avisoEnviado', { n: r.enviados, total: r.equipo }), false); },
      error: (e) => { this.avisando = false; this.mostrar(WillGoService.mensajeDeError(e), true); },
    });
  }

  private mostrar(texto: string, esError: boolean): void {
    this.aviso = texto;
    this.avisoError = esError;
    if (!esError) setTimeout(() => { if (this.aviso === texto) this.aviso = ''; }, 4000);
  }
}
