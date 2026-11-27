import { Component, DOCUMENT, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SaldoLlave, WillGoService } from '../../../../core/services/will-go.service';
import { EscanerQrComponent } from '../../escaner-qr.component';
import { formatearNumero } from '../../numero-miles.directive';

type Modo = '' | 'qr' | 'llave';
/** Se recuerda en el dispositivo hasta que se desmarque. */
const PANTALLA_COMPLETA = 'wg_saldo_pantalla_completa';

/** Consultar saldo: cualquier rol escanea el QR de la tarjeta o escribe la llave GO.BANK y ve el nombre y el saldo. */
@Component({
  selector: 'app-saldo-will-go',
  standalone: true,
  imports: [FormsModule, TranslatePipe, EscanerQrComponent],
  template: `
    <!-- Pantalla completa: solo la consulta, encima de todo (para dejar el dispositivo a los clientes) -->
    <div [class]="completa ? 'fixed inset-0 z-[70] overflow-y-auto bg-gradient-to-br from-[#001938] via-[#0b2a55] to-[#001938] text-white' : ''">
      <div class="mx-auto" [class]="completa ? 'max-w-3xl px-5 py-6 min-h-full flex flex-col' : 'max-w-2xl'">

        <!-- Encabezado (en el modo QR solo se ve la cámara) -->
        @if (modo !== 'qr' || resultado) {
        <div class="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="min-w-0">
            @if (completa) {
              <div class="inline-block bg-white rounded-2xl px-3 py-2 shadow"><img src="assets/images/will-go/gobank-logo.png" alt="GO.BANK" class="h-9 sm:h-11 w-auto"></div>
              <h1 class="mt-4 text-3xl sm:text-4xl font-extrabold">{{ 'wg.saldo.tituloCliente' | translate }}</h1>
              <p class="mt-1 text-slate-300 sm:text-lg">{{ 'wg.saldo.subtituloCliente' | translate }}</p>
            } @else {
              <img src="assets/images/will-go/gobank-logo.png" alt="GO.BANK · Save · Invest · Grow" class="h-10 w-auto -ml-1 mb-2">
              <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.saldo.titulo' | translate }}</h1>
              <p class="text-gray-500 mt-1">{{ 'wg.saldo.subtitulo' | translate }}</p>
            }
          </div>
          <!-- Pantalla completa (modo consulta) -->
          <label class="self-end sm:self-auto shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer select-none text-sm font-semibold"
                 [class]="completa ? 'border-white/20 bg-white/10 text-white' : 'border-gray-200 bg-white text-gray-700 shadow-sm'">
            <input type="checkbox" [checked]="completa" (change)="alternarCompleta($any($event.target).checked)" class="w-4 h-4 accent-orange-500">
            {{ 'wg.saldo.pantallaCompleta' | translate }}
          </label>
        </div>
        @if (!completa) { <p class="mt-2 text-xs text-gray-500">{{ 'wg.saldo.pantallaCompletaAyuda' | translate }}</p> }
        }

        <div [class]="completa ? 'flex-1 flex flex-col justify-center py-6' : ''">
        @if (resultado) {
          <!-- Resultado (vuelve solo a las tarjetas en 10 s) -->
          <section class="mt-6 rounded-3xl bg-[#001938] text-white shadow-2xl overflow-hidden relative ring-1 ring-white/10">
            <svg class="absolute inset-0 w-full h-full" viewBox="0 0 856 540" preserveAspectRatio="none" aria-hidden="true">
              <path d="M856 330 C 760 440 520 505 200 540 L 856 540 Z" fill="#f47216" />
              <path d="M720 470 C 560 505 380 530 120 540" fill="none" stroke="#5fd32c" stroke-width="3" />
            </svg>
            <button type="button" (click)="cerrar()" class="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-xl" [attr.aria-label]="'wg.saldo.cerrar' | translate">✕</button>
            <div class="relative p-6 sm:p-8">
              <p class="text-sm text-slate-300">{{ resultado.pais }}@if (resultado.codigo_moneda) { · {{ resultado.codigo_moneda }} }</p>
              <p class="mt-1 text-2xl sm:text-3xl font-bold break-words pr-10">{{ resultado.nombre }} {{ resultado.apellido }}</p>
              <p class="text-sm font-semibold text-orange-300 break-all">{{ resultado.llave }}</p>
              <p class="mt-6 text-xs uppercase tracking-widest text-slate-300">{{ 'wg.saldo.enCuenta' | translate }}</p>
              <p class="text-5xl sm:text-6xl font-extrabold break-all">{{ miles(resultado.cuenta) }} <span class="text-xl font-semibold text-slate-300">{{ resultado.codigo_moneda }}</span></p>
              <p class="mt-3 text-sm sm:text-base text-slate-200">💵 {{ 'wg.saldo.enEfectivo' | translate }}: <b>{{ miles(resultado.efectivo) }} {{ resultado.codigo_moneda }}</b></p>
            </div>
          </section>
          <button type="button" (click)="cerrar()" class="mt-4 w-full py-4 rounded-2xl font-bold text-lg text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg hover:brightness-110">
            {{ 'wg.saldo.cerrar' | translate }} · {{ 'wg.saldo.vuelveEn' | translate: { n: restante } }}
          </button>
          <div class="mt-2 h-1.5 rounded-full overflow-hidden" [class]="completa ? 'bg-white/15' : 'bg-gray-200'">
            <div class="h-full bg-orange-500 transition-all duration-1000 ease-linear" [style.width.%]="restante * 10"></div>
          </div>
        } @else if (!modo) {
          <!-- Las dos opciones, grandes y llamativas -->
          <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <button type="button" (click)="elegir('qr')"
                    class="group relative overflow-hidden text-left rounded-3xl p-6 sm:p-7 min-h-[13rem] text-white shadow-xl bg-gradient-to-br from-orange-500 via-orange-600 to-[#c2410c] hover:-translate-y-0.5 hover:shadow-2xl transition">
              <span class="absolute -right-8 -bottom-10 w-44 h-44 rounded-full bg-white/10"></span>
              <span class="absolute right-10 -top-8 w-24 h-24 rounded-full bg-white/10"></span>
              <span class="relative w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center" aria-hidden="true">
                <svg class="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg>
              </span>
              <p class="relative mt-5 text-2xl font-extrabold">{{ 'wg.saldo.qr' | translate }}</p>
              <p class="relative text-orange-50">{{ 'wg.saldo.qrCliente' | translate }}</p>
              <span class="relative mt-4 inline-flex items-center gap-1 text-sm font-bold">{{ 'wg.saldo.empezar' | translate }} <span class="transition group-hover:translate-x-1">→</span></span>
            </button>
            <button type="button" (click)="elegir('llave')"
                    class="group relative overflow-hidden text-left rounded-3xl p-6 sm:p-7 min-h-[13rem] text-white shadow-xl bg-gradient-to-br from-emerald-500 via-green-600 to-[#166534] hover:-translate-y-0.5 hover:shadow-2xl transition">
              <span class="absolute -right-8 -bottom-10 w-44 h-44 rounded-full bg-white/10"></span>
              <span class="absolute right-10 -top-8 w-24 h-24 rounded-full bg-white/10"></span>
              <span class="relative w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center" aria-hidden="true">
                <svg class="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
              </span>
              <p class="relative mt-5 text-2xl font-extrabold">{{ 'wg.saldo.llave' | translate }}</p>
              <p class="relative text-emerald-50">{{ 'wg.saldo.llaveCliente' | translate }}</p>
              <span class="relative mt-4 inline-flex items-center gap-1 text-sm font-bold">{{ 'wg.saldo.empezar' | translate }} <span class="transition group-hover:translate-x-1">→</span></span>
            </button>
          </div>
        } @else {
          @if (modo === 'qr') {
            <!-- Solo la cámara, con la X para volver -->
            <div class="relative">
              <button type="button" (click)="cerrar()" class="absolute top-3 right-3 z-10 w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center text-xl" [attr.aria-label]="'wg.saldo.cerrar' | translate">✕</button>
              <wg-escaner-qr [activo]="!buscando" [soloCamara]="true" (leido)="consultar($event)" />
              @if (error) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p> }
            </div>
          } @else {
          <section class="mt-6 rounded-3xl shadow-xl p-5 sm:p-6" [class]="completa ? 'bg-white text-gray-800' : 'bg-white border border-gray-200'">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-xl font-bold text-gray-800">{{ 'wg.saldo.llave' | translate }}</h2>
              <button type="button" (click)="cerrar()" class="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600" [attr.aria-label]="'wg.saldo.cerrar' | translate">✕</button>
            </div>
              <form class="mt-4 flex flex-col sm:flex-row gap-2" (ngSubmit)="consultar(llave)">
                <input name="llave" [(ngModel)]="llave" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="@nombre.apellido"
                       [attr.aria-label]="'wg.saldo.llave' | translate"
                       class="flex-1 min-w-0 px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-xl font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                <button type="submit" [disabled]="buscando || !llave.trim()" class="px-7 py-4 rounded-2xl font-bold text-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                  {{ (buscando ? 'wg.saldo.buscando' : 'wg.saldo.consultar') | translate }}
                </button>
              </form>
            @if (error) { <p class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">{{ error }}</p> }
          </section>
          }
        }
        </div>
      </div>
    </div>
  `,
})
export class SaldoWillGo implements OnInit, OnDestroy {
  private willGo = inject(WillGoService);
  private documento = inject(DOCUMENT);
  readonly miles = (v: unknown) => formatearNumero(v as number);

  modo: Modo = '';
  llave = '';
  buscando = false;
  error = '';
  resultado: SaldoLlave | null = null;

  /** Pantalla completa: solo la consulta, para dejar el dispositivo a los clientes. Se recuerda hasta desmarcarla. */
  completa = false;
  /** Segundos que faltan para volver solo a las tarjetas tras mostrar un saldo. */
  restante = 10;
  private reloj: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    try { this.completa = localStorage.getItem(PANTALLA_COMPLETA) === '1'; } catch { /* sin almacenamiento */ }
  }

  ngOnDestroy(): void { this.pararReloj(); }

  alternarCompleta(si: boolean): void {
    this.completa = si;
    try { if (si) localStorage.setItem(PANTALLA_COMPLETA, '1'); else localStorage.removeItem(PANTALLA_COMPLETA); } catch { /* */ }
    // Además, pantalla completa del navegador (si lo permite)
    const doc = this.documento as Document & { fullscreenElement?: Element | null };
    try {
      if (si && !doc.fullscreenElement) void doc.documentElement.requestFullscreen?.().catch(() => undefined);
      if (!si && doc.fullscreenElement) void doc.exitFullscreen?.().catch(() => undefined);
    } catch { /* */ }
  }

  elegir(m: Modo): void { this.modo = m; this.error = ''; this.llave = ''; }

  /** Cierra el saldo (o la búsqueda) y vuelve a las dos tarjetas. */
  cerrar(): void {
    this.pararReloj();
    this.modo = ''; this.resultado = null; this.error = ''; this.llave = '';
  }

  consultar(texto: string): void {
    const llave = String(texto ?? '').trim();
    if (!llave || this.buscando) return;
    this.buscando = true;
    this.error = '';
    this.willGo.saldoPorLlave(llave).subscribe({
      next: (r) => { this.buscando = false; this.resultado = r; this.iniciarReloj(); },
      error: (e) => { this.buscando = false; this.error = WillGoService.mensajeDeError(e); },
    });
  }

  private iniciarReloj(): void {
    this.pararReloj();
    this.restante = 10;
    this.reloj = setInterval(() => {
      this.restante -= 1;
      if (this.restante <= 0) this.cerrar();
    }, 1000);
  }

  private pararReloj(): void {
    if (this.reloj) { clearInterval(this.reloj); this.reloj = null; }
  }
}
