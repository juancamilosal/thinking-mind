import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FechaWillGoPipe } from '../../fecha.pipe';
import { DatosReparto, DocenteReparto, PaisReparto, WillGoService, EdicionVigente } from '../../../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from '../../numero-miles.directive';

/** Repartir a docentes: el banco entrega dinero de su país (en efectivo o por transferencia) a los docentes del equipo. */
@Component({
  selector: 'app-repartir-will-go',
  standalone: true,
  imports: [FormsModule, TranslatePipe, FechaWillGoPipe, NumeroMilesDirective, SelectorEdicionComponent],
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <img src="assets/images/will-go/gobank-logo.png" alt="GO.BANK · Save · Invest · Grow" class="h-10 w-auto max-w-full -ml-1 mb-2">
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
          <!-- Celular: un saldo debajo del otro. Desde tableta: lado a lado -->
          <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p class="text-sm opacity-90 whitespace-nowrap">💵 {{ 'wg.banco.repartir.efectivo' | translate }}</p>
              <p class="text-2xl sm:text-3xl font-extrabold whitespace-nowrap">{{ miles(pais.saldo_banco) }} <span class="text-sm font-semibold opacity-90">{{ pais.codigo_moneda }}</span></p>
            </div>
            <div class="border-t sm:border-t-0 sm:border-l border-white/30 pt-3 sm:pt-0 sm:pl-4">
              <p class="text-sm opacity-90 whitespace-nowrap">💳 {{ 'wg.banco.repartir.virtual' | translate }}</p>
              <p class="text-2xl sm:text-3xl font-extrabold whitespace-nowrap">{{ miles(pais.saldo_virtual ?? 0) }} <span class="text-sm font-semibold opacity-90">{{ pais.codigo_moneda }}</span></p>
            </div>
          </div>
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
          <input type="search" [(ngModel)]="buscarDocente" [placeholder]="'wg.montobanco.buscarDocente' | translate" [attr.aria-label]="'wg.montobanco.buscarDocente' | translate"
                 class="w-full mb-3 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
          @if (!docentesFiltrados(pais).length) {
            <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600">{{ 'wg.montobanco.sinResultados' | translate }}</div>
          }
          <ul class="space-y-3" [class.hidden]="!docentesFiltrados(pais).length">
            @for (d of docentesFiltrados(pais); track d.id) {
              <!-- Celular: nombre y saldos a todo lo ancho, y el botón debajo. Desde tableta: el botón a la derecha -->
              <li class="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div class="flex items-start gap-3 min-w-0 flex-1">
                  <div class="w-11 h-11 shrink-0 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center">{{ (d.nombre[0] || '') + (d.apellido[0] || '') }}</div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-gray-800 leading-snug">{{ d.nombre }} {{ d.apellido }}</p>
                    <div class="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">💵 <b class="text-gray-800">{{ miles(d.saldo) }}</b></span>
                      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">💳 <b class="text-gray-800">{{ miles(d.cuenta) }}</b></span>
                      <span class="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{{ 'wg.banco.repartir.recibio' | translate: { n: miles(d.recibido) } }}</span>
                    </div>
                  </div>
                </div>
                <button type="button" (click)="abrir(d)" [disabled]="datos.edicion.estado !== 'abierta'"
                        class="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">{{ 'wg.banco.repartir.entregar' | translate }}</button>
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
                <div class="flex items-start justify-between gap-3">
                  <p class="font-semibold text-gray-800 leading-snug min-w-0">{{ e.nombre }} {{ e.apellido }}</p>
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
                  <p class="text-xs text-gray-500">{{ e.date_created | wgFecha:'d MMM, h:mm a' }}</p>
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
        <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-entrega">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-entrega" class="text-lg font-bold text-gray-800">{{ 'wg.banco.repartir.entregarA' | translate: { nombre: docente.nombre + ' ' + docente.apellido } }}</h2>
              <p class="text-sm text-gray-500">{{ (medio === 'efectivo' ? 'wg.montobanco.ayudaEfectivo' : 'wg.transferir.ayudaDocente') | translate }}</p>
            </div>
            <button type="button" (click)="cerrar()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.banco.cerrar' | translate">✕</button>
          </div>
          <div class="px-5 pb-3">
            <div class="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1" role="tablist">
              <button type="button" role="tab" [attr.aria-selected]="medio === 'efectivo'" (click)="cambiarMedio('efectivo')" [disabled]="enviando"
                      class="py-2 rounded-lg text-sm font-semibold" [class]="medio === 'efectivo' ? 'bg-white shadow text-gray-800' : 'text-gray-500'">💵 {{ 'wg.montobanco.efectivo' | translate }}</button>
              <button type="button" role="tab" [attr.aria-selected]="medio === 'transferencia'" (click)="cambiarMedio('transferencia')" [disabled]="enviando"
                      class="py-2 rounded-lg text-sm font-semibold" [class]="medio === 'transferencia' ? 'bg-white shadow text-gray-800' : 'text-gray-500'">{{ 'wg.transferir.transferencia' | translate }}</button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto px-5">
            <div class="pb-4">
              <label for="monto-transferir" class="block text-sm font-semibold text-gray-700">{{ (medio === 'efectivo' ? 'wg.montobanco.montoEntregar' : 'wg.transferir.monto') | translate }}</label>
              <input id="monto-transferir" wgNumero [(ngModel)]="monto" placeholder="0"
                     class="mt-1.5 w-full px-4 py-3 text-2xl font-extrabold bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
              <p class="mt-1.5 text-xs" [class]="excedeMonto ? 'text-red-600 font-semibold' : 'text-gray-500'">
                {{ (medio === 'efectivo' ? 'wg.montobanco.disponibleEfectivo' : 'wg.transferir.disponibleVirtual') | translate: { n: miles(disponible) } }}
              </p>
              @if (medio === 'efectivo') {
                <p class="mt-3 text-xs text-gray-500">{{ 'wg.montobanco.tieneEfectivo' | translate: { n: miles(docente.saldo) } }}</p>
              } @else {
                <p class="mt-3 text-xs text-gray-500">{{ 'wg.transferir.cuentaActual' | translate: { n: miles(docente.cuenta) } }}</p>
              }
            </div>
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            @if (errorEntrega) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorEntrega }}</p> }
            <button type="button" (click)="enviar()" [disabled]="!montoValido || enviando"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              @if (medio === 'efectivo') {
                {{ enviando ? ('wg.banco.repartir.entregando' | translate) : (montoNum ? ('wg.banco.repartir.entregarMonto' | translate: { monto: miles(montoNum) }) : ('wg.transferir.escribeMonto' | translate)) }}
              } @else {
                {{ enviando ? ('wg.transferir.transfiriendo' | translate) : (montoNum ? ('wg.transferir.transferirMonto' | translate: { n: miles(montoNum) }) : ('wg.transferir.escribeMonto' | translate)) }}
              }
            </button>
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
  clave = '';
  enviando = false;
  errorEntrega = '';
  /** Cómo se le da el dinero al docente: efectivo en la mano o transferencia a su cuenta. */
  medio: 'efectivo' | 'transferencia' = 'efectivo';
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

  get montoNum(): number { return Number(this.monto) || 0; }
  /** Lo que el banco puede dar: el efectivo del banco o el saldo de su cuenta virtual. */
  get disponible(): number { return Number((this.medio === 'efectivo' ? this.pais?.saldo_banco : this.pais?.saldo_virtual) ?? 0); }
  get excedeMonto(): boolean { return this.montoNum > this.disponible; }
  get montoValido(): boolean { return this.montoNum > 0 && !this.excedeMonto; }

  cambiarMedio(m: 'efectivo' | 'transferencia'): void {
    if (this.medio === m) return;
    this.medio = m;
    this.errorEntrega = '';
    this.clave = crypto.randomUUID(); // otra operación, otra clave
  }

  abrir(d: DocenteReparto): void {
    this.docente = d;
    this.monto = null;
    this.medio = 'efectivo';
    this.errorEntrega = '';
    this.clave = crypto.randomUUID(); // la misma entrega no se registra dos veces aunque se toque dos veces
  }

  cerrar(): void {
    if (!this.enviando) this.docente = null;
  }

  enviar(): void {
    if (this.medio === 'efectivo') this.entregar(); else this.transferir();
  }

  /** Entrega en efectivo: el banco solo registra el valor (los billetes físicos no se detallan). */
  entregar(): void {
    if (!this.docente || !this.pais || !this.montoValido) return;
    const docente = this.docente;
    this.enviando = true;
    this.errorEntrega = '';
    this.willGo.entregarADocente(this.pais.id, docente.id, this.montoNum, this.clave).subscribe({
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

  /** Buscador de la lista de docentes (por nombre, sin importar tildes ni mayúsculas). */
  buscarDocente = '';
  docentesFiltrados(p: PaisReparto): PaisReparto['docentes'] {
    const q = this.sinTildes(this.buscarDocente.trim());
    if (!q) return p.docentes;
    return p.docentes.filter((d) => this.sinTildes(`${d.nombre} ${d.apellido}`).includes(q));
  }
  private sinTildes(t: string): string { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
}
