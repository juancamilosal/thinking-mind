import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { formatearNumero } from '../../../numero-miles.directive';
import { Edicion, Pais, Participante, WillGoService } from '../../../../../core/services/will-go.service';

@Component({
  selector: 'app-tab-participantes',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <!-- Acciones -->
    <div class="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
      <p class="text-sm text-gray-500">{{ 'wg.pestanas.participantes.intro' | translate }}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" (click)="repartir()" [disabled]="trabajando || !sinPais.length || !paises.length"
                class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50">
          {{ 'wg.pestanas.participantes.repartir' | translate: { n: sinPais.length } }}
        </button>
      </div>
    </div>

    <!-- Conteo por país -->
    <div class="mt-4 flex flex-wrap gap-2">
      <button type="button" (click)="filtro = ''" class="chip" [class.activo]="filtro === ''">{{ 'wg.pestanas.comun.todos' | translate }} · {{ activos.length }}</button>
      @for (p of paises; track p.id) {
        <button type="button" (click)="filtro = p.id" class="chip" [class.activo]="filtro === p.id">
          <span class="w-2.5 h-2.5 rounded-full" [style.background]="p.color"></span>{{ p.nombre }} · {{ cuantos(p.id) }}
        </button>
      }
      <button type="button" (click)="filtro = 'sin'" class="chip" [class.activo]="filtro === 'sin'" [class.text-amber-800]="sinPais.length">{{ 'wg.pestanas.participantes.sinPais' | translate }} · {{ sinPais.length }}</button>
      @if (retirados.length) {
        <button type="button" (click)="filtro = 'retirados'" class="chip" [class.activo]="filtro === 'retirados'">{{ 'wg.pestanas.participantes.retirados' | translate }} · {{ retirados.length }}</button>
      }
      @if (conReembolso.length) {
        <button type="button" (click)="filtro = 'reembolso'" class="chip !border-red-200 !text-red-700" [class.activo]="filtro === 'reembolso'">{{ 'wg.pestanas.participantes.pidieronReembolso' | translate }} · {{ conReembolso.length }}</button>
      }
    </div>

    <!-- Buscador y filtro por grado (agrupa por nivel: Kinder, Transición, 1°, 2°…) -->
    <div class="mt-3 flex flex-col sm:flex-row gap-2">
      <input type="search" [(ngModel)]="busqueda" [placeholder]="'wg.pestanas.participantes.buscar' | translate" [attr.aria-label]="'wg.pestanas.participantes.buscarAria' | translate"
             class="flex-1 min-w-0 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
      <div class="grid grid-cols-2 gap-2 sm:flex">
        <select [(ngModel)]="filtroGrado" (ngModelChange)="filtroGrupo = ''; seleccion.clear()" [attr.aria-label]="'wg.pestanas.participantes.filtrarGrado' | translate"
                class="min-w-0 sm:w-44 px-4 py-3 bg-white border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                [class]="filtroGrado ? 'border-orange-300 text-gray-900 font-semibold' : 'border-gray-200 text-gray-600'">
          <option value="">{{ 'wg.pestanas.participantes.todosGrados' | translate }}</option>
          @for (g of grados; track g) { <option [value]="g">{{ nombreNivel(g) }}</option> }
        </select>
        <select [(ngModel)]="filtroGrupo" (ngModelChange)="seleccion.clear()" [disabled]="!filtroGrado" [attr.aria-label]="'wg.pestanas.participantes.filtrarGrupo' | translate"
                class="min-w-0 sm:w-44 px-4 py-3 bg-white border-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50 disabled:bg-gray-50"
                [class]="filtroGrupo ? 'border-orange-300 text-gray-900 font-semibold' : 'border-gray-200 text-gray-600'">
          <option value="">{{ 'wg.pestanas.participantes.todosGrupos' | translate }}</option>
          @for (g of grupos; track g) { <option [value]="g">{{ 'wg.pestanas.participantes.grupo' | translate }} {{ g }}</option> }
        </select>
      </div>
    </div>

    <!-- Barra de selección -->
    @if (seleccion.size) {
      <div class="sticky top-16 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-lg">
        <span class="text-sm font-semibold mr-2">{{ 'wg.pestanas.participantes.seleccionados' | translate: { n: seleccion.size } }}</span>
        @if (filtro === 'retirados') {
          <button type="button" (click)="reintegrar(seleccionLista)" class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600">{{ 'wg.pestanas.participantes.reintegrar' | translate }}</button>
        } @else {
          <span class="text-sm text-slate-300">{{ 'wg.pestanas.participantes.asignarA' | translate }}</span>
          @for (p of paises; track p.id) {
            <button type="button" (click)="asignarSeleccion(p.id)" class="px-3 py-1.5 rounded-lg text-sm font-semibold" [style.background]="p.color">{{ p.nombre }}</button>
          }
          <button type="button" (click)="pedirRetiro(seleccionLista)" class="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600">{{ 'wg.pestanas.participantes.retirar' | translate }}</button>
        }
        <button type="button" (click)="seleccion.clear()" class="ml-auto text-sm text-slate-300 hover:text-white">{{ 'wg.pestanas.participantes.quitarSeleccion' | translate }}</button>
      </div>
    }

    @if (aviso) {
      <p class="mt-3 rounded-xl px-4 py-3 text-sm" [class]="avisoError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'" role="status">{{ aviso }}</p>
    }

    <!-- Lista -->
    <div class="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      @if (cargando) {
        <p class="p-10 text-center text-gray-500">{{ 'wg.pestanas.participantes.cargando' | translate }}</p>
      } @else if (!activos.length && filtro !== 'retirados') {
        <div class="p-10 text-center">
          <p class="font-semibold text-gray-700">{{ 'wg.pestanas.participantes.sinInscritos' | translate }}</p>
          <p class="text-sm text-gray-500 mt-1">{{ edicion.colegio_nombre ? ('wg.pestanas.participantes.sinInscritosAyudaColegio' | translate: { colegio: edicion.colegio_nombre }) : ('wg.pestanas.participantes.sinInscritosAyuda' | translate) }}</p>
        </div>
      } @else {
        <div class="hidden xl:grid grid-cols-[2.5rem_1fr_7rem_12rem_6rem_5rem_6rem] gap-3 px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
          <label class="flex items-center"><input type="checkbox" [checked]="todosSeleccionados" (change)="seleccionarTodos($any($event.target).checked)" [attr.aria-label]="'wg.pestanas.participantes.seleccionarTodos' | translate"></label>
          <span>{{ 'wg.pestanas.participantes.estudiante' | translate }}</span><span [title]="'wg.pestanas.participantes.codigoAyuda' | translate">{{ 'wg.pestanas.participantes.codigo' | translate }} ⓘ</span><span>{{ 'wg.pestanas.comun.pais' | translate }}</span><span class="text-right">{{ 'wg.pestanas.participantes.saldo' | translate }}</span><span class="text-center">{{ 'wg.pestanas.participantes.presente' | translate }}</span><span></span>
        </div>
        <ul class="divide-y divide-gray-100">
          @for (p of filtrados; track p.id) {
            <li class="px-4 py-4 xl:py-3 xl:grid xl:grid-cols-[2.5rem_1fr_7rem_12rem_6rem_5rem_6rem] xl:gap-x-3 xl:items-center" [class.bg-gray-50]="p.retirado">
              <!-- Celular: nombre y código arriba, país a lo ancho, y abajo saldo, presente y retirar -->
              <div class="xl:hidden space-y-3">
                <div class="flex items-start gap-3">
                  <input type="checkbox" class="mt-1 w-4 h-4 shrink-0" [checked]="seleccion.has(p.id)" (change)="alternar(p.id)" [attr.aria-label]="'wg.pestanas.participantes.seleccionarA' | translate: { nombre: p.nombre }">
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold leading-snug" [class]="p.retirado ? 'text-gray-500 line-through' : 'text-gray-800'">{{ p.nombre }} {{ p.apellido }}</p>
                    <p class="text-xs text-gray-500">
                      @if (p.grado) { {{ 'wg.pestanas.participantes.grado' | translate: { n: p.grado } }} · }<span class="font-mono">{{ p.codigo }}</span>
                    </p>
                    @if (p.retirado) {
                      <p class="text-xs text-red-700">{{ 'wg.pestanas.participantes.retiradoMotivo' | translate: { motivo: p.motivo_retiro } }}</p>
                    } @else if (p.pidio_reembolso) {
                      <p class="text-xs font-semibold text-red-700">{{ 'wg.pestanas.participantes.pidioReembolso' | translate }}</p>
                    } @else if (!p.corresponde) {
                      <p class="text-xs font-semibold text-red-700">{{ 'wg.pestanas.participantes.noCorresponde' | translate }}</p>
                    }
                  </div>
                  <span class="shrink-0 text-sm font-bold text-gray-800 whitespace-nowrap">{{ miles(p.saldo) }} <span class="text-xs font-normal text-gray-500">{{ monedaDe(p.pais_id) }}</span></span>
                </div>
                <select class="w-full px-3 py-2.5 rounded-xl border-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                        [style.border-color]="colorDe(p.pais_id) || '#fcd34d'" [disabled]="!!p.retirado" [ngModel]="p.pais_id" (ngModelChange)="asignar([p.id], $event)" [attr.aria-label]="'wg.pestanas.participantes.paisDe' | translate: { nombre: p.nombre }">
                  <option [ngValue]="null">{{ 'wg.pestanas.participantes.sinPais' | translate }}</option>
                  @for (pa of paises; track pa.id) { <option [ngValue]="pa.id">{{ pa.nombre }}</option> }
                </select>
                <div class="flex items-center justify-between gap-3">
                  <label class="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" class="w-4 h-4" [checked]="p.presente" [disabled]="!!p.retirado" (change)="marcarPresente(p, $any($event.target).checked)">
                    {{ 'wg.pestanas.participantes.presente' | translate }}
                  </label>
                  @if (p.retirado) {
                    <button type="button" (click)="reintegrar([p])" class="px-3 py-1.5 rounded-lg text-sm font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50">{{ 'wg.pestanas.participantes.reintegrar' | translate }}</button>
                  } @else {
                    <button type="button" (click)="pedirRetiro([p])" class="px-3 py-1.5 rounded-lg text-sm font-semibold text-red-700 border border-red-200 hover:bg-red-50">{{ 'wg.pestanas.participantes.retirar' | translate }}</button>
                  }
                </div>
              </div>
              <!-- Computador: una fila de tabla -->
              <div class="hidden xl:contents">
              <label class="flex items-center"><input type="checkbox" [checked]="seleccion.has(p.id)" (change)="alternar(p.id)" [attr.aria-label]="'wg.pestanas.participantes.seleccionarA' | translate: { nombre: p.nombre }"></label>
              <div class="min-w-0">
                <p class="font-semibold truncate" [class]="p.retirado ? 'text-gray-500 line-through' : 'text-gray-800'">{{ p.nombre }} {{ p.apellido }}</p>
                @if (p.retirado) {
                  <p class="text-xs text-red-700 truncate">{{ 'wg.pestanas.participantes.retiradoMotivo' | translate: { motivo: p.motivo_retiro } }}</p>
                } @else if (p.pidio_reembolso) {
                  <p class="text-xs font-semibold text-red-700">{{ 'wg.pestanas.participantes.pidioReembolso' | translate }}</p>
                } @else if (!p.corresponde) {
                  <p class="text-xs font-semibold text-red-700" [title]="'wg.pestanas.participantes.noCorrespondeAyuda' | translate">{{ 'wg.pestanas.participantes.noCorresponde' | translate }}{{ p.colegio_id !== edicion.colegio_id ? ' ' + ('wg.pestanas.participantes.esDe' | translate: { colegio: p.colegio || ('wg.pestanas.participantes.otroColegio' | translate) }) : ' ' + ('wg.pestanas.participantes.noInscrito' | translate: { edicion: edicion.edicion_programa }) }}</p>
                }
                <!-- El colegio solo se muestra si la edición reúne varios colegios -->
                @if (!edicion.colegio_id || p.grado) {
                  <p class="text-xs text-gray-500 truncate">{{ edicion.colegio_id ? '' : (p.colegio || ('wg.pestanas.participantes.sinColegio' | translate)) }}{{ !edicion.colegio_id && p.grado ? ' · ' : '' }}{{ p.grado ? ('wg.pestanas.participantes.grado' | translate: { n: p.grado }) : '' }}</p>
                }
              </div>
              <span class="col-start-2 xl:col-start-auto font-mono text-sm text-gray-700">{{ p.codigo }}</span>
              <select class="col-start-2 xl:col-start-auto px-3 py-2 rounded-lg border-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                      [style.border-color]="colorDe(p.pais_id) || '#fcd34d'" [disabled]="!!p.retirado" [ngModel]="p.pais_id" (ngModelChange)="asignar([p.id], $event)" [attr.aria-label]="'wg.pestanas.participantes.paisDe' | translate: { nombre: p.nombre }">
                <option [ngValue]="null">{{ 'wg.pestanas.participantes.sinPais' | translate }}</option>
                @for (pa of paises; track pa.id) { <option [ngValue]="pa.id">{{ pa.nombre }}</option> }
              </select>
              <span class="col-start-2 xl:col-start-auto xl:text-right text-sm font-semibold text-gray-800">{{ miles(p.saldo) }} <span class="text-xs font-normal text-gray-500">{{ monedaDe(p.pais_id) }}</span></span>
              <label class="col-start-2 xl:col-start-auto flex xl:justify-center items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" [checked]="p.presente" [disabled]="!!p.retirado" (change)="marcarPresente(p, $any($event.target).checked)">
                <span class="xl:hidden">{{ 'wg.pestanas.participantes.presente' | translate }}</span>
              </label>
              <div class="col-start-2 xl:col-start-auto xl:text-right">
                @if (p.retirado) {
                  <button type="button" (click)="reintegrar([p])" class="text-sm font-semibold text-emerald-700 hover:underline">{{ 'wg.pestanas.participantes.reintegrar' | translate }}</button>
                } @else {
                  <button type="button" (click)="pedirRetiro([p])" class="text-sm font-semibold text-red-700 hover:underline">{{ 'wg.pestanas.participantes.retirar' | translate }}</button>
                }
              </div>
              </div>
            </li>
          }
        </ul>
        @if (!filtrados.length) { <p class="p-6 text-center text-sm text-gray-500">{{ 'wg.pestanas.participantes.nadieCoincide' | translate }}</p> }
      }
    </div>

    @if (retiro) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="retiro = null">
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true" aria-labelledby="titulo-retiro">
          <h2 id="titulo-retiro" class="text-lg font-bold text-gray-800">
            {{ retiro.length === 1 ? ('wg.pestanas.participantes.confirmarUno' | translate: { nombre: retiro[0].nombre + ' ' + retiro[0].apellido }) : ('wg.pestanas.participantes.confirmarVarios' | translate: { n: retiro.length }) }}
          </h2>
          <p class="text-sm text-gray-600 mt-2">{{ 'wg.pestanas.participantes.retiroExplica' | translate }}</p>
          @if (billetesARetirar > 0) {
            <p class="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3 mt-3">{{ 'wg.pestanas.participantes.billetesVuelven' | translate: { n: miles(billetesARetirar) } }}</p>
          }
          <p class="text-sm font-semibold text-gray-700 mt-4 mb-2">{{ 'wg.pestanas.participantes.motivo' | translate }}</p>
          <div class="space-y-2">
            @for (m of motivos; track m) {
              <label class="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name="motivo" [value]="m" [(ngModel)]="motivo"> {{ claveMotivo[m] | translate }}</label>
            }
          </div>
          @if (motivo === 'Otro') {
            <input [(ngModel)]="motivoOtro" [placeholder]="'wg.pestanas.participantes.escribeMotivo' | translate" [attr.aria-label]="'wg.pestanas.participantes.otroMotivo' | translate"
                   class="mt-2 w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300">
          }
          @if (errorRetiro) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ errorRetiro }}</p> }
          <div class="flex gap-3 mt-6">
            <button type="button" (click)="retiro = null" class="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.pestanas.comun.cancelar' | translate }}</button>
            <button type="button" (click)="confirmarRetiro()" [disabled]="trabajando || (motivo === 'Otro' && !motivoOtro.trim())"
                    class="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
              {{ (trabajando ? 'wg.pestanas.participantes.retirando' : 'wg.pestanas.participantes.retirar') | translate }}
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
  private t = inject(TranslateService);

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

  /** El motivo se guarda en español (dato del servidor); en pantalla se muestra traducido. */
  readonly motivos = ['No asistirá', 'Reembolso', 'Otro'];
  readonly claveMotivo: Record<string, string> = {
    'No asistirá': 'wg.pestanas.participantes.motivos.noAsistira',
    Reembolso: 'wg.pestanas.participantes.motivos.reembolso',
    Otro: 'wg.pestanas.participantes.motivos.otro',
  };
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
      (!q || `${p.nombre} ${p.apellido} ${p.codigo}`.toLowerCase().includes(q)) &&
      (!this.filtroGrado || this.nivelDe(p.grado) === this.filtroGrado) &&
      (!this.filtroGrupo || this.grupoDe(p.grado) === this.filtroGrupo));
  }

  /** Filtro por grado: se agrupa por el nivel (la primera palabra del grado: «2 03» → 2, «TRANSICIÓN 01» → TRANSICIÓN). */
  filtroGrado = '';
  nivelDe(grado: string | null | undefined): string {
    return (grado ?? '').trim().split(/\s+/)[0]?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() || '—';
  }
  /** Grupo: lo que va después del nivel («2 03» → 03). */
  filtroGrupo = '';
  grupoDe(grado: string | null | undefined): string {
    return (grado ?? '').trim().split(/\s+/).slice(1).join(' ').toUpperCase();
  }
  private get baseGrado(): Participante[] {
    return this.filtro === 'retirados' ? this.retirados : this.filtro === 'reembolso' ? this.conReembolso : this.activos;
  }
  /** Niveles presentes en la lista (en orden: preescolar primero y luego 1°, 2°…). */
  get grados(): string[] {
    const orden = (n: string) => { const num = Number(n); return Number.isFinite(num) ? 100 + num : ({ PREJARDIN: 1, JARDIN: 2, KINDER: 3, TRANSICION: 4 } as Record<string, number>)[n] ?? (n === '—' ? 999 : 50); };
    return [...new Set(this.baseGrado.map((p) => this.nivelDe(p.grado)))].sort((a, b) => orden(a) - orden(b) || a.localeCompare(b));
  }
  /** Grupos del grado elegido. */
  get grupos(): string[] {
    if (!this.filtroGrado) return [];
    return [...new Set(this.baseGrado.filter((p) => this.nivelDe(p.grado) === this.filtroGrado).map((p) => this.grupoDe(p.grado)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  nombreNivel(nivel: string): string {
    if (nivel === '—') return this.t.instant('wg.pestanas.participantes.sinGrado');
    if (Number.isFinite(Number(nivel))) return `${nivel}°`;
    const conTilde: Record<string, string> = { TRANSICION: 'Transición', JARDIN: 'Jardín', PREJARDIN: 'Prejardín' };
    return conTilde[nivel] ?? nivel.charAt(0) + nivel.slice(1).toLowerCase();
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
        this.mostrar(this.t.instant('wg.pestanas.participantes.repartidos') + (bienvenidas ? ' ' + this.t.instant('wg.pestanas.participantes.repartidosBienvenida', { n: bienvenidas }) : ''), false);
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
        this.mostrar((r.retirados === 1 ? this.t.instant('wg.pestanas.participantes.retiradoUno') : this.t.instant('wg.pestanas.participantes.retiradosN', { n: r.retirados }))
          + (r.billetes_devueltos ? ' ' + this.t.instant('wg.pestanas.participantes.billetesVolvieron', { n: formatearNumero(r.billetes_devueltos) }) : ''), false);
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
        this.mostrar(r.reintegrados === 1 ? this.t.instant('wg.pestanas.participantes.reintegradoUno') : this.t.instant('wg.pestanas.participantes.reintegradosN', { n: r.reintegrados }), false);
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
        const asignados = ids.length > 1 ? this.t.instant('wg.pestanas.participantes.asignadosN', { n: ids.length }) : this.t.instant('wg.pestanas.participantes.paisAsignado');
        const bienvenida = r.bienvenidas
          ? ' ' + this.t.instant(r.bienvenidas === 1 ? 'wg.pestanas.participantes.bienvenidaUno' : 'wg.pestanas.participantes.bienvenidaVarios', { n: r.bienvenidas, billetes: this.edicion.investment_bill })
          : '';
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
