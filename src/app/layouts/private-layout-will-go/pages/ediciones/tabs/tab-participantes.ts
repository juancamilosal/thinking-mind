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
      <p class="text-sm text-gray-500">Los participantes son los estudiantes inscritos en el programa{{ edicion.colegio_nombre ? ' del colegio ' + edicion.colegio_nombre : '' }}. Quien se inscribe y paga aparece aquí solo. Asigna a cada uno su país.</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" (click)="repartir()" [disabled]="trabajando || !sinPais.length || !paises.length"
                class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50">
          Repartir {{ sinPais.length }} sin país en partes iguales
        </button>
      </div>
    </div>

    <!-- Conteo por país -->
    <div class="mt-4 flex flex-wrap gap-2">
      <button type="button" (click)="filtro = ''" class="chip" [class.activo]="filtro === ''">Todos · {{ activos.length }}</button>
      @for (p of paises; track p.id) {
        <button type="button" (click)="filtro = p.id" class="chip" [class.activo]="filtro === p.id">
          <span class="w-2.5 h-2.5 rounded-full" [style.background]="p.color"></span>{{ p.nombre }} · {{ cuantos(p.id) }}
        </button>
      }
      <button type="button" (click)="filtro = 'sin'" class="chip" [class.activo]="filtro === 'sin'" [class.text-amber-800]="sinPais.length">Sin país · {{ sinPais.length }}</button>
      @if (retirados.length) {
        <button type="button" (click)="filtro = 'retirados'" class="chip" [class.activo]="filtro === 'retirados'">Retirados · {{ retirados.length }}</button>
      }
      @if (conReembolso.length) {
        <button type="button" (click)="filtro = 'reembolso'" class="chip !border-red-200 !text-red-700" [class.activo]="filtro === 'reembolso'">⚠ Pidieron reembolso · {{ conReembolso.length }}</button>
      }
    </div>

    <input type="search" [(ngModel)]="busqueda" placeholder="Buscar participante…" aria-label="Buscar por nombre o código"
           class="mt-3 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">

    <!-- Barra de selección -->
    @if (seleccion.size) {
      <div class="sticky top-16 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-lg">
        <span class="text-sm font-semibold mr-2">{{ seleccion.size }} seleccionados</span>
        @if (filtro === 'retirados') {
          <button type="button" (click)="reintegrar(seleccionLista)" class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600">Reintegrar</button>
        } @else {
          <span class="text-sm text-slate-300">Asignar a:</span>
          @for (p of paises; track p.id) {
            <button type="button" (click)="asignarSeleccion(p.id)" class="px-3 py-1.5 rounded-lg text-sm font-semibold" [style.background]="p.color">{{ p.nombre }}</button>
          }
          <button type="button" (click)="pedirRetiro(seleccionLista)" class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600">Retirar</button>
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
      } @else if (!activos.length && filtro !== 'retirados') {
        <div class="p-10 text-center">
          <p class="font-semibold text-gray-700">Todavía no hay inscritos</p>
          <p class="text-sm text-gray-500 mt-1">Cuando un estudiante se inscriba en el programa{{ edicion.colegio_nombre ? ' desde ' + edicion.colegio_nombre : '' }}, aparecerá aquí automáticamente.</p>
        </div>
      } @else {
        <div class="hidden md:grid grid-cols-[2.5rem_1fr_7rem_12rem_6rem_5rem_6rem] gap-3 px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
          <label class="flex items-center"><input type="checkbox" [checked]="todosSeleccionados" (change)="seleccionarTodos($any($event.target).checked)" aria-label="Seleccionar todos"></label>
          <span>Estudiante</span><span title="Código corto del estudiante para buscarlo o escanearlo (QR) en la caja y al entregar billetes">Código ⓘ</span><span>País</span><span class="text-right">Saldo</span><span class="text-center">Presente</span><span></span>
        </div>
        <ul class="divide-y divide-gray-100">
          @for (p of filtrados; track p.id) {
            <li class="grid grid-cols-[2.5rem_1fr] md:grid-cols-[2.5rem_1fr_7rem_12rem_6rem_5rem_6rem] gap-x-3 gap-y-2 items-center px-4 py-3" [class.bg-gray-50]="p.retirado">
              <label class="flex items-center"><input type="checkbox" [checked]="seleccion.has(p.id)" (change)="alternar(p.id)" [attr.aria-label]="'Seleccionar a ' + p.nombre"></label>
              <div class="min-w-0">
                <p class="font-semibold truncate" [class]="p.retirado ? 'text-gray-500 line-through' : 'text-gray-800'">{{ p.nombre }} {{ p.apellido }}</p>
                @if (p.retirado) {
                  <p class="text-xs text-red-700 truncate">Retirado: {{ p.motivo_retiro }}</p>
                } @else if (p.pidio_reembolso) {
                  <p class="text-xs font-semibold text-red-700">⚠ Pidió reembolso</p>
                } @else if (deOtroColegio(p)) {
                  <p class="text-xs font-semibold text-red-700" title="Ya tiene movimientos, por eso no salió solo. Retíralo para devolver sus billetes al banco.">⚠ De otro colegio ({{ p.colegio || 'sin colegio' }})</p>
                }
                <!-- El colegio solo se muestra si la edición reúne varios colegios -->
                @if (!edicion.colegio_id || p.grado) {
                  <p class="text-xs text-gray-500 truncate">{{ edicion.colegio_id ? '' : (p.colegio || 'Sin colegio') }}{{ !edicion.colegio_id && p.grado ? ' · ' : '' }}{{ p.grado ? 'Grado ' + p.grado : '' }}</p>
                }
              </div>
              <span class="col-start-2 md:col-start-auto font-mono text-sm text-gray-700">{{ p.codigo }}</span>
              <select class="col-start-2 md:col-start-auto px-3 py-2 rounded-lg border-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                      [style.border-color]="colorDe(p.pais_id) || '#fcd34d'" [disabled]="!!p.retirado" [ngModel]="p.pais_id" (ngModelChange)="asignar([p.id], $event)" [attr.aria-label]="'País de ' + p.nombre">
                <option [ngValue]="null">Sin país</option>
                @for (pa of paises; track pa.id) { <option [ngValue]="pa.id">{{ pa.nombre }}</option> }
              </select>
              <span class="col-start-2 md:col-start-auto md:text-right text-sm font-semibold text-gray-800">{{ miles(p.saldo) }} <span class="text-xs font-normal text-gray-500">{{ monedaDe(p.pais_id) }}</span></span>
              <label class="col-start-2 md:col-start-auto flex md:justify-center items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" [checked]="p.presente" [disabled]="!!p.retirado" (change)="marcarPresente(p, $any($event.target).checked)">
                <span class="md:hidden">Presente</span>
              </label>
              <div class="col-start-2 md:col-start-auto md:text-right">
                @if (p.retirado) {
                  <button type="button" (click)="reintegrar([p])" class="text-sm font-semibold text-emerald-700 hover:underline">Reintegrar</button>
                } @else {
                  <button type="button" (click)="pedirRetiro([p])" class="text-sm font-semibold text-red-700 hover:underline">Retirar</button>
                }
              </div>
            </li>
          }
        </ul>
        @if (!filtrados.length) { <p class="p-6 text-center text-sm text-gray-500">Nadie coincide con el filtro.</p> }
      }
    </div>

    @if (retiro) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="retiro = null">
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true" aria-labelledby="titulo-retiro">
          <h2 id="titulo-retiro" class="text-lg font-bold text-gray-800">
            {{ retiro.length === 1 ? '¿Retirar a ' + retiro[0].nombre + ' ' + retiro[0].apellido + '?' : '¿Retirar a ' + retiro.length + ' estudiantes?' }}
          </h2>
          <p class="text-sm text-gray-600 mt-2">Sale de la edición: no recibe billetes, no compra y no cuenta para el tipo de cambio. Su inscripción y sus pagos en la plataforma no cambian, y se puede reintegrar después.</p>
          @if (billetesARetirar > 0) {
            <p class="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3 mt-3">Sus {{ miles(billetesARetirar) }} billetes vuelven al banco de su país.</p>
          }
          <p class="text-sm font-semibold text-gray-700 mt-4 mb-2">Motivo</p>
          <div class="space-y-2">
            @for (m of motivos; track m) {
              <label class="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name="motivo" [value]="m" [(ngModel)]="motivo"> {{ m }}</label>
            }
          </div>
          @if (motivo === 'Otro') {
            <input [(ngModel)]="motivoOtro" placeholder="Escribe el motivo" aria-label="Otro motivo"
                   class="mt-2 w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300">
          }
          @if (errorRetiro) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ errorRetiro }}</p> }
          <div class="flex gap-3 mt-6">
            <button type="button" (click)="retiro = null" class="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="button" (click)="confirmarRetiro()" [disabled]="trabajando || (motivo === 'Otro' && !motivoOtro.trim())"
                    class="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
              {{ trabajando ? 'Retirando…' : 'Retirar' }}
            </button>
          </div>
        </div>
      </div>
    }
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

  readonly motivos = ['No asistirá', 'Reembolso', 'Otro'];
  retiro: Participante[] | null = null;
  motivo = 'No asistirá';
  motivoOtro = '';
  errorRetiro = '';

  /** Los retirados no cuentan en ningún conteo ni lista, salvo en su propio filtro. */
  get activos(): Participante[] {
    return this.lista.filter((p) => !p.retirado);
  }

  get retirados(): Participante[] {
    return this.lista.filter((p) => p.retirado);
  }

  get conReembolso(): Participante[] {
    return this.activos.filter((p) => p.pidio_reembolso);
  }

  /** Quedó de otro colegio porque ya tenía historial (los demás salen solos al cambiar el colegio). */
  deOtroColegio(p: Participante): boolean {
    return !!this.edicion.colegio_id && p.colegio_id !== this.edicion.colegio_id;
  }

  get seleccionLista(): Participante[] {
    return this.lista.filter((p) => this.seleccion.has(p.id));
  }

  get billetesARetirar(): number {
    return (this.retiro ?? []).reduce((t, p) => t + (p.saldo || 0), 0);
  }

  get sinPais(): Participante[] {
    return this.activos.filter((p) => !p.pais_id);
  }

  get filtrados(): Participante[] {
    const q = this.busqueda.trim().toLowerCase();
    const base = this.filtro === 'retirados' ? this.retirados : this.filtro === 'reembolso' ? this.conReembolso : this.activos;
    return base.filter((p) =>
      (['', 'retirados', 'reembolso'].includes(this.filtro) || (this.filtro === 'sin' ? !p.pais_id : p.pais_id === this.filtro)) &&
      (!q || `${p.nombre} ${p.apellido} ${p.codigo}`.toLowerCase().includes(q)));
  }

  get todosSeleccionados(): boolean {
    return this.filtrados.length > 0 && this.filtrados.every((p) => this.seleccion.has(p.id));
  }

  cuantos(paisId: string): number {
    return this.activos.filter((p) => p.pais_id === paisId).length;
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
    let bienvenidas = 0;
    const siguiente = (r?: { bienvenidas: number }) => {
      bienvenidas += r?.bienvenidas ?? 0;
      const par = pendientes.shift();
      if (!par) {
        this.trabajando = false;
        this.mostrar('Participantes repartidos entre los países.' + (bienvenidas ? ` ${bienvenidas} recibieron su bienvenida.` : ''), false);
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

  pedirRetiro(lista: Participante[]): void {
    this.retiro = lista.filter((p) => !p.retirado);
    this.motivo = lista.some((p) => p.pidio_reembolso) ? 'Reembolso' : 'No asistirá';
    this.motivoOtro = '';
    this.errorRetiro = '';
  }

  confirmarRetiro(): void {
    if (!this.retiro?.length) return;
    const motivo = this.motivo === 'Otro' ? this.motivoOtro.trim() : this.motivo;
    this.trabajando = true;
    this.willGo.retirarParticipantes(this.retiro.map((p) => p.id), motivo).subscribe({
      next: (r) => {
        this.trabajando = false;
        this.retiro = null;
        this.seleccion.clear();
        this.mostrar((r.retirados === 1 ? 'Estudiante retirado.' : `${r.retirados} estudiantes retirados.`)
          + (r.billetes_devueltos ? ` ${formatearNumero(r.billetes_devueltos)} billetes volvieron al banco.` : ''), false);
        this.cargar();
        this.cambio.emit();
      },
      error: (e) => { this.trabajando = false; this.errorRetiro = WillGoService.mensajeDeError(e); },
    });
  }

  reintegrar(lista: Participante[]): void {
    this.willGo.reintegrarParticipantes(lista.map((p) => p.id)).subscribe({
      next: (r) => {
        this.seleccion.clear();
        this.mostrar(r.reintegrados === 1 ? 'Estudiante reintegrado a la edición.' : `${r.reintegrados} estudiantes reintegrados.`, false);
        if (!this.lista.some((p) => p.retirado && !lista.includes(p))) this.filtro = '';
        this.cargar();
        this.cambio.emit();
      },
      error: (e) => this.mostrar(WillGoService.mensajeDeError(e), true),
    });
  }

  asignarSeleccion(paisId: string): void {
    this.asignar([...this.seleccion], paisId);
  }

  asignar(ids: string[], paisId: string | null): void {
    this.willGo.actualizarParticipantes(ids, { pais_id: paisId }).subscribe({
      next: (r) => {
        for (const p of this.lista) if (ids.includes(p.id)) p.pais_id = paisId;
        this.seleccion.clear();
        const asignados = ids.length > 1 ? `${ids.length} participantes asignados.` : 'País asignado.';
        const bienvenida = r.bienvenidas ? ` ${r.bienvenidas === 1 ? 'Recibió' : r.bienvenidas + ' recibieron'} sus ${this.edicion.investment_bill} billetes de bienvenida.` : '';
        this.mostrar(asignados + bienvenida, false);
        if (r.bienvenidas) this.cargar(); // para ver el saldo nuevo
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
