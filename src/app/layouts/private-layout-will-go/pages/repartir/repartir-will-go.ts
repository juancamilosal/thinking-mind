import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FechaWillGoPipe } from '../../fecha.pipe';
import { DatosReparto, DocenteReparto, EntregaReparto, PaisReparto, WillGoService, EdicionVigente } from '../../../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from '../../numero-miles.directive';
import { imagenBillete } from '../../imagen-billete';

/** Repartir a docentes: el banco entrega billetes de su país a los docentes del equipo. */
@Component({
  selector: 'app-repartir-will-go',
  standalone: true,
  imports: [FormsModule, TranslatePipe, FechaWillGoPipe, NumeroMilesDirective, SelectorEdicionComponent],
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.banco.repartir.titulo' | translate }}</h1>
          <p class="text-gray-500 mt-1">{{ 'wg.banco.repartir.subtitulo' | translate }}</p>
        </div>
      </div>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" (cambio)="cargar()" />

      @if (cargando) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.banco.cargando' | translate }}</div>
      } @else if (error) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!datos?.paises?.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.banco.sinPais' | translate }}</div>
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

        <!-- Banco -->
        <div class="mt-4 rounded-2xl p-5 text-white shadow" [style.background]="pais.color || '#1e293b'">
          <p class="text-sm opacity-90">{{ 'wg.banco.repartir.bancoDe' | translate: { pais: pais.nombre } }}</p>
          <p class="text-3xl font-extrabold mt-1 break-all">{{ miles(pais.saldo_banco) }} <span class="text-base font-semibold opacity-90">{{ pais.codigo_moneda }}</span></p>
          @if (datos.edicion.estado !== 'abierta') {
            <p class="text-sm mt-2 bg-white/20 rounded-lg px-3 py-1.5 inline-block">{{ 'wg.banco.repartir.soloAbierta' | translate }}</p>
          }
        </div>

        @if (aviso) {
          <p class="mt-3 rounded-xl px-4 py-3 text-sm" [class]="avisoError ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'" role="status">{{ aviso }}</p>
        }

        <!-- Docentes -->
        <h2 class="font-bold text-gray-800 mt-6 mb-3">{{ 'wg.banco.repartir.docentes' | translate }}</h2>
        @if (!pais.docentes.length) {
          <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">{{ 'wg.banco.repartir.sinDocentes' | translate: { pais: pais.nombre } }}</div>
        } @else {
          <ul class="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            @for (d of pais.docentes; track d.id) {
              <li class="flex items-center gap-3 px-4 py-3">
                <div class="w-11 h-11 shrink-0 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center">{{ (d.nombre[0] || '') + (d.apellido[0] || '') }}</div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-gray-800 truncate">{{ d.nombre }} {{ d.apellido }}</p>
                  <p class="text-xs text-gray-500">{{ 'wg.banco.tiene' | translate }} <b class="text-gray-700">{{ miles(d.saldo) }}</b> · {{ 'wg.transferir.cuenta' | translate }} <b class="text-gray-700">{{ miles(d.cuenta) }}</b> · {{ 'wg.banco.repartir.recibio' | translate: { n: miles(d.recibido) } }}</p>
                </div>
                <button type="button" (click)="abrir(d)" [disabled]="datos.edicion.estado !== 'abierta'"
                        class="shrink-0 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">{{ 'wg.banco.repartir.entregar' | translate }}</button>
              </li>
            }
          </ul>
        }

        <!-- Últimas entregas -->
        <h2 class="font-bold text-gray-800 mt-6 mb-3">{{ 'wg.banco.repartir.ultimasEntregas' | translate }}</h2>
        @if (!pais.entregas.length) {
          <p class="text-sm text-gray-500">{{ 'wg.banco.repartir.sinEntregas' | translate }}</p>
        } @else {
          <ul class="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            @for (e of pais.entregas; track e.id) {
              <li class="px-4 py-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="font-semibold text-gray-800 truncate">{{ e.nombre }} {{ e.apellido }}</p>
                  <p class="font-bold text-gray-800 whitespace-nowrap">{{ miles(e.monto) }}</p>
                </div>
                @if (e.medio === 'transferencia') {
                  <p class="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                    <span class="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 text-sky-800 px-1.5 py-0.5 font-semibold">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4"/></svg>
                      {{ 'wg.transferir.etiqueta' | translate }}
                    </span>
                    <span>{{ e.date_created | wgFecha:'d MMM, h:mm a' }}</span>
                  </p>
                } @else {
                  <p class="text-xs text-gray-500">{{ e.date_created | wgFecha:'d MMM, h:mm a' }}{{ detalle(e) ? ' · ' + detalle(e) : '' }}</p>
                }
              </li>
            }
          </ul>
        }
      }
    </div>

    <!-- Panel para entregar -->
    @if (docente && pais && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrar()">
        <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-entrega">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-entrega" class="text-lg font-bold text-gray-800">{{ 'wg.banco.repartir.entregarA' | translate: { nombre: docente.nombre + ' ' + docente.apellido } }}</h2>
              <p class="text-sm text-gray-500">{{ (medio === 'billetes' ? 'wg.banco.repartir.tocaBilletes' : 'wg.transferir.ayudaDocente') | translate }}</p>
            </div>
            <button type="button" (click)="cerrar()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.banco.cerrar' | translate">✕</button>
          </div>
          <div class="px-5 pb-3">
            <div class="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1" role="tablist">
              <button type="button" role="tab" [attr.aria-selected]="medio === 'billetes'" (click)="cambiarMedio('billetes')" [disabled]="enviando"
                      class="py-2 rounded-lg text-sm font-semibold" [class]="medio === 'billetes' ? 'bg-white shadow text-gray-800' : 'text-gray-500'">{{ 'wg.transferir.enBilletes' | translate }}</button>
              <button type="button" role="tab" [attr.aria-selected]="medio === 'transferencia'" (click)="cambiarMedio('transferencia')" [disabled]="enviando"
                      class="py-2 rounded-lg text-sm font-semibold" [class]="medio === 'transferencia' ? 'bg-white shadow text-gray-800' : 'text-gray-500'">{{ 'wg.transferir.transferencia' | translate }}</button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto px-5">
            @if (medio === 'transferencia') {
              <div class="pb-4">
                <label for="monto-transferir" class="block text-sm font-semibold text-gray-700">{{ 'wg.transferir.monto' | translate }}</label>
                <input id="monto-transferir" wgNumero [(ngModel)]="monto" placeholder="0"
                       class="mt-1.5 w-full px-4 py-3 text-2xl font-extrabold bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
                <p class="mt-1.5 text-xs" [class]="excedeMonto ? 'text-red-600 font-semibold' : 'text-gray-500'">{{ 'wg.transferir.disponibleBanco' | translate: { n: miles(pais.saldo_banco) } }}</p>
                <p class="mt-3 text-xs text-gray-500">{{ 'wg.transferir.cuentaActual' | translate: { n: miles(docente.cuenta) } }}</p>
              </div>
            } @else {
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3">
              @for (d of datos.denominaciones; track d) {
                <div class="rounded-xl border-2 overflow-hidden" [style.border-color]="cantidad(d) ? (pais.color || '#f97316') : '#e5e7eb'" [class.opacity-40]="quedan(d) <= 0">
                  <button type="button" class="block w-full" (click)="sumar(d, 1)" [disabled]="quedan(d) - cantidad(d) <= 0" [attr.aria-label]="'wg.banco.agregarBillete' | translate: { valor: miles(d) }">
                    @if (imagen(d); as src) {
                      <img [src]="src" [alt]="'wg.banco.billeteDe' | translate: { valor: miles(d) }" class="w-full aspect-[520/281] object-cover">
                    } @else {
                      <div class="w-full aspect-[520/281] flex items-center justify-center text-xl font-black text-white" [style.background]="pais.color || '#64748b'">{{ miles(d) }}</div>
                    }
                  </button>
                  <div class="flex items-center gap-1 p-1.5">
                    <button type="button" (click)="sumar(d, -1)" [disabled]="!cantidad(d)" class="w-9 h-9 shrink-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'wg.banco.quitarBillete' | translate: { valor: miles(d) }">−</button>
                    <input wgNumero [ngModel]="elegidos[d]" (ngModelChange)="poner(d, $event)" placeholder="0" [attr.aria-label]="'wg.banco.billetesDe' | translate: { valor: miles(d) }"
                           class="w-full min-w-0 h-9 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-300">
                    <button type="button" (click)="sumar(d, 1)" [disabled]="quedan(d) - cantidad(d) <= 0" class="w-9 h-9 shrink-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'wg.banco.agregarBillete' | translate: { valor: miles(d) }">+</button>
                  </div>
                  <p class="text-[11px] text-center pb-1.5" [class]="cantidad(d) > quedan(d) ? 'text-red-600 font-semibold' : 'text-gray-500'">{{ 'wg.banco.quedan' | translate: { n: miles(quedan(d)) } }}</p>
                </div>
              }
            </div>
            }
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            @if (errorEntrega) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorEntrega }}</p> }
            @if (medio === 'transferencia') {
              <button type="button" (click)="transferir()" [disabled]="!montoValido || enviando"
                      class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
                {{ enviando ? ('wg.transferir.transfiriendo' | translate) : (montoNum ? ('wg.transferir.transferirMonto' | translate: { n: miles(montoNum) }) : ('wg.transferir.escribeMonto' | translate)) }}
              </button>
            } @else {
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm text-gray-500">{{ 'wg.banco.repartir.totalEntregar' | translate }}</span>
              <span class="text-2xl font-extrabold text-gray-800 break-all">{{ miles(total) }} <span class="text-sm font-semibold text-gray-500">{{ pais.codigo_moneda }}</span></span>
            </div>
            <button type="button" (click)="entregar()" [disabled]="!total || enviando || excede"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              {{ enviando ? ('wg.banco.repartir.entregando' | translate) : (total ? ('wg.banco.repartir.entregarMonto' | translate: { monto: miles(total) }) : ('wg.banco.eligeBilletes' | translate)) }}
            </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class RepartirWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);

  ediciones: EdicionVigente[] = [];
  edicionId = '';
  datos: DatosReparto | null = null;
  pais: PaisReparto | null = null;
  cargando = true;
  error = '';
  aviso = '';
  avisoError = false;

  docente: DocenteReparto | null = null;
  elegidos: Record<number, number | null> = {};
  clave = '';
  enviando = false;
  errorEntrega = '';
  /** Cómo se le da el dinero al docente: billetes en la mano o transferencia a su cuenta. */
  medio: 'billetes' | 'transferencia' = 'billetes';
  monto: number | null = null;

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  cargar(): void {
    this.cargando = true;
    this.willGo.reparto(this.edicionId).subscribe({
      next: (d) => {
        this.datos = d;
        this.pais = d.paises.find((p) => p.id === this.pais?.id) ?? d.paises[0] ?? null;
        this.cargando = false;
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  imagen(d: number): string | null { return imagenBillete(this.pais ?? undefined, d); }
  quedan(d: number): number { return Number(this.pais?.inventario?.[d] ?? 0); }
  cantidad(d: number): number { return Number(this.elegidos[d]) || 0; }
  get total(): number { return (this.datos?.denominaciones ?? []).reduce((t, d) => t + d * this.cantidad(d), 0); }
  get excede(): boolean { return (this.datos?.denominaciones ?? []).some((d) => this.cantidad(d) > this.quedan(d)) || this.total > (this.pais?.saldo_banco ?? 0); }

  sumar(d: number, n: number): void { this.elegidos[d] = Math.max(0, Math.min(this.cantidad(d) + n, Math.max(this.quedan(d), 0))); }
  poner(d: number, v: number | null): void { this.elegidos[d] = v; }

  detalle(e: EntregaReparto): string {
    const b = (typeof e.billetes === 'string' ? JSON.parse(e.billetes) : e.billetes) ?? {};
    return Object.entries(b).sort((x, y) => Number(y[0]) - Number(x[0])).map(([d, n]) => this.t.instant('wg.banco.repartir.detalleBilletes', { n, valor: this.miles(Number(d)) })).join(', ');
  }

  get montoNum(): number { return Number(this.monto) || 0; }
  get excedeMonto(): boolean { return this.montoNum > Number(this.pais?.saldo_banco ?? 0); }
  get montoValido(): boolean { return this.montoNum > 0 && !this.excedeMonto; }

  cambiarMedio(m: 'billetes' | 'transferencia'): void {
    if (this.medio === m) return;
    this.medio = m;
    this.errorEntrega = '';
    this.clave = crypto.randomUUID(); // otra operación, otra clave
  }

  abrir(d: DocenteReparto): void {
    this.docente = d;
    this.elegidos = {};
    this.monto = null;
    this.medio = 'billetes';
    this.errorEntrega = '';
    this.clave = crypto.randomUUID(); // la misma entrega no se registra dos veces aunque se toque dos veces
  }

  cerrar(): void {
    if (!this.enviando) this.docente = null;
  }

  entregar(): void {
    if (!this.docente || !this.pais || !this.total || this.excede) return;
    const billetes: Record<string, number> = {};
    for (const d of this.datos!.denominaciones) if (this.cantidad(d)) billetes[d] = this.cantidad(d);
    const docente = this.docente;
    this.enviando = true;
    this.errorEntrega = '';
    this.willGo.entregarADocente(this.pais.id, docente.id, billetes, this.clave).subscribe({
      next: (r) => {
        this.enviando = false;
        this.docente = null;
        this.avisoError = false;
        this.aviso = this.t.instant('wg.banco.repartir.entregaste', { monto: this.miles(r.monto), nombre: docente.nombre });
        setTimeout(() => (this.aviso = ''), 5000);
        this.cargar();
      },
      error: (e) => { this.enviando = false; this.errorEntrega = WillGoService.mensajeDeError(e); },
    });
  }

  transferir(): void {
    if (!this.docente || !this.pais || !this.montoValido) return;
    const docente = this.docente;
    this.enviando = true;
    this.errorEntrega = '';
    this.willGo.transferirADocente(this.pais.id, docente.id, this.montoNum, this.clave).subscribe({
      next: (r) => {
        this.enviando = false;
        this.docente = null;
        this.avisoError = false;
        this.aviso = this.t.instant('wg.transferir.transferisteDocente', { monto: this.miles(r.monto), nombre: docente.nombre });
        setTimeout(() => (this.aviso = ''), 5000);
        this.cargar();
      },
      error: (e) => { this.enviando = false; this.errorEntrega = WillGoService.mensajeDeError(e); },
    });
  }
}
