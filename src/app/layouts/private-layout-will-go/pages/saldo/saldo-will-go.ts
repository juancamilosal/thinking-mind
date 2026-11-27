import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SaldoLlave, WillGoService } from '../../../../core/services/will-go.service';
import { EscanerQrComponent } from '../../escaner-qr.component';
import { formatearNumero } from '../../numero-miles.directive';

type Modo = '' | 'qr' | 'llave';

/** Consultar saldo: cualquier rol escanea el QR de la tarjeta o escribe la llave GO.BANK y ve el nombre y el saldo. */
@Component({
  selector: 'app-saldo-will-go',
  standalone: true,
  imports: [FormsModule, TranslatePipe, EscanerQrComponent],
  template: `
    <div class="max-w-xl mx-auto">
      <img src="assets/images/will-go/gobank-logo.png" alt="GO.BANK · Save · Invest · Grow" class="h-10 w-auto -ml-1 mb-2">
      <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.saldo.titulo' | translate }}</h1>
      <p class="text-gray-500 mt-1">{{ 'wg.saldo.subtitulo' | translate }}</p>

      @if (resultado) {
        <!-- Resultado -->
        <section class="mt-6 rounded-3xl bg-[#001938] text-white shadow-lg overflow-hidden relative">
          <svg class="absolute inset-0 w-full h-full" viewBox="0 0 856 540" preserveAspectRatio="none" aria-hidden="true">
            <path d="M856 330 C 760 440 520 505 200 540 L 856 540 Z" fill="#f47216" />
            <path d="M720 470 C 560 505 380 530 120 540" fill="none" stroke="#5fd32c" stroke-width="3" />
          </svg>
          <div class="relative p-6">
            <p class="text-sm text-slate-300">{{ resultado.pais }}@if (resultado.codigo_moneda) { · {{ resultado.codigo_moneda }} }</p>
            <p class="mt-1 text-2xl font-bold break-words">{{ resultado.nombre }} {{ resultado.apellido }}</p>
            <p class="text-sm font-semibold text-orange-300 break-all">{{ resultado.llave }}</p>
            <p class="mt-5 text-xs uppercase tracking-widest text-slate-300">{{ 'wg.saldo.enCuenta' | translate }}</p>
            <p class="text-4xl font-extrabold break-all">{{ miles(resultado.cuenta) }} <span class="text-lg font-semibold text-slate-300">{{ resultado.codigo_moneda }}</span></p>
            <p class="mt-3 text-sm text-slate-200">💵 {{ 'wg.saldo.enEfectivo' | translate }}: <b>{{ miles(resultado.efectivo) }} {{ resultado.codigo_moneda }}</b></p>
          </div>
        </section>
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" (click)="otra()" class="py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110">{{ 'wg.saldo.consultarOtro' | translate }}</button>
          <button type="button" (click)="volver()" class="py-3 rounded-xl border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50">{{ 'wg.saldo.volver' | translate }}</button>
        </div>
      } @else if (!modo) {
        <!-- Elegir cómo consultar -->
        <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button type="button" (click)="elegir('qr')" class="text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-orange-300 hover:shadow transition">
            <span class="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center" aria-hidden="true">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg>
            </span>
            <p class="mt-4 text-lg font-bold text-gray-800">{{ 'wg.saldo.qr' | translate }}</p>
            <p class="text-sm text-gray-500">{{ 'wg.saldo.qrAyuda' | translate }}</p>
          </button>
          <button type="button" (click)="elegir('llave')" class="text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:border-emerald-300 hover:shadow transition">
            <span class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center" aria-hidden="true">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
            </span>
            <p class="mt-4 text-lg font-bold text-gray-800">{{ 'wg.saldo.llave' | translate }}</p>
            <p class="text-sm text-gray-500">{{ 'wg.saldo.llaveAyuda' | translate }}</p>
          </button>
        </div>
      } @else {
        <section class="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-bold text-gray-800">{{ (modo === 'qr' ? 'wg.saldo.qr' : 'wg.saldo.llave') | translate }}</h2>
            <button type="button" (click)="volver()" class="text-sm font-semibold text-gray-500 hover:text-gray-800">{{ 'wg.saldo.volver' | translate }}</button>
          </div>
          @if (modo === 'qr') {
            <p class="mt-1 text-sm text-gray-500">{{ 'wg.saldo.qrAyuda' | translate }}</p>
            <div class="mt-4"><wg-escaner-qr [activo]="!buscando" (leido)="consultar($event)" /></div>
          } @else {
            <form class="mt-4 flex flex-col sm:flex-row gap-2" (ngSubmit)="consultar(llave)">
              <input name="llave" [(ngModel)]="llave" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="@nombre.apellido"
                     [attr.aria-label]="'wg.saldo.llave' | translate"
                     class="flex-1 min-w-0 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <button type="submit" [disabled]="buscando || !llave.trim()" class="px-6 py-3 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                {{ (buscando ? 'wg.saldo.buscando' : 'wg.saldo.consultar') | translate }}
              </button>
            </form>
          }
          @if (buscando && modo === 'qr') { <p class="mt-3 text-sm text-gray-500 text-center" role="status">{{ 'wg.saldo.buscando' | translate }}</p> }
          @if (error) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p> }
        </section>
      }
    </div>
  `,
})
export class SaldoWillGo {
  private willGo = inject(WillGoService);
  readonly miles = (v: unknown) => formatearNumero(v as number);

  modo: Modo = '';
  llave = '';
  buscando = false;
  error = '';
  resultado: SaldoLlave | null = null;

  elegir(m: Modo): void { this.modo = m; this.error = ''; this.llave = ''; }
  volver(): void { this.modo = ''; this.resultado = null; this.error = ''; this.llave = ''; }
  /** Otra consulta con el mismo método. */
  otra(): void { const m = this.modo; this.volver(); this.modo = m; }

  consultar(texto: string): void {
    const llave = String(texto ?? '').trim();
    if (!llave || this.buscando) return;
    this.buscando = true;
    this.error = '';
    this.willGo.saldoPorLlave(llave).subscribe({
      next: (r) => { this.buscando = false; this.resultado = r; },
      error: (e) => { this.buscando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
