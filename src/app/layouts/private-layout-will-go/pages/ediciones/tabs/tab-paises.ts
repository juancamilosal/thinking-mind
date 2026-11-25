import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Edicion, Funcionario, Pais, WillGoService } from '../../../../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from '../../../numero-miles.directive';
import { BuscadorPersonaComponent } from '../../../buscador-persona.component';
import { ESTILOS_CAMPOS } from './estilos-tabs';

/** Países y banco: datos de cada país y el dinero que recibe su banco (la provisión), escrito como un total. */
@Component({
  selector: 'app-tab-paises',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, BuscadorPersonaComponent, TranslatePipe],
  template: `
    @if (cargando) {
      <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.pestanas.comun.cargando' | translate }}</div>
    } @else {
      <!-- Resumen de los países -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        @for (p of paises; track p.id) {
          <button type="button" (click)="elegir(p)" class="text-left bg-white rounded-2xl border-2 p-4 transition"
                  [style.border-color]="actual?.id === p.id ? (p.color || '#94a3b8') : '#e5e7eb'">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full" [style.background]="p.color"></span>
              <span class="font-bold text-gray-800">{{ p.nombre }}</span>
              @if (p.codigo_moneda) {
                <span class="ml-auto inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full" [style.color]="p.color || '#475569'" [style.background]="(p.color || '#94a3b8') + '1a'">🪙 {{ p.codigo_moneda }}</span>
              }
            </div>
            <p class="text-2xl font-bold text-gray-800 mt-2 break-all">
              <span class="font-extrabold" [style.color]="p.color || '#475569'">$</span> {{ miles(enBanco(p)) }}
              @if (p.codigo_moneda) { <span class="text-sm font-semibold text-gray-500">{{ p.codigo_moneda }}</span> }
            </p>
            <p class="text-xs text-gray-500">💵 {{ 'wg.pestanas.paises.dineroBanco' | translate }}</p>
            <p class="text-2xl font-bold text-gray-800 mt-2 break-all">
              <span class="font-extrabold" [style.color]="p.color || '#475569'">$</span> {{ miles(p.saldo_virtual ?? 0) }}
              @if (p.codigo_moneda) { <span class="text-sm font-semibold text-gray-500">{{ p.codigo_moneda }}</span> }
            </p>
            <p class="text-xs text-gray-500">💳 {{ 'wg.pestanas.paises.virtualBanco' | translate }}</p>
            <p class="text-xs mt-2" [class]="p.responsable_banco ? 'text-gray-700' : 'text-amber-700'">🏦 {{ nombreBanquero(p.responsable_banco) || ('wg.pestanas.paises.sinResponsable' | translate) }}</p>
            @if (p.provision_inicial) {
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-lg bg-gray-50 px-2 py-1.5"><span class="text-gray-500">{{ 'wg.montobanco.provisto' | translate }}</span><br><b class="text-gray-800">$ {{ miles(p.provision_inicial) }}</b></div>
                <div class="rounded-lg bg-gray-50 px-2 py-1.5"><span class="text-gray-500">{{ 'wg.pestanas.paises.enCirculacion' | translate }}</span><br><b class="text-gray-800">$ {{ miles(p.en_circulacion) }}</b></div>
              </div>
            }
          </button>
        }
      </div>

      @if (actual) {
        <!-- Datos del país -->
        <section class="tarjeta mt-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr_7rem]">
            <div>
              <label class="etiqueta" [attr.for]="'color-' + actual.id">{{ 'wg.pestanas.paises.color' | translate }}</label>
              <input [id]="'color-' + actual.id" type="color" [(ngModel)]="actual.color" class="block w-14 h-[46px] rounded-xl border-2 border-gray-200 cursor-pointer p-1 bg-gray-50">
            </div>
            <div>
              <label class="etiqueta" [attr.for]="'nombre-' + actual.id">{{ 'wg.pestanas.comun.pais' | translate }}</label>
              <input [id]="'nombre-' + actual.id" [(ngModel)]="actual.nombre" class="campo font-semibold">
            </div>
            <div>
              <label class="etiqueta" [attr.for]="'mon-' + actual.id">{{ 'wg.pestanas.paises.moneda' | translate }}</label>
              <input [id]="'mon-' + actual.id" [(ngModel)]="actual.codigo_moneda" maxlength="5" class="campo uppercase" placeholder="WON">
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem] mt-4">
            <div>
              <label class="etiqueta" [attr.for]="'banco-' + actual.id">{{ 'wg.pestanas.paises.responsableBanco' | translate }}</label>
              <wg-buscador-persona [inputId]="'banco-' + actual.id" [(ngModel)]="actual.responsable_banco" [personas]="banqueros"
                                   [placeholder]="'wg.pestanas.paises.buscarBanco' | translate" [vacio]="'wg.pestanas.paises.sinBanqueros' | translate" />
              @if (!banqueros.length) { <p class="ayuda" [innerHTML]="'wg.pestanas.paises.crearBanquero' | translate"></p> }
            </div>
            <div>
              <p class="etiqueta">{{ 'wg.pestanas.paises.tasaActual' | translate }}</p>
              <p class="campo !bg-gray-100 text-gray-700">{{ miles(actual.tasa_actual || edicion.tasa_inicial) }}</p>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
            @if (errorDatos) { <p class="text-sm text-red-700" role="alert">{{ errorDatos }}</p> }
            @if (guardadoDatos) { <p class="text-sm text-emerald-700" role="status">{{ 'wg.pestanas.comun.guardado' | translate }}</p> }
            <button type="button" (click)="guardarDatos()" [disabled]="guardando" class="boton-guardar sm:ml-auto">{{ (guardando ? 'wg.pestanas.comun.guardando' : 'wg.pestanas.comun.guardar') | translate }}</button>
          </div>
        </section>

        <!-- Dinero del banco (un solo total) -->
        <section class="tarjeta mt-4">
          <div class="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div class="flex-1 min-w-[12rem]">
              <h3 class="font-bold text-gray-800">💵 {{ 'wg.montobanco.dineroBanco' | translate }}</h3>
              <p class="text-sm text-gray-500">{{ (bloqueada ? 'wg.montobanco.ayudaAbierta' : 'wg.montobanco.ayudaBorrador') | translate }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500">{{ 'wg.montobanco.provisto' | translate }}</p>
              <p class="text-2xl font-extrabold break-all" [style.color]="actual.color || '#334155'">$ {{ miles(actual.provision_inicial) }}</p>
            </div>
          </div>
          @if (!bloqueada) {
            <form class="mt-4 flex flex-col sm:flex-row sm:items-end gap-3" (submit)="$event.preventDefault(); guardar()">
              <div class="flex-1">
                <label class="etiqueta" [attr.for]="'prov-' + actual.id">{{ 'wg.montobanco.totalBanco' | translate }}</label>
                <input [id]="'prov-' + actual.id" wgNumero name="provisionTotal" [ngModel]="totales[actual.id]" (ngModelChange)="totales[actual.id] = $event" placeholder="0" class="campo">
                @if (necesarios > totalActual) {
                  <p class="ayuda !text-red-600 font-semibold">{{ 'wg.montobanco.bienvenidaNecesita' | translate: { n: miles(necesarios) } }}</p>
                }
              </div>
              <button type="submit" [disabled]="guardando" class="boton-guardar">{{ (guardando ? 'wg.pestanas.comun.guardando' : 'wg.pestanas.comun.guardar') | translate }}</button>
            </form>
          } @else if (edicion.estado !== 'cerrada') {
            <form class="mt-4 flex flex-col sm:flex-row sm:items-end gap-3" (submit)="$event.preventDefault(); agregarAlBanco()">
              <div class="flex-1">
                <label class="etiqueta" [attr.for]="'extra-' + actual.id">{{ 'wg.montobanco.agregarDinero' | translate }}</label>
                <input [id]="'extra-' + actual.id" wgNumero name="montoExtra" [(ngModel)]="extra" placeholder="0" class="campo">
              </div>
              <button type="submit" [disabled]="guardando || !totalExtra" class="boton-guardar">{{ (guardando ? 'wg.pestanas.comun.agregando' : 'wg.pestanas.paises.agregarAlBanco') | translate }}</button>
            </form>
          }
          @if (error) { <p class="mt-2 text-sm text-red-700" role="alert">{{ error }}</p> }
          @if (guardado) { <p class="mt-2 text-sm text-emerald-700" role="status">{{ (bloqueada ? 'wg.montobanco.agregado' : 'wg.pestanas.comun.guardado') | translate }}</p> }
        </section>

        <!-- Saldo virtual del banco -->
        <section class="tarjeta mt-4">
          <div class="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div class="flex-1 min-w-[12rem]">
              <h3 class="font-bold text-gray-800">💳 {{ 'wg.pestanas.paises.virtualTitulo' | translate }}</h3>
              <p class="text-sm text-gray-500">{{ 'wg.pestanas.paises.virtualAyuda' | translate }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500">{{ 'wg.pestanas.paises.virtualHoy' | translate }}</p>
              <p class="text-2xl font-extrabold break-all" [style.color]="actual.color || '#334155'">$ {{ miles(actual.saldo_virtual ?? 0) }}</p>
            </div>
          </div>
          @if (edicion.estado !== 'cerrada') {
            <form class="mt-4 flex flex-col sm:flex-row sm:items-end gap-3" (submit)="$event.preventDefault(); cargarVirtual()">
              <div class="flex-1">
                <label class="etiqueta" [attr.for]="'virtual-' + actual.id">{{ 'wg.pestanas.paises.virtualMonto' | translate }}</label>
                <input [id]="'virtual-' + actual.id" wgNumero name="montoVirtual" [(ngModel)]="montoVirtual" placeholder="0" class="campo">
              </div>
              <button type="submit" [disabled]="cargandoVirtual || !(montoVirtual > 0)" class="boton-guardar">
                {{ (cargandoVirtual ? 'wg.pestanas.comun.agregando' : 'wg.pestanas.paises.virtualCargar') | translate }}
              </button>
            </form>
            @if (errorVirtual) { <p class="mt-2 text-sm text-red-700" role="alert">{{ errorVirtual }}</p> }
            @if (cargadoVirtual) { <p class="mt-2 text-sm text-emerald-700" role="status">{{ 'wg.pestanas.paises.virtualListo' | translate }}</p> }
          }
        </section>
      }
    }

    @if (confirmacion; as c) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" (click)="confirmacion = null">
        <div class="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true" aria-labelledby="titulo-confirmar-banco">
          <h2 id="titulo-confirmar-banco" class="text-lg font-bold text-gray-800">
            {{ (c.tipo === 'virtual' ? 'wg.pestanas.paises.virtualConfirmarTitulo' : 'wg.montobanco.confirmarTitulo') | translate }}
          </h2>
          <p class="text-sm text-gray-600 mt-1">{{ 'wg.pestanas.paises.bancoDe' | translate: { pais: c.pais } }}</p>
          <div class="mt-4 rounded-2xl p-5 text-white" [style.background]="c.color">
            <p class="text-xs opacity-90">{{ (c.tipo === 'virtual' ? 'wg.pestanas.paises.virtualMonto' : 'wg.pestanas.paises.entranBanco') | translate }}</p>
            <p class="text-3xl font-extrabold break-all">+ $ {{ miles(c.monto) }}</p>
          </div>
          <p class="mt-3 text-sm text-gray-700">
            {{ (c.tipo === 'virtual' ? 'wg.pestanas.paises.quedaVirtual' : 'wg.montobanco.quedaBanco') | translate: { n: miles(c.despues) } }}
          </p>
          <div class="flex gap-3 mt-6">
            <button type="button" (click)="confirmacion = null" class="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.pestanas.comun.cancelar' | translate }}</button>
            <button type="button" (click)="confirmar()" class="flex-1 py-2.5 rounded-xl font-semibold text-white bg-orange-600 hover:bg-orange-700">
              {{ (c.tipo === 'virtual' ? 'wg.pestanas.paises.virtualCargarSi' : 'wg.pestanas.paises.agregarAlBanco') | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [ESTILOS_CAMPOS],
})
export class TabPaises implements OnInit {
  @Input({ required: true }) edicion!: Edicion;
  @Output() paisesCambiaron = new EventEmitter<Pais[]>();
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);

  paises: Pais[] = [];
  actual: Pais | null = null;
  banqueros: Funcionario[] = [];
  /** Dinero del banco por país mientras la edición está en preparación: { paisId: total } */
  totales: Record<string, number | null> = {};
  conteo: Record<string, number> = {};
  /** Dinero nuevo que entra al banco con la edición abierta. */
  extra: number | null = null;
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
        for (const p of lista) this.totales[p.id] = Number(p.provision_inicial) || 0;
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
    this.extra = null;
  }

  get totalExtra(): number {
    return Number(this.extra) || 0;
  }

  /** Dinero en efectivo que el banco tiene hoy (lo recibe apenas se registra la provisión). */
  enBanco(p: Pais): number {
    return p.saldo_banco ?? 0;
  }

  get totalActual(): number {
    return Number(this.actual ? this.totales[this.actual.id] : 0) || 0;
  }

  /** Dinero que el banco necesita para la bienvenida de los estudiantes de ese país. */
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

  /** Confirmación (en un modal) antes de cargar saldo virtual o agregar dinero al banco. */
  confirmacion: { tipo: 'virtual' | 'dinero'; monto: number; pais: string; color: string; despues: number } | null = null;

  confirmar(): void {
    const c = this.confirmacion;
    this.confirmacion = null;
    if (!c) return;
    if (c.tipo === 'virtual') this.ejecutarCargaVirtual(c.monto); else this.ejecutarAgregarDinero();
  }

  montoVirtual: number | null = null;
  cargandoVirtual = false;
  cargadoVirtual = false;
  errorVirtual = '';

  /** Carga saldo a la cuenta virtual del banco del país elegido (dinero sin billetes). */
  cargarVirtual(): void {
    const p = this.actual;
    const monto = Number(this.montoVirtual);
    if (!p || !(monto > 0)) return;
    this.confirmacion = { tipo: 'virtual', monto, pais: p.nombre, color: p.color || '#334155', despues: Number(p.saldo_virtual ?? 0) + monto };
  }

  private ejecutarCargaVirtual(monto: number): void {
    const p = this.actual;
    if (!p) return;
    this.cargandoVirtual = true;
    this.cargadoVirtual = false;
    this.errorVirtual = '';
    this.willGo.cargarSaldoVirtual(p.id, monto).subscribe({
      next: () => { this.cargandoVirtual = false; this.cargadoVirtual = true; this.montoVirtual = null; this.cargar(); },
      error: (e) => { this.cargandoVirtual = false; this.errorVirtual = WillGoService.mensajeDeError(e); },
    });
  }

  agregarAlBanco(): void {
    const p = this.actual;
    if (!p || !this.totalExtra) return;
    this.confirmacion = { tipo: 'dinero', monto: this.totalExtra, pais: p.nombre, color: p.color || '#334155', despues: Number(p.provision_inicial ?? 0) + this.totalExtra };
  }

  private ejecutarAgregarDinero(): void {
    const p = this.actual;
    if (!p || !this.totalExtra) return;
    this.guardando = true;
    this.guardado = false;
    this.error = '';
    this.willGo.provisionarPais(p.id, this.totalExtra).subscribe({
      next: () => { this.guardando = false; this.guardado = true; this.extra = null; this.cargar(); },
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
    // En preparación el dinero del banco se guarda como un total (sin detalle de billetes)
    if (!this.bloqueada) datos['provision_total'] = this.totalActual;
    this.willGo.actualizarEnSeccion<Pais>('paises', p.id, datos as Partial<Pais>).subscribe({
      next: () => { this.guardando = false; this.guardado = true; this.cargar(); },
      error: (e) => { this.guardando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
