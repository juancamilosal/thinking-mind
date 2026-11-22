import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Edicion, Funcionario, MiembroEquipo, NOMBRE_ROL, Pais, WillGoService } from '../../../../../core/services/will-go.service';
import { formatearNumero } from '../../../numero-miles.directive';

type Rol = NonNullable<MiembroEquipo['rol']>;

@Component({
  selector: 'app-tab-equipo',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <p class="text-sm text-gray-500">Solo los colaboradores de esta lista pueden operar en la edición: entregar billetes, cobrar en la tienda o repartir desde el banco.</p>
      <button type="button" (click)="abrirAgregar()" class="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow hover:brightness-110">
        + Agregar colaboradores
      </button>
    </div>

    @if (aviso) {
      <p class="mt-4 rounded-xl px-4 py-3 text-sm" [class]="avisoError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'" role="status">{{ aviso }}</p>
    }

    @if (cargando) {
      <div class="mt-4 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando equipo…</div>
    } @else if (!equipo.length) {
      <div class="mt-4 bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
        <p class="font-semibold text-gray-700">La edición todavía no tiene equipo</p>
        <p class="text-sm text-gray-500 mt-1">Agrega a los docentes, al banco y a la caja que trabajarán en esta edición.</p>
      </div>
    } @else {
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        @for (g of grupos; track g.rol) {
          @if (deRol(g.rol).length) {
            <section class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 class="font-bold text-gray-800">{{ g.titulo }}</h3>
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{{ deRol(g.rol).length }}</span>
              </div>
              <ul class="divide-y divide-gray-100">
                @for (m of deRol(g.rol); track m.id) {
                  <li class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-white" [class]="g.color">{{ (m.nombre[0] || '') + (m.apellido[0] || '') }}</div>
                      <div class="min-w-0 flex-1">
                        <p class="font-semibold text-gray-800 truncate">{{ m.nombre }} {{ m.apellido }}</p>
                        <p class="text-xs text-gray-500 truncate">{{ m.email }}{{ m.estado !== 'active' ? ' · inactivo' : '' }}</p>
                      </div>
                      <button type="button" (click)="quitar(m)" class="text-sm font-semibold text-red-700 hover:underline whitespace-nowrap">Quitar</button>
                    </div>
                    @if (m.rol === 'docente') {
                      <div class="mt-2 pl-[3.25rem] flex flex-wrap items-center gap-3">
                        <label class="text-xs text-gray-500" [attr.for]="'pais-' + m.id">País</label>
                        <select [id]="'pais-' + m.id" [ngModel]="m.pais_id" (ngModelChange)="asignarPais(m, $event)" class="px-3 py-1.5 rounded-lg border-2 border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
                          <option [ngValue]="null">Todos los países</option>
                          @for (p of paises; track p.id) { <option [ngValue]="p.id">{{ p.nombre }}</option> }
                        </select>
                        @if (m.billetes) { <span class="text-sm text-gray-600">Tiene <b>{{ miles(m.billetes) }}</b> billetes</span> }
                      </div>
                    }
                  </li>
                }
              </ul>
            </section>
          }
        }
      </div>
    }

    @if (agregando) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="agregando = false">
        <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-agregar">
          <div class="px-6 pt-6 pb-3">
            <div class="flex items-start justify-between">
              <h2 id="titulo-agregar" class="text-xl font-bold text-gray-800">Agregar colaboradores</h2>
              <button type="button" (click)="agregando = false" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
            </div>
            <input type="search" [(ngModel)]="busqueda" placeholder="Buscar por nombre o correo…" aria-label="Buscar colaborador"
                   class="mt-3 w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" class="chip" [class.activo]="filtroRol === ''" (click)="filtroRol = ''">Todos</button>
              @for (g of grupos; track g.rol) { <button type="button" class="chip" [class.activo]="filtroRol === g.rol" (click)="filtroRol = g.rol">{{ g.titulo }}</button> }
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
                  <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{{ nombreRol[c.rol] }}</span>
                </label>
              </li>
            }
            @if (!disponibles.length) {
              <li class="px-3 py-6 text-center text-sm text-gray-500">
                {{ todos.length ? 'No hay más colaboradores que coincidan.' : 'Todavía no hay colaboradores creados.' }}
                <a routerLink="/private-will-go/colaboradores" class="block mt-2 font-semibold text-orange-700 hover:underline">Crear un colaborador →</a>
              </li>
            }
          </ul>
          @if (errorAgregar) { <p class="mx-6 mb-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ errorAgregar }}</p> }
          <div class="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button type="button" (click)="agregando = false" class="flex-1 py-3 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="button" (click)="agregar()" [disabled]="!elegidos.size || trabajando" class="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-50">
              {{ trabajando ? 'Agregando…' : 'Agregar ' + (elegidos.size || '') }}
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
  readonly nombreRol = NOMBRE_ROL;
  readonly miles = (v: unknown) => formatearNumero(v as number);
  readonly grupos: { rol: Rol; titulo: string; color: string }[] = [
    { rol: 'docente', titulo: 'Docentes', color: 'bg-teal-600' },
    { rol: 'banco', titulo: 'Banco', color: 'bg-blue-600' },
    { rol: 'cajero', titulo: 'Caja', color: 'bg-amber-500' },
    { rol: 'administrativo', titulo: 'Administrativos', color: 'bg-slate-700' },
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

  deRol(rol: Rol): MiembroEquipo[] {
    return this.equipo.filter((m) => m.rol === rol);
  }

  get disponibles(): Funcionario[] {
    const enEquipo = new Set(this.equipo.map((m) => m.usuario_id));
    const q = this.busqueda.trim().toLowerCase();
    return this.todos.filter((c) => !enEquipo.has(c.id) && c.estado === 'active'
      && (!this.filtroRol || c.rol === this.filtroRol)
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
        this.mostrar(r.agregados === 1 ? 'Se agregó 1 colaborador al equipo.' : `Se agregaron ${r.agregados} colaboradores al equipo.`, false);
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
      next: () => this.mostrar(`${m.nombre} quedó como docente de ${this.paises.find((p) => p.id === paisId)?.nombre ?? 'todos los países'}.`, false),
      error: (e) => { m.pais_id = anterior; this.mostrar(WillGoService.mensajeDeError(e), true); },
    });
  }

  quitar(m: MiembroEquipo): void {
    if (!confirm(`¿Quitar a ${m.nombre} ${m.apellido} del equipo de esta edición?`)) return;
    this.willGo.quitarDelEquipo(m.id).subscribe({
      next: () => {
        this.equipo = this.equipo.filter((x) => x.id !== m.id);
        this.mostrar(`${m.nombre} ya no hace parte del equipo.`, false);
        this.cambio.emit();
      },
      error: (e) => this.mostrar(WillGoService.mensajeDeError(e), true),
    });
  }

  private mostrar(texto: string, esError: boolean): void {
    this.aviso = texto;
    this.avisoError = esError;
    if (!esError) setTimeout(() => { if (this.aviso === texto) this.aviso = ''; }, 4000);
  }
}
