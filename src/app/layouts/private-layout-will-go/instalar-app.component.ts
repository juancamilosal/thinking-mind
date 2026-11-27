import { Component, Input, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AppInstalableService } from '../../core/services/app-instalable.service';

/**
 * Botón «Instalar app». En Android/Chrome abre la ventana del sistema; en iPhone explica
 * cómo agregarla a la pantalla de inicio. No aparece si ya está instalada o si el navegador no lo permite.
 */
@Component({
  selector: 'wg-instalar-app',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (visible) {
      @if (variante === 'menu') {
        <button type="button" (click)="tocar()" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-orange-200 hover:bg-white/10 hover:text-white transition">
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v11m0 0l-4-4m4 4l4-4M6 20h12"/></svg>
          <span class="font-medium">{{ 'wg.nucleo.instalar.menu' | translate }}</span>
        </button>
      } @else {
        <!-- Ícono y texto arriba; el botón debajo a todo lo ancho (cabe bien aunque la tarjeta sea angosta) -->
        <div class="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-left">
          <div class="flex items-center gap-3">
          <img src="/will-go/icono-192-v2.png" alt="" class="w-11 h-11 rounded-xl shrink-0">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-gray-800 leading-snug">{{ 'wg.nucleo.instalar.instalaEn' | translate: { nombre: familias ? ('wg.nucleo.instalar.familias' | translate) : 'Will-Go' } }}</p>
            <p class="text-xs text-gray-600 leading-snug mt-0.5">{{ 'wg.nucleo.instalar.abrelaDesde' | translate }}</p>
          </div>
          </div>
          <button type="button" (click)="tocar()" class="mt-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600">{{ 'wg.nucleo.instalar.instalar' | translate }}</button>
        </div>
      }
    }

    @if (ayudaIos) {
      <div class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="ayudaIos = false">
        <div class="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 text-gray-800" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-ios">
          <div class="flex items-center gap-3">
            <img src="/will-go/icono-192-v2.png" alt="" class="w-12 h-12 rounded-xl">
            <h2 id="titulo-ios" class="text-lg font-bold">{{ 'wg.nucleo.instalar.tituloIos' | translate: { nombre: familias ? ('wg.nucleo.instalar.familias' | translate) : 'Will-Go' } }}</h2>
          </div>
          <ol class="mt-4 space-y-3 text-sm">
            <li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">1</span>
              <span><span [innerHTML]="'wg.nucleo.instalar.paso1' | translate"></span>
                <svg class="inline w-5 h-5 -mt-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" [attr.aria-label]="'wg.nucleo.instalar.compartir' | translate"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v12m0-12l-4 4m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>
                {{ 'wg.nucleo.instalar.paso1Fin' | translate }}</span></li>
            <li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">2</span>
              <span [innerHTML]="'wg.nucleo.instalar.paso2' | translate"></span></li>
            <li class="flex gap-3"><span class="w-6 h-6 shrink-0 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">3</span>
              <span [innerHTML]="'wg.nucleo.instalar.paso3' | translate"></span></li>
          </ol>
          <p class="mt-4 text-xs text-gray-500">{{ 'wg.nucleo.instalar.soloSafari' | translate }}</p>
          <button type="button" (click)="ayudaIos = false" class="mt-5 w-full py-3 rounded-xl font-semibold text-white bg-slate-800">{{ 'wg.nucleo.instalar.entendido' | translate }}</button>
        </div>
      </div>
    }
  `,
})
export class InstalarAppComponent {
  /** 'tarjeta' para pantallas de ingreso; 'menu' para el menú lateral. */
  @Input() variante: 'tarjeta' | 'menu' = 'tarjeta';
  private pwa = inject(AppInstalableService);
  ayudaIos = false;

  /** En Familias el nombre se traduce (wg.nucleo.instalar.familias); «Will-Go» queda igual. */
  get familias(): boolean { return this.pwa.app === 'familias'; }
  get visible(): boolean { return !this.pwa.instalada && (this.pwa.puedeInstalar || this.pwa.esIos); }

  async tocar(): Promise<void> {
    if (this.pwa.puedeInstalar) await this.pwa.instalar();
    else if (this.pwa.esIos) this.ayudaIos = true;
  }
}
