import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
  imports: [FormsModule, NumeroMilesDirective, BuscadorPersonaComponent, TranslatePipe],
  template: `
    @if (cargando) {
      <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.pestanas.comun.cargando' | translate }}</div>
    } @else {
      <!-- Resumen de los países -->
      <div class="grid gap-3 sm:grid-cols-3">
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
            @if (sinDetalle(p)) { <p class="text-xs font-semibold text-red-600 mt-1">{{ 'wg.pestanas.paises.faltaDetalle' | translate }}</p> }
            <p class="text-xs mt-2" [class]="p.responsable_banco ? 'text-gray-700' : 'text-amber-700'">🏦 {{ nombreBanquero(p.responsable_banco) || ('wg.pestanas.paises.sinResponsable' | translate) }}</p>
            @if (p.provision_inicial) {
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-lg bg-gray-50 px-2 py-1.5"><span class="text-gray-500">{{ 'wg.pestanas.paises.impresos' | translate }}</span><br><b class="text-gray-800">$ {{ miles(p.provision_inicial) }}</b></div>
                <div class="rounded-lg bg-gray-50 px-2 py-1.5"><span class="text-gray-500">{{ 'wg.pestanas.paises.enCirculacion' | translate }}</span><br><b class="text-gray-800">$ {{ miles(p.en_circulacion) }}</b></div>
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
          <div class="grid gap-4 sm:grid-cols-[1fr_10rem] mt-4">
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

        <!-- Billetes del banco -->
        <section class="tarjeta mt-4">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-gray-800">{{ (bloqueada ? 'wg.pestanas.paises.billetesBanco' : 'wg.pestanas.paises.billetesImpresos') | translate }}</h3>
              <p class="text-sm text-gray-500">
                {{ 'wg.pestanas.paises.hoyProvistos' | translate: { n: miles(actual.provision_inicial) } }}
                @if (verBilletes && bloqueada) { {{ 'wg.pestanas.paises.soloNuevos' | translate }} }
              </p>
            </div>
            <button type="button" (click)="verBilletes = !verBilletes" [attr.aria-expanded]="verBilletes"
                    class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border"
                    [class]="verBilletes ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100'">
              {{ (verBilletes ? 'wg.pestanas.paises.ocultar' : (bloqueada ? 'wg.pestanas.paises.agregarBilletes' : 'wg.pestanas.paises.verBilletes')) | translate }}
              <svg class="w-4 h-4 transition-transform" [class.rotate-180]="verBilletes" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
            </button>
          </div>
          @if (verBilletes || sinDetalle(actual)) {
          @if (sinDetalle(actual)) {
            <p class="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              {{ 'wg.pestanas.paises.sinDetalle' | translate: { pais: actual.nombre, n: miles(actual.provision_inicial) } }}
              {{ (bloqueada ? 'wg.pestanas.paises.sinDetalleBloqueada' : 'wg.pestanas.paises.sinDetalleBorrador') | translate }}
            </p>
          }
          <div class="mt-3 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            @for (d of denominaciones; track d) {
              <div class="rounded-xl border border-gray-200 overflow-hidden">
                @if (imagen(d); as src) {
                  <img [src]="src" [alt]="'wg.pestanas.paises.billeteDe' | translate: { n: miles(d) }" class="w-full aspect-[520/281] object-cover" loading="lazy">
                } @else {
                  <div class="w-full aspect-[520/281] flex items-center justify-center text-xl font-black text-white" [style.background]="actual.color || '#64748b'">{{ miles(d) }}</div>
                }
                <div class="p-2">
                  <label class="sr-only" [attr.for]="'prov-' + d">{{ 'wg.pestanas.paises.billetesDe' | translate: { n: miles(d) } }}</label>
                  <input [id]="'prov-' + d" wgNumero [ngModel]="bloqueada ? extra[d] : billetes[actual.id][d]" (ngModelChange)="poner(d, $event)" [placeholder]="bloqueada ? '+0' : '0'"
                         class="w-full px-2 py-1.5 bg-gray-50 border-2 border-gray-200 rounded-lg text-center font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <p class="text-[11px] text-gray-500 text-center mt-1">
                    @if (bloqueada) { {{ impresos(d) ? ('wg.pestanas.paises.impresosN' | translate: { n: miles(impresos(d)) }) : '' }} } @else { {{ cantidad(d) ? '= ' + miles(d * cantidad(d)) : '' }} }&nbsp;
                  </p>
                </div>
              </div>
            }
          </div>
          <div class="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div class="flex gap-6">
              @if (bloqueada) {
                <div><p class="text-xs text-gray-500">{{ 'wg.pestanas.paises.entranBanco' | translate }}</p><p class="text-xl font-bold text-emerald-700">+{{ miles(totalExtra) }}</p></div>
                <div><p class="text-xs text-gray-500">{{ 'wg.pestanas.paises.provisionTotal' | translate }}</p><p class="text-xl font-bold text-gray-800">{{ miles((actual.provision_inicial || 0) + totalExtra) }}</p></div>
              } @else {
                <div><p class="text-xs text-gray-500">{{ 'wg.pestanas.paises.totalBanco' | translate }}</p><p class="text-xl font-bold text-gray-800">{{ miles(totalActual) }}</p></div>
                <div><p class="text-xs text-gray-500">{{ 'wg.pestanas.paises.billetes' | translate }}</p><p class="text-xl font-bold text-gray-800">{{ miles(piezas) }}</p></div>
                @if (necesarios > totalActual) {
                  <div><p class="text-xs text-red-600">{{ 'wg.pestanas.paises.bienvenidaNecesita' | translate }}</p><p class="text-xl font-bold text-red-600">{{ miles(necesarios) }}</p></div>
                }
              }
            </div>
            @if (error) { <p class="text-sm text-red-700 sm:ml-auto" role="alert">{{ error }}</p> }
            @if (guardado) { <p class="text-sm text-emerald-700 sm:ml-auto" role="status">{{ (bloqueada ? 'wg.pestanas.paises.agregados' : 'wg.pestanas.comun.guardado') | translate }}</p> }
            @if (bloqueada) {
              <button type="button" (click)="agregarAlBanco()" [disabled]="guardando || !totalExtra" class="boton-guardar" [class.sm:ml-auto]="!error && !guardado">{{ (guardando ? 'wg.pestanas.comun.agregando' : 'wg.pestanas.paises.agregarAlBanco') | translate }}</button>
            } @else {
              <button type="button" (click)="guardar()" [disabled]="guardando" class="boton-guardar" [class.sm:ml-auto]="!error && !guardado">{{ (guardando ? 'wg.pestanas.comun.guardando' : 'wg.pestanas.comun.guardar') | translate }}</button>
            }
          </div>
          }
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
  `,
  styles: [ESTILOS_CAMPOS],
})
export class TabPaises implements OnInit {
  /** La sección de billetes del banco empieza plegada para no cargar la página. */
  verBilletes = false;
  @Input({ required: true }) edicion!: Edicion;
  @Output() paisesCambiaron = new EventEmitter<Pais[]>();
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
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
    this.actual = p; this.verBilletes = false;
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

  montoVirtual: number | null = null;
  cargandoVirtual = false;
  cargadoVirtual = false;
  errorVirtual = '';

  /** Carga saldo a la cuenta virtual del banco del país elegido (dinero sin billetes). */
  cargarVirtual(): void {
    const p = this.actual;
    const monto = Number(this.montoVirtual);
    if (!p || !(monto > 0)) return;
    if (!confirm(this.t.instant('wg.pestanas.paises.virtualConfirmar', { n: this.miles(monto), pais: p.nombre }))) return;
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
    if (!confirm(this.t.instant('wg.pestanas.paises.confirmarAgregar', { n: this.miles(this.totalExtra), pais: p.nombre }))) return;
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
