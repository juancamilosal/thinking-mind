import { Component, OnInit, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DatosCuentas, EdicionVigente, EstudianteCuenta, PaisCuentas, WillGoService } from '../../../../core/services/will-go.service';
import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { SelectorBilletesComponent } from '../../selector-billetes.component';
import { QrLlaveComponent } from '../../qr-llave.component';
import { NumeroMilesDirective, formatearNumero } from '../../numero-miles.directive';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

type Operacion = 'consignar' | 'retirar';

/** Cuentas y tarjetas: el banco consigna (billetes → cuenta) y retira (cuenta → billetes) para los estudiantes. */
@Component({
  selector: 'app-cuentas-will-go',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SelectorEdicionComponent, SelectorBilletesComponent, QrLlaveComponent, NumeroMilesDirective],
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.cuentas.titulo' | translate }}</h1>
          <p class="text-gray-500 mt-1">{{ 'wg.cuentas.subtitulo' | translate }}</p>
        </div>
        @if (edicionId) {
          <button type="button" (click)="imprimirTarjetas()"
                  class="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-slate-800 hover:bg-slate-900">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            {{ 'wg.cuentas.imprimirTarjetas' | translate }}
          </button>
        }
      </div>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" (cambio)="cargar()" />

      @if (cargando) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.cuentas.cargando' | translate }}</div>
      } @else if (error) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!datos?.paises?.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.cuentas.sinPais' | translate }}</div>
      } @else if (datos && pais) {
        @if (datos.paises.length > 1) {
          <div class="mt-5 flex flex-wrap gap-2">
            @for (p of datos.paises; track p.id) {
              <button type="button" (click)="pais = p" class="px-4 py-2 rounded-xl text-sm font-semibold border-2"
                      [style.background]="pais.id === p.id ? (p.color || '#1e293b') : '#fff'" [style.border-color]="p.color || '#cbd5e1'"
                      [style.color]="pais.id === p.id ? '#fff' : '#334155'">{{ p.nombre }}</button>
            }
          </div>
        }

        <!-- Total en cuentas del país -->
        <div class="mt-4 rounded-2xl p-5 text-white shadow" [style.background]="pais.color || '#1e293b'">
          <p class="text-sm opacity-90">{{ 'wg.cuentas.enCuentasDe' | translate: { pais: pais.nombre } }}</p>
          <p class="text-3xl font-extrabold mt-1 break-all">{{ miles(pais.en_cuentas) }} <span class="text-base font-semibold opacity-90">{{ pais.codigo_moneda }}</span></p>
          <p class="text-sm mt-1 opacity-90">{{ (pais.estudiantes.length === 1 ? 'wg.cuentas.estudiante' : 'wg.cuentas.estudiantes') | translate: { n: pais.estudiantes.length } }}</p>
          @if (datos.edicion.estado !== 'abierta') {
            <p class="text-sm mt-2 bg-white/20 rounded-lg px-3 py-1.5 inline-block">{{ 'wg.cuentas.soloAbierta' | translate }}</p>
          }
        </div>

        @if (aviso) {
          <p class="mt-3 rounded-xl px-4 py-3 text-sm" [class]="avisoError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'" role="status">{{ aviso }}</p>
        }

        <!-- Buscador -->
        <div class="mt-5">
          <input type="search" [(ngModel)]="busqueda" [placeholder]="'wg.cuentas.buscar' | translate" [attr.aria-label]="'wg.cuentas.buscarAria' | translate"
                 class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
        </div>

        <!-- Estudiantes -->
        @if (!pais.estudiantes.length) {
          <div class="mt-3 bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">{{ 'wg.cuentas.sinEstudiantes' | translate: { pais: pais.nombre } }}</div>
        } @else if (!filtrados.length) {
          <div class="mt-3 bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">{{ 'wg.cuentas.sinResultados' | translate }}</div>
        } @else {
          <ul class="mt-3 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            @for (e of filtrados; track e.id) {
              <li>
                <button type="button" (click)="abrir(e)" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                  <div class="w-11 h-11 shrink-0 rounded-full text-white font-bold flex items-center justify-center" [style.background]="pais.color || '#0d9488'">{{ (e.nombre[0] || '') + (e.apellido[0] || '') }}</div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-gray-800 truncate">{{ e.nombre }} {{ e.apellido }}</p>
                    <p class="text-xs text-gray-500 truncate font-mono">{{ e.llave || ('wg.cuentas.sinLlave' | translate) }}</p>
                  </div>
                  <div class="shrink-0 text-right text-xs leading-tight">
                    <p class="text-gray-500">{{ 'wg.cuentas.efectivo' | translate }} <b class="text-gray-800 text-sm">{{ miles(e.efectivo) }}</b></p>
                    <p class="text-gray-500 mt-1">{{ 'wg.cuentas.cuenta' | translate }} <b class="text-gray-800 text-sm">{{ miles(e.cuenta) }}</b> <span class="text-gray-400">{{ pais.codigo_moneda }}</span></p>
                  </div>
                </button>
              </li>
            }
          </ul>
        }
      }
    </div>

    <!-- Panel del estudiante -->
    @if (estudiante && pais && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrar()">
        <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-cuenta">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 id="titulo-cuenta" class="text-lg font-bold text-gray-800 break-words">{{ estudiante.nombre }} {{ estudiante.apellido }}</h2>
              <p class="text-sm text-gray-500">
                @if (operacion === 'consignar') { {{ 'wg.cuentas.consignar.ayuda' | translate }} }
                @else if (operacion === 'retirar') { {{ 'wg.cuentas.retirar.ayuda' | translate }} }
                @else { {{ pais.nombre }} }
              </p>
            </div>
            <button type="button" (click)="cerrar()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.cuentas.cerrar' | translate">✕</button>
          </div>

          <div class="flex-1 overflow-y-auto px-5 pb-4">
            @if (!operacion) {
              <div class="flex flex-col sm:flex-row gap-4 items-center sm:items-stretch">
                <!-- Tarjeta en pequeño -->
                <div class="w-full max-w-[300px] aspect-[85.6/54] rounded-2xl p-3 text-white shadow-lg flex gap-3"
                     [style.background]="degradado(pais.color)">
                  <div class="flex-1 min-w-0 flex flex-col">
                    <p class="text-[9px] font-bold tracking-[0.15em] opacity-90">WILL-GO ECONOMY</p>
                    <p class="text-[10px] opacity-80">{{ 'wg.cuentas.tarjetaDebito' | translate }}</p>
                    <p class="mt-auto font-mono font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis" [style.font-size.px]="tamLlave(estudiante.llave)">{{ estudiante.llave }}</p>
                    <p class="text-[11px] opacity-90 truncate">{{ estudiante.nombre }} {{ estudiante.apellido }}</p>
                  </div>
                  @if (estudiante.llave) {
                    <div class="h-full aspect-square bg-white rounded-lg p-1 shrink-0">
                      <wg-qr-llave class="w-full h-full" [llave]="estudiante.llave" [color]="'#0f172a'" />
                    </div>
                  }
                </div>
                <!-- Saldos -->
                <div class="w-full flex-1 grid grid-cols-2 sm:grid-cols-1 gap-3">
                  <div class="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                    <p class="text-xs uppercase tracking-wide text-gray-500 font-semibold">{{ 'wg.cuentas.efectivo' | translate }}</p>
                    <p class="text-xl font-extrabold text-gray-800 break-all">{{ miles(estudiante.efectivo) }} <span class="text-xs font-semibold text-gray-500">{{ pais.codigo_moneda }}</span></p>
                  </div>
                  <div class="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                    <p class="text-xs uppercase tracking-wide text-gray-500 font-semibold">{{ 'wg.cuentas.cuenta' | translate }}</p>
                    <p class="text-xl font-extrabold text-gray-800 break-all">{{ miles(estudiante.cuenta) }} <span class="text-xs font-semibold text-gray-500">{{ pais.codigo_moneda }}</span></p>
                  </div>
                </div>
              </div>
              @if (datos.edicion.estado !== 'abierta') {
                <p class="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">{{ 'wg.cuentas.soloAbierta' | translate }}</p>
              }
            } @else if (operacion === 'consignar') {
              <wg-selector-billetes [pais]="pais" [denominaciones]="datos.denominaciones" [elegidos]="elegidos" [topeTotal]="estudiante.efectivo" (cambio)="refrescar()" />
            } @else {
              <div class="flex flex-wrap items-end gap-2 mb-3">
                <div class="flex-1 min-w-[10rem]">
                  <label for="wg-monto-retiro" class="block text-xs font-semibold text-gray-500 mb-1">{{ 'wg.cuentas.retirar.monto' | translate }}</label>
                  <input id="wg-monto-retiro" wgNumero [(ngModel)]="montoRetiro" placeholder="0"
                         class="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-300">
                </div>
                <button type="button" (click)="sugerir()" [disabled]="!montoRetiroValido"
                        class="h-10 px-3 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">{{ 'wg.cuentas.retirar.sugerir' | translate }}</button>
              </div>
              @if (sugerenciaIncompleta) {
                <p class="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">{{ 'wg.cuentas.retirar.noAlcanza' | translate }}</p>
              }
              <wg-selector-billetes [pais]="pais" [denominaciones]="datos.denominaciones" [elegidos]="elegidos" [topes]="pais.inventario" [topeTotal]="estudiante.cuenta"
                                    [textoTope]="'wg.cuentas.retirar.enBanco' | translate" (cambio)="refrescar()" />
            }
          </div>

          <div class="px-5 py-4 border-t border-gray-100">
            @if (errorPanel) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorPanel }}</p> }
            @if (!operacion) {
              <div class="flex gap-2">
                <button type="button" (click)="empezar('consignar')" [disabled]="datos.edicion.estado !== 'abierta' || estudiante.efectivo <= 0"
                        class="flex-1 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 disabled:opacity-40">{{ 'wg.cuentas.consignar.boton' | translate }}</button>
                <button type="button" (click)="empezar('retirar')" [disabled]="datos.edicion.estado !== 'abierta' || estudiante.cuenta <= 0"
                        class="flex-1 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">{{ 'wg.cuentas.retirar.boton' | translate }}</button>
              </div>
            } @else {
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm text-gray-500">{{ (operacion === 'consignar' ? 'wg.cuentas.consignar.total' : 'wg.cuentas.retirar.total') | translate }}</span>
                <span class="text-2xl font-extrabold text-gray-800 break-all">{{ miles(total) }} <span class="text-sm font-semibold text-gray-500">{{ pais.codigo_moneda }}</span></span>
              </div>
              @if (excede) {
                <p class="mb-3 text-sm text-red-600 font-semibold">{{ (operacion === 'consignar' ? 'wg.cuentas.consignar.excede' : 'wg.cuentas.retirar.excede') | translate: { n: miles(operacion === 'consignar' ? estudiante.efectivo : estudiante.cuenta) } }}</p>
              }
              <div class="flex gap-2">
                <button type="button" (click)="volver()" [disabled]="enviando" class="px-5 py-3.5 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">{{ 'wg.cuentas.volver' | translate }}</button>
                <button type="button" (click)="confirmar()" [disabled]="!total || enviando || excede"
                        class="flex-1 py-3.5 rounded-xl font-bold text-white disabled:opacity-40"
                        [class]="operacion === 'consignar' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-orange-500 to-orange-600'">
                  @if (enviando) { {{ (operacion === 'consignar' ? 'wg.cuentas.consignar.enviando' : 'wg.cuentas.retirar.enviando') | translate }} }
                  @else if (!total) { {{ 'wg.cuentas.eligeBilletes' | translate }} }
                  @else { {{ (operacion === 'consignar' ? 'wg.cuentas.consignar.monto' : 'wg.cuentas.retirar.botonMonto') | translate: { monto: miles(total) } }} }
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class CuentasWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  private router = inject(Router);
  private location = inject(Location);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);

  ediciones: EdicionVigente[] = [];
  edicionId = '';
  datos: DatosCuentas | null = null;
  pais: PaisCuentas | null = null;
  cargando = true;
  error = '';
  aviso = '';
  avisoError = false;
  busqueda = '';

  estudiante: EstudianteCuenta | null = null;
  operacion: Operacion | null = null;
  elegidos: Record<number, number | null> = {};
  montoRetiro: number | null = null;
  sugerenciaIncompleta = false;
  clave = '';
  enviando = false;
  errorPanel = '';
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.willGo.cuentas(this.edicionId).subscribe({
      next: (d) => {
        this.datos = d;
        this.pais = d.paises.find((p) => p.id === this.pais?.id) ?? d.paises[0] ?? null;
        this.cargando = false;
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  get filtrados(): EstudianteCuenta[] {
    const lista = this.pais?.estudiantes ?? [];
    const q = normalizar(this.busqueda);
    if (!q) return lista;
    return lista.filter((e) => normalizar(`${e.nombre} ${e.apellido} ${e.llave ?? ''}`).includes(q));
  }

  /** Degradado con el color del país (más oscuro hacia abajo a la derecha). */
  degradado(color: string | null): string {
    const c = color || '#1e293b';
    return `linear-gradient(135deg, ${c} 0%, color-mix(in srgb, ${c} 65%, #000) 100%)`;
  }

  imprimirTarjetas(): void {
    const url = this.router.serializeUrl(this.router.createUrlTree(['/private-will-go/tarjetas'], { queryParams: { edicion: this.edicionId } }));
    window.open(this.location.prepareExternalUrl(url), '_blank');
  }

  cantidad(d: number): number { return Number(this.elegidos[d]) || 0; }
  get total(): number { return (this.datos?.denominaciones ?? []).reduce((t, d) => t + d * this.cantidad(d), 0); }
  get excede(): boolean {
    const e = this.estudiante;
    if (!e) return false;
    if (this.operacion === 'consignar') return this.total > e.efectivo;
    if (this.operacion === 'retirar') {
      return this.total > e.cuenta || (this.datos?.denominaciones ?? []).some((d) => this.cantidad(d) > Number(this.pais?.inventario?.[d] ?? 0));
    }
    return false;
  }
  get montoRetiroValido(): boolean { const m = Number(this.montoRetiro) || 0; return m > 0 && m <= (this.estudiante?.cuenta ?? 0); }

  /** El selector cambia `elegidos` por dentro; se reasigna para que los getters y la vista se actualicen. */
  refrescar(): void { this.elegidos = { ...this.elegidos }; this.sugerenciaIncompleta = false; }

  abrir(e: EstudianteCuenta): void {
    this.estudiante = e;
    this.operacion = null;
    this.errorPanel = '';
  }

  empezar(op: Operacion): void {
    this.operacion = op;
    this.elegidos = {};
    this.errorPanel = '';
    this.sugerenciaIncompleta = false;
    this.montoRetiro = op === 'retirar' ? (this.estudiante?.cuenta ?? null) : null;
    this.clave = crypto.randomUUID(); // la misma operación no se registra dos veces aunque se toque dos veces
  }

  volver(): void {
    if (this.enviando) return;
    this.operacion = null;
    this.elegidos = {};
    this.errorPanel = '';
  }

  cerrar(): void {
    if (this.enviando) return;
    this.estudiante = null;
    this.operacion = null;
  }

  /** Propone los billetes más grandes que haya en el banco hasta completar el monto. */
  sugerir(): void {
    let falta = Math.min(Number(this.montoRetiro) || 0, this.estudiante?.cuenta ?? 0);
    const pago: Record<number, number | null> = {};
    for (const d of [...(this.datos?.denominaciones ?? [])].sort((a, b) => b - a)) {
      const n = Math.min(Math.floor(falta / d), Number(this.pais?.inventario?.[d] ?? 0));
      if (n > 0) { pago[d] = n; falta -= n * d; }
    }
    this.elegidos = pago;
    this.sugerenciaIncompleta = falta > 0;
  }

  confirmar(): void {
    const e = this.estudiante;
    const op = this.operacion;
    if (!e || !op || !this.total || this.excede || this.enviando) return;
    const billetes: Record<string, number> = {};
    for (const d of this.datos!.denominaciones) if (this.cantidad(d)) billetes[d] = this.cantidad(d);
    this.enviando = true;
    this.errorPanel = '';
    const peticion = op === 'consignar' ? this.willGo.consignar(e.id, billetes, this.clave) : this.willGo.retirarDeCuenta(e.id, billetes, this.clave);
    peticion.subscribe({
      next: (r) => {
        this.enviando = false;
        this.estudiante = null;
        this.operacion = null;
        this.avisoError = false;
        this.aviso = this.t.instant(op === 'consignar' ? 'wg.cuentas.consignar.hecho' : 'wg.cuentas.retirar.hecho', {
          monto: this.miles(r.monto), nombre: e.nombre, cuenta: this.miles(r.cuenta), efectivo: this.miles(r.efectivo),
        });
        if (this.temporizador) clearTimeout(this.temporizador);
        this.temporizador = setTimeout(() => (this.aviso = ''), 6000);
        this.cargar();
      },
      error: (err) => { this.enviando = false; this.errorPanel = WillGoService.mensajeDeError(err); },
    });
  }

  /** Tamaño de letra para que la llave quepa en una línea de la tarjeta. */
  tamLlave(llave: string): number { return Math.min(14, 92 / (0.62 * Math.max(1, llave.length))); }
}
