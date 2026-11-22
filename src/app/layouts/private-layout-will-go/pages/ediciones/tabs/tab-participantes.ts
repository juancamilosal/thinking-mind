import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatearNumero } from '../../../numero-miles.directive';
import { Edicion, Pais, Participante, WillGoService } from '../../../../../core/services/will-go.service';

@Component({
  selector: 'app-tab-participantes',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- Acciones -->
    <div class="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
      <p class="text-sm text-gray-500">Los participantes son los estudiantes inscritos en el programa{{ edicion.colegio_nombre ? ' del colegio ' + edicion.colegio_nombre : '' }}. Asigna a cada uno su país.</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" (click)="sincronizar()" [disabled]="trabajando"
                class="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          ⟳ Traer inscritos
        </button>
        <button type="button" (click)="repartir()" [disabled]="trabajando || !sinPais.length || !paises.length"
                class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50">
          Repartir {{ sinPais.length }} sin país en partes iguales
        </button>
      </div>
    </div>

    <!-- Conteo por país -->
    <div class="mt-4 flex flex-wrap gap-2">
      <button type="button" (click)="filtro = ''" class="chip" [class.activo]="filtro === ''">Todos · {{ lista.length }}</button>
      @for (p of paises; track p.id) {
        <button type="button" (click)="filtro = p.id" class="chip" [class.activo]="filtro === p.id">
          <span class="w-2.5 h-2.5 rounded-full" [style.background]="p.color"></span>{{ p.nombre }} · {{ cuantos(p.id) }}
        </button>
      }
      <button type="button" (click)="filtro = 'sin'" class="chip" [class.activo]="filtro === 'sin'" [class.text-amber-800]="sinPais.length">Sin país · {{ sinPais.length }}</button>
    </div>

    <input type="search" [(ngModel)]="busqueda" placeholder="Buscar participante…" aria-label="Buscar por nombre o código"
           class="mt-3 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">

    <!-- Barra de selección -->
    @if (seleccion.size) {
      <div class="sticky top-16 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-lg">
        <span class="text-sm font-semibold mr-2">{{ seleccion.size }} seleccionados</span>
        <span class="text-sm text-slate-300">Asignar a:</span>
        @for (p of paises; track p.id) {
          <button type="button" (click)="asignarSeleccion(p.id)" class="px-3 py-1.5 rounded-lg text-sm font-semibold" [style.background]="p.color">{{ p.nombre }}</button>
        }
        <button type="button" (click)="seleccion.clear()" class="ml-auto text-sm text-slate-300 hover:text-white">Quitar selección</button>
      </div>
    }

    @if (aviso) {
      <p class="mt-3 rounded-xl px-4 py-3 text-sm" [class]="avisoError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'" role="status">{{ aviso }}</p>
    }

    <!-- Lista -->
    <div class="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      @if (cargando) {
        <p class="p-10 text-center text-gray-500">Cargando participantes…</p>
      } @else if (!lista.length) {
        <div class="p-10 text-center">
          <p class="font-semibold text-gray-700">Todavía no hay participantes</p>
          <p class="text-sm text-gray-500 mt-1">Pulsa «Traer inscritos» para cargar a los estudiantes del programa.</p>
        </div>
      } @else {
        <div class="hidden md:grid grid-cols-[2.5rem_1fr_7rem_12rem_6rem_5rem] gap-3 px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
          <label class="flex items-center"><input type="checkbox" [checked]="todosSeleccionados" (change)="seleccionarTodos($any($event.target).checked)" aria-label="Seleccionar todos"></label>
          <span>Estudiante</span><span>Código</span><span>País</span><span class="text-right">Saldo</span><span class="text-center">Presente</span>
        </div>
        <ul class="divide-y divide-gray-100">
          @for (p of filtrados; track p.id) {
            <li class="grid grid-cols-[2.5rem_1fr] md:grid-cols-[2.5rem_1fr_7rem_12rem_6rem_5rem] gap-x-3 gap-y-2 items-center px-4 py-3">
              <label class="flex items-center"><input type="checkbox" [checked]="seleccion.has(p.id)" (change)="alternar(p.id)" [attr.aria-label]="'Seleccionar a ' + p.nombre"></label>
              <div class="min-w-0">
                <p class="font-semibold text-gray-800 truncate">{{ p.nombre }} {{ p.apellido }}</p>
                <p class="text-xs text-gray-500 truncate">{{ p.colegio || 'Sin colegio' }}{{ p.grado ? ' · Grado ' + p.grado : '' }}</p>
              </div>
              <span class="col-start-2 md:col-start-auto font-mono text-sm text-gray-700">{{ p.codigo }}</span>
              <select class="col-start-2 md:col-start-auto px-3 py-2 rounded-lg border-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                      [style.border-color]="colorDe(p.pais_id) || '#fcd34d'" [ngModel]="p.pais_id" (ngModelChange)="asignar([p.id], $event)" [attr.aria-label]="'País de ' + p.nombre">
                <option [ngValue]="null">Sin país</option>
                @for (pa of paises; track pa.id) { <option [ngValue]="pa.id">{{ pa.nombre }}</option> }
              </select>
              <span class="col-start-2 md:col-start-auto md:text-right text-sm font-semibold text-gray-800">{{ miles(p.saldo) }} <span class="text-xs font-normal text-gray-500">{{ monedaDe(p.pais_id) }}</span></span>
              <label class="col-start-2 md:col-start-auto flex md:justify-center items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" [checked]="p.presente" (change)="marcarPresente(p, $any($event.target).checked)">
                <span class="md:hidden">Presente</span>
              </label>
            </li>
          }
        </ul>
        @if (!filtrados.length) { <p class="p-6 text-center text-sm text-gray-500">Nadie coincide con el filtro.</p> }
      }
    </div>
  `,
  styles: [`
    .chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.85rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; background: #fff; border: 1px solid #e5e7eb; color: #4b5563; }
    .chip.activo { background: #1e293b; color: #fff; border-color: #1e293b; }
  `],
})
export class TabParticipantes implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() cambio = new EventEmitter<void>();
  private willGo = inject(WillGoService);

  lista: Participante[] = [];
  paises: Pais[] = [];
  cargando = true;
  trabajando = false;
  busqueda = '';
  filtro = '';
  seleccion = new Set<string>();
  readonly miles = (v: unknown) => formatearNumero(v as number);
  aviso = '';
  avisoError = false;

  ngOnInit(): void {
    this.willGo.seccion<Pais>(this.edicion.id, 'paises').subscribe({ next: (p) => (this.paises = p) });
    this.cargar();
  }

  get sinPais(): Participante[] {
    return this.lista.filter((p) => !p.pais_id);
  }

  get filtrados(): Participante[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.lista.filter((p) =>
      (this.filtro === '' || (this.filtro === 'sin' ? !p.pais_id : p.pais_id === this.filtro)) &&
      (!q || `${p.nombre} ${p.apellido} ${p.codigo}`.toLowerCase().includes(q)));
  }

  get todosSeleccionados(): boolean {
    return this.filtrados.length > 0 && this.filtrados.every((p) => this.seleccion.has(p.id));
  }

  cuantos(paisId: string): number {
    return this.lista.filter((p) => p.pais_id === paisId).length;
  }

  colorDe(paisId: string | null): string | null {
    return this.paises.find((p) => p.id === paisId)?.color ?? null;
  }

  monedaDe(paisId: string | null): string {
    return this.paises.find((p) => p.id === paisId)?.codigo_moneda ?? '';
  }

  cargar(): void {
    this.willGo.participantes(this.edicion.id).subscribe({
      next: (l) => { this.lista = l; this.cargando = false; },
      error: (e) => { this.cargando = false; this.mostrar(WillGoService.mensajeDeError(e), true); },
    });
  }

  alternar(id: string): void {
    if (this.seleccion.has(id)) this.seleccion.delete(id); else this.seleccion.add(id);
  }

  seleccionarTodos(marcar: boolean): void {
    for (const p of this.filtrados) if (marcar) this.seleccion.add(p.id); else this.seleccion.delete(p.id);
  }

  sincronizar(): void {
    this.trabajando = true;
    this.willGo.sincronizarParticipantes(this.edicion.id).subscribe({
      next: (r) => {
        this.trabajando = false;
        this.mostrar(r.nuevos ? `Se agregaron ${r.nuevos} participantes nuevos (${r.inscritos} inscritos en total).` : `Ya estaban todos: ${r.inscritos} inscritos.`, false);
        this.cargar();
        this.cambio.emit();
      },
      error: (e) => { this.trabajando = false; this.mostrar(WillGoService.mensajeDeError(e), true); },
    });
  }

  /** Reparte a los que no tienen país, completando primero los países con menos gente. */
  repartir(): void {
    const conteo = new Map(this.paises.map((p) => [p.id, this.cuantos(p.id)]));
    const asignaciones = new Map<string, string[]>();
    for (const est of [...this.sinPais].sort(() => Math.random() - 0.5)) {
      const [pais] = [...conteo.entries()].sort((a, b) => a[1] - b[1])[0];
      conteo.set(pais, conteo.get(pais)! + 1);
      asignaciones.set(pais, [...(asignaciones.get(pais) ?? []), est.id]);
    }
    this.trabajando = true;
    const pendientes = [...asignaciones.entries()];
    const siguiente = () => {
      const par = pendientes.shift();
      if (!par) {
        this.trabajando = false;
        this.mostrar('Participantes repartidos entre los países.', false);
        this.cargar();
        this.cambio.emit();
        return;
      }
      this.willGo.actualizarParticipantes(par[1], { pais_id: par[0] }).subscribe({
        next: siguiente,
        error: (e) => { this.trabajando = false; this.mostrar(WillGoService.mensajeDeError(e), true); this.cargar(); },
      });
    };
    siguiente();
  }

  asignarSeleccion(paisId: string): void {
    this.asignar([...this.seleccion], paisId);
  }

  asignar(ids: string[], paisId: string | null): void {
    this.willGo.actualizarParticipantes(ids, { pais_id: paisId }).subscribe({
      next: () => {
        for (const p of this.lista) if (ids.includes(p.id)) p.pais_id = paisId;
        this.seleccion.clear();
        this.mostrar(ids.length > 1 ? `${ids.length} participantes asignados.` : '', false);
        this.cambio.emit();
      },
      error: (e) => { this.mostrar(WillGoService.mensajeDeError(e), true); this.cargar(); },
    });
  }

  marcarPresente(p: Participante, presente: boolean): void {
    this.willGo.actualizarParticipantes([p.id], { presente }).subscribe({
      next: () => (p.presente = presente),
      error: (e) => this.mostrar(WillGoService.mensajeDeError(e), true),
    });
  }

  private mostrar(texto: string, esError: boolean): void {
    this.aviso = texto;
    this.avisoError = esError;
    if (texto && !esError) setTimeout(() => { if (this.aviso === texto) this.aviso = ''; }, 4000);
  }
}
