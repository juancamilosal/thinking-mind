import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Edicion, Funcionario, Pais, WillGoService } from '../../../../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from '../../../numero-miles.directive';
import { imagenBillete } from '../../../imagen-billete';
import { BuscadorPersonaComponent } from '../../../buscador-persona.component';
import { ESTILOS_CAMPOS } from './estilos-tabs';

const DENOMINACIONES = [1, 2, 5, 10, 50, 100, 200, 1000, 5000, 50000];

/** Países y banco: datos de cada país y los billetes impresos que recibe su banco (la provisión). */
@Component({
  selector: 'app-tab-paises',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, BuscadorPersonaComponent],
  template: `
    @if (cargando) {
      <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando…</div>
    } @else {
      <!-- Resumen de los países -->
      <div class="grid gap-3 sm:grid-cols-3">
        @for (p of paises; track p.id) {
          <button type="button" (click)="elegir(p)" class="text-left bg-white rounded-2xl border-2 p-4 transition"
                  [style.border-color]="actual?.id === p.id ? (p.color || '#94a3b8') : '#e5e7eb'">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full" [style.background]="p.color"></span>
              <span class="font-bold text-gray-800">{{ p.nombre }}</span>
              <span class="ml-auto text-xs text-gray-400">{{ p.codigo_moneda }}</span>
            </div>
            <p class="text-2xl font-bold text-gray-800 mt-2">{{ miles(enBanco(p)) }}</p>
            <p class="text-xs text-gray-500">billetes en el banco</p>
            @if (sinDetalle(p)) { <p class="text-xs font-semibold text-red-600 mt-1">⚠ Falta el detalle de billetes</p> }
            <p class="text-xs mt-2" [class]="p.responsable_banco ? 'text-gray-700' : 'text-amber-700'">🏦 {{ nombreBanquero(p.responsable_banco) || 'Sin responsable del banco' }}</p>
            @if (p.provision_inicial) {
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-lg bg-gray-50 px-2 py-1.5"><span class="text-gray-500">Impresos</span><br><b class="text-gray-800">{{ miles(p.provision_inicial) }}</b></div>
                <div class="rounded-lg bg-gray-50 px-2 py-1.5"><span class="text-gray-500">En circulación</span><br><b class="text-gray-800">{{ miles(p.en_circulacion) }}</b></div>
              </div>
            }
          </button>
        }
      </div>

      @if (actual) {
        <!-- Datos del país -->
        <section class="tarjeta mt-4">
          <div class="grid gap-4 sm:grid-cols-[auto_1fr_7rem]">
            <div>
              <label class="etiqueta" [attr.for]="'color-' + actual.id">Color</label>
              <input [id]="'color-' + actual.id" type="color" [(ngModel)]="actual.color" class="block w-14 h-[46px] rounded-xl border-2 border-gray-200 cursor-pointer p-1 bg-gray-50">
            </div>
            <div>
              <label class="etiqueta" [attr.for]="'nombre-' + actual.id">País</label>
              <input [id]="'nombre-' + actual.id" [(ngModel)]="actual.nombre" class="campo font-semibold">
            </div>
            <div>
              <label class="etiqueta" [attr.for]="'mon-' + actual.id">Moneda</label>
              <input [id]="'mon-' + actual.id" [(ngModel)]="actual.codigo_moneda" maxlength="5" class="campo uppercase" placeholder="WON">
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-[1fr_10rem] mt-4">
            <div>
              <label class="etiqueta" [attr.for]="'banco-' + actual.id">Responsable del banco</label>
              <wg-buscador-persona [inputId]="'banco-' + actual.id" [(ngModel)]="actual.responsable_banco" [personas]="banqueros"
                                   placeholder="Buscar colaborador del banco…" vacio="No hay colaboradores con rol Banco" />
              @if (!banqueros.length) { <p class="ayuda">Crea primero un colaborador con rol Banco en <b>Colaboradores</b>.</p> }
            </div>
            <div>
              <p class="etiqueta">Tasa actual</p>
              <p class="campo !bg-gray-100 text-gray-700">{{ miles(actual.tasa_actual || edicion.tasa_inicial) }}</p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
            @if (errorDatos) { <p class="text-sm text-red-700" role="alert">{{ errorDatos }}</p> }
            @if (guardadoDatos) { <p class="text-sm text-emerald-700" role="status">Guardado.</p> }
            <button type="button" (click)="guardarDatos()" [disabled]="guardando" class="boton-guardar sm:ml-auto">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
          </div>
        </section>

        <!-- Billetes del banco -->
        <section class="tarjeta mt-4">
          <div class="flex flex-wrap items-baseline gap-2">
            <h3 class="font-bold text-gray-800">{{ bloqueada ? 'Agregar billetes al banco' : 'Billetes impresos para el banco' }}</h3>
            @if (bloqueada) { <span class="text-sm text-gray-500">Hoy hay {{ miles(actual.provision_inicial) }} provistos. Escribe solo los billetes nuevos.</span> }
          </div>
          @if (sinDetalle(actual)) {
            <p class="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              La provisión de {{ actual.nombre }} ({{ miles(actual.provision_inicial) }}) no tiene el detalle por billete, así que no se puede cuadrar por denominación.
              {{ bloqueada ? 'Para las próximas ediciones, regístrala por billetes antes de abrir.' : 'Escribe cuántos billetes hay de cada denominación y guarda.' }}
            </p>
          }
          <div class="mt-3 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            @for (d of denominaciones; track d) {
              <div class="rounded-xl border border-gray-200 overflow-hidden">
                @if (imagen(d); as src) {
                  <img [src]="src" [alt]="'Billete de ' + miles(d)" class="w-full aspect-[520/281] object-cover" loading="lazy">
                } @else {
                  <div class="w-full aspect-[520/281] flex items-center justify-center text-xl font-black text-white" [style.background]="actual.color || '#64748b'">{{ miles(d) }}</div>
                }
                <div class="p-2">
                  <label class="sr-only" [attr.for]="'prov-' + d">Billetes de {{ miles(d) }}</label>
                  <input [id]="'prov-' + d" wgNumero [ngModel]="bloqueada ? extra[d] : billetes[actual.id][d]" (ngModelChange)="poner(d, $event)" [placeholder]="bloqueada ? '+0' : '0'"
                         class="w-full px-2 py-1.5 bg-gray-50 border-2 border-gray-200 rounded-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <p class="text-[11px] text-gray-500 text-center mt-1">
                    @if (bloqueada) { {{ impresos(d) ? 'Impresos: ' + miles(impresos(d)) : '' }} } @else { {{ cantidad(d) ? '= ' + miles(d * cantidad(d)) : '' }} }&nbsp;
                  </p>
                </div>
              </div>
            }
          </div>
          <div class="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="flex gap-6">
              @if (bloqueada) {
                <div><p class="text-xs text-gray-500">Entran al banco</p><p class="text-xl font-bold text-emerald-700">+{{ miles(totalExtra) }}</p></div>
                <div><p class="text-xs text-gray-500">Provisión total</p><p class="text-xl font-bold text-gray-800">{{ miles((actual.provision_inicial || 0) + totalExtra) }}</p></div>
              } @else {
                <div><p class="text-xs text-gray-500">Total del banco</p><p class="text-xl font-bold text-gray-800">{{ miles(totalActual) }}</p></div>
                <div><p class="text-xs text-gray-500">Billetes</p><p class="text-xl font-bold text-gray-800">{{ miles(piezas) }}</p></div>
                @if (necesarios > totalActual) {
                  <div><p class="text-xs text-red-600">Bienvenida necesita</p><p class="text-xl font-bold text-red-600">{{ miles(necesarios) }}</p></div>
                }
              }
            </div>
            @if (error) { <p class="text-sm text-red-700 sm:ml-auto" role="alert">{{ error }}</p> }
            @if (guardado) { <p class="text-sm text-emerald-700 sm:ml-auto" role="status">{{ bloqueada ? 'Billetes agregados al banco.' : 'Guardado.' }}</p> }
            @if (bloqueada) {
              <button type="button" (click)="agregarAlBanco()" [disabled]="guardando || !totalExtra" class="boton-guardar" [class.sm:ml-auto]="!error && !guardado">{{ guardando ? 'Agregando…' : 'Agregar al banco' }}</button>
            } @else {
              <button type="button" (click)="guardar()" [disabled]="guardando" class="boton-guardar" [class.sm:ml-auto]="!error && !guardado">{{ guardando ? 'Guardando…' : 'Guardar' }}</button>
            }
          </div>
        </section>
      }
    }
  `,
  styles: [ESTILOS_CAMPOS],
})
export class TabPaises implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() paisesCambiaron = new EventEmitter<Pais[]>();
  private willGo = inject(WillGoService);
  readonly denominaciones = DENOMINACIONES;
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);

  paises: Pais[] = [];
  actual: Pais | null = null;
  banqueros: Funcionario[] = [];
  /** Billetes impresos por país: { paisId: { denominación: cantidad } } */
  billetes: Record<string, Record<number, number | null>> = {};
  conteo: Record<string, number> = {};
  /** Billetes nuevos que entran al banco con la edición abierta. */
  extra: Record<number, number | null> = {};
  guardadoDatos = false;
  errorDatos = '';
  cargando = true;
  guardando = false;
  guardado = false;
  error = '';

  get bloqueada(): boolean {
    return this.edicion.estado !== 'borrador';
  }

  ngOnInit(): void {
    this.cargar();
    this.willGo.funcionarios().subscribe({ next: (l) => (this.banqueros = l.filter((f) => f.rol === 'banco' && f.estado === 'active')) });
    this.willGo.participantes(this.edicion.id).subscribe({
      next: (l) => { this.conteo = {}; for (const p of l) if (p.pais_id && !p.retirado) this.conteo[p.pais_id] = (this.conteo[p.pais_id] ?? 0) + 1; },
    });
  }

  cargar(): void {
    this.willGo.seccion<Pais>(this.edicion.id, 'paises').subscribe({
      next: (lista) => {
        this.paises = lista;
        for (const p of lista) {
          const guardados = (typeof p.provision_billetes === 'string' ? JSON.parse(p.provision_billetes) : p.provision_billetes) ?? {};
          this.billetes[p.id] = Object.fromEntries(Object.entries(guardados).map(([d, n]) => [Number(d), Number(n)]));
        }
        this.actual = lista.find((p) => p.id === this.actual?.id) ?? lista[0] ?? null;
        this.cargando = false;
        this.paisesCambiaron.emit(lista);
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  nombreBanquero(id: string | null | undefined): string {
    const b = this.banqueros.find((x) => x.id === id);
    return b ? `${b.nombre} ${b.apellido}` : '';
  }

  elegir(p: Pais): void {
    this.actual = p;
    this.guardado = false;
    this.guardadoDatos = false;
    this.error = '';
    this.errorDatos = '';
    this.extra = {};
  }

  imagen(d: number): string | null {
    return imagenBillete(this.actual ?? undefined, d);
  }

  cantidad(d: number): number {
    return Number(this.actual ? this.billetes[this.actual.id]?.[d] ?? 0 : 0) || 0;
  }

  poner(d: number, valor: number | null): void {
    if (this.bloqueada) this.extra[d] = valor;
    else if (this.actual) this.billetes[this.actual.id][d] = valor;
  }

  impresos(d: number): number {
    return Number(this.actual ? this.billetes[this.actual.id]?.[d] ?? 0 : 0) || 0;
  }

  get totalExtra(): number {
    return DENOMINACIONES.reduce((t, d) => t + d * (Number(this.extra[d]) || 0), 0);
  }

  /** Billetes que el banco tiene hoy (los recibe apenas se registran los billetes impresos). */
  enBanco(p: Pais): number {
    return p.saldo_banco ?? 0;
  }

  /** Provisión escrita como número sin el detalle de billetes (no se puede cuadrar por denominación). */
  sinDetalle(p: Pais): boolean {
    const b = this.billetes[p.id] ?? {};
    const suma = DENOMINACIONES.reduce((t, d) => t + d * (Number(b[d]) || 0), 0);
    return (p.provision_inicial || 0) > 0 && suma !== (p.provision_inicial || 0);
  }

  /** Total de un país: con detalle de billetes si lo tiene; si no, la provisión guardada. */
  totalDe(p: Pais): number {
    const b = this.billetes[p.id] ?? {};
    const suma = DENOMINACIONES.reduce((t, d) => t + d * (Number(b[d]) || 0), 0);
    return suma || p.provision_inicial || 0;
  }

  get totalActual(): number {
    return DENOMINACIONES.reduce((t, d) => t + d * this.cantidad(d), 0);
  }

  get piezas(): number {
    return DENOMINACIONES.reduce((t, d) => t + this.cantidad(d), 0);
  }

  /** Billetes que el banco necesita para la bienvenida de los estudiantes de ese país. */
  get necesarios(): number {
    return this.actual ? (this.conteo[this.actual.id] ?? 0) * (this.edicion.investment_bill || 0) : 0;
  }

  guardarDatos(): void {
    const p = this.actual;
    if (!p) return;
    this.guardando = true;
    this.guardadoDatos = false;
    this.errorDatos = '';
    this.willGo.actualizarEnSeccion<Pais>('paises', p.id, {
      nombre: p.nombre, codigo_moneda: (p.codigo_moneda || '').toUpperCase() || null, color: p.color, responsable_banco: p.responsable_banco ?? null,
    } as Partial<Pais>).subscribe({
      next: () => { this.guardando = false; this.guardadoDatos = true; this.cargar(); },
      error: (e) => { this.guardando = false; this.errorDatos = WillGoService.mensajeDeError(e); },
    });
  }

  agregarAlBanco(): void {
    const p = this.actual;
    if (!p || !this.totalExtra) return;
    if (!confirm(`¿Agregar ${this.miles(this.totalExtra)} billetes al banco de ${p.nombre}?`)) return;
    const billetes: Record<string, number> = {};
    for (const d of DENOMINACIONES) if (Number(this.extra[d])) billetes[d] = Number(this.extra[d]);
    this.guardando = true;
    this.guardado = false;
    this.error = '';
    this.willGo.provisionarPais(p.id, billetes).subscribe({
      next: () => { this.guardando = false; this.guardado = true; this.extra = {}; this.cargar(); },
      error: (e) => { this.guardando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }

  guardar(): void {
    const p = this.actual;
    if (!p) return;
    this.guardando = true;
    this.guardado = false;
    this.error = '';
    const datos: Record<string, unknown> = { nombre: p.nombre, codigo_moneda: (p.codigo_moneda || '').toUpperCase() || null, color: p.color, responsable_banco: p.responsable_banco ?? null };
    if (!this.bloqueada) {
      const conteo: Record<string, number> = {};
      for (const d of DENOMINACIONES) if (this.cantidad(d)) conteo[d] = this.cantidad(d);
      datos['provision_billetes'] = conteo;
    }
    this.willGo.actualizarEnSeccion<Pais>('paises', p.id, datos as Partial<Pais>).subscribe({
      next: () => { this.guardando = false; this.guardado = true; this.cargar(); },
      error: (e) => { this.guardando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
