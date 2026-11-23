import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FechaWillGoPipe } from './fecha.pipe';
import { Arqueo, DatosArqueo, PaisArqueo, WillGoService } from '../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from './numero-miles.directive';
import { ListaMovimientosComponent } from './lista-movimientos.component';



/** Arqueo del banco: el total de dinero contado en el banco y si cuadra con el sistema. */
@Component({
  selector: 'wg-arqueo',
  standalone: true,
  imports: [FormsModule, TranslatePipe, FechaWillGoPipe, NumeroMilesDirective, ListaMovimientosComponent],
  template: `
    @if (cargando) {
      <div class="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.banco.cargando' | translate }}</div>
    } @else if (error && !datos) {
      <div class="bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
    } @else if (datos) {
      @if (!datos.paises.length) {
        <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">
          {{ 'wg.banco.sinPais' | translate }}
        </div>
      }
      <!-- País -->
      <div class="flex flex-wrap gap-2">
        @for (p of datos.paises; track p.id) {
          <button type="button" (click)="pais = p" class="px-4 py-2 rounded-xl text-sm font-semibold border-2 transition"
                  [style.background]="pais?.id === p.id ? (p.color || '#1e293b') : '#fff'"
                  [style.border-color]="p.color || '#cbd5e1'" [style.color]="pais?.id === p.id ? '#fff' : '#334155'">
            {{ p.nombre }}
          </button>
        }
      </div>

      @if (pais) {
        <div class="mt-4 inline-flex gap-1 bg-white border border-gray-200 rounded-xl p-1" role="tablist">
          <button type="button" role="tab" [attr.aria-selected]="vista === 'arqueo'" (click)="vista = 'arqueo'"
                  class="px-4 py-2 rounded-lg text-sm font-semibold" [class]="vista === 'arqueo' ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:bg-gray-100'">{{ 'wg.banco.arqueo.tabArqueo' | translate }}</button>
          <button type="button" role="tab" [attr.aria-selected]="vista === 'movimientos'" (click)="vista = 'movimientos'"
                  class="px-4 py-2 rounded-lg text-sm font-semibold" [class]="vista === 'movimientos' ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:bg-gray-100'">{{ 'wg.banco.arqueo.tabMovimientos' | translate }}</button>
        </div>
      }

      @if (pais && vista === 'movimientos') {
        <div class="mt-4 grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 max-w-sm" role="tablist" [attr.aria-label]="'wg.banco.arqueo.medioMovimientos' | translate">
          <button type="button" role="tab" [attr.aria-selected]="medioMov === 'efectivo'" (click)="medioMov = 'efectivo'"
                  class="py-2 rounded-lg text-sm font-semibold" [class]="medioMov === 'efectivo' ? 'bg-white shadow text-gray-800' : 'text-gray-500'">💵 {{ 'wg.banco.repartir.efectivo' | translate }}</button>
          <button type="button" role="tab" [attr.aria-selected]="medioMov === 'virtual'" (click)="medioMov = 'virtual'"
                  class="py-2 rounded-lg text-sm font-semibold" [class]="medioMov === 'virtual' ? 'bg-white shadow text-gray-800' : 'text-gray-500'">💳 {{ 'wg.banco.repartir.virtual' | translate }}</button>
        </div>
        <wg-lista-movimientos class="block mt-3" [movimientos]="movimientosDe(pais)" [pais]="pais"
                              [totalEntro]="medioMov === 'virtual' ? (pais.virtual_entro ?? 0) : pais.total_entro"
                              [totalSalio]="medioMov === 'virtual' ? (pais.virtual_salio ?? 0) : pais.total_salio"
                              [vacio]="(medioMov === 'virtual' ? 'wg.banco.arqueo.sinMovimientosVirtual' : 'wg.banco.arqueo.sinMovimientos') | translate" />
      }

      @if (pais && vista === 'arqueo') {
        <!-- Resumen del banco -->
        <div class="mt-4 grid grid-cols-2 bg-white rounded-2xl border border-gray-200 divide-x divide-gray-100">
          <div class="px-4 py-3 sm:py-4 min-w-0">
            <p class="text-xs font-semibold" [style.color]="pais.color || '#6b7280'">{{ 'wg.banco.arqueo.enBancoHoy' | translate }}</p>
            <p class="text-xl sm:text-2xl font-bold text-gray-800 break-all">{{ miles(pais.saldo_sistema) }}</p>
          </div>
          <div class="px-4 py-3 sm:py-4 min-w-0">
            <p class="text-xs text-gray-500">{{ 'wg.banco.arqueo.enCirculacion' | translate }}</p>
            <p class="text-xl sm:text-2xl font-bold text-gray-800 break-all">{{ miles(pais.en_circulacion) }}</p>
          </div>
        </div>
        <div class="mt-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-700">💳 {{ 'wg.banco.repartir.virtual' | translate }}</p>
            <p class="text-xs text-gray-500">{{ 'wg.montobanco.virtualAyuda' | translate: { n: miles(pais.virtual_cargado ?? 0) } }}</p>
          </div>
          <p class="text-xl sm:text-2xl font-bold text-gray-800 break-all">{{ miles(pais.virtual_saldo ?? 0) }}</p>
        </div>

        <!-- Conteo: un solo total -->
        <div class="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
          <h3 class="font-bold text-gray-800">{{ 'wg.montobanco.arqueoTitulo' | translate }}</h3>
          <p class="text-sm text-gray-500">{{ 'wg.montobanco.arqueoAyuda' | translate }}</p>
          <label for="arqueo-total" class="block text-sm font-semibold text-gray-700 mt-4">{{ 'wg.montobanco.totalContado' | translate }}</label>
          <input id="arqueo-total" wgNumero [ngModel]="contados[pais.id]" (ngModelChange)="contados[pais.id] = $event" placeholder="0"
                 class="mt-1.5 w-full px-4 py-3 text-2xl font-extrabold bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">

          <div class="mt-4 space-y-1 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3">
            <div class="flex sm:block items-center justify-between gap-3"><p class="text-sm sm:text-xs text-gray-500">{{ 'wg.banco.arqueo.contado' | translate }}</p><p class="text-lg sm:text-xl font-bold text-gray-800 break-all text-right sm:text-left">{{ miles(total) }}</p></div>
            <div class="flex sm:block items-center justify-between gap-3"><p class="text-sm sm:text-xs text-gray-500">{{ 'wg.banco.arqueo.debeHaber' | translate }}</p><p class="text-lg sm:text-xl font-bold text-gray-800 break-all text-right sm:text-left">{{ miles(pais.saldo_sistema) }}</p></div>
            <div class="flex sm:block items-center justify-between gap-3">
              <p class="text-sm sm:text-xs text-gray-500">{{ 'wg.banco.arqueo.diferencia' | translate }}</p>
              @if (hayConteo) {
                <p class="text-lg sm:text-xl font-bold break-all text-right sm:text-left" [class]="diferencia === 0 ? 'text-emerald-600' : diferencia < 0 ? 'text-red-600' : 'text-amber-600'">
                  {{ (diferencia === 0 ? 'wg.banco.arqueo.cuadra' : diferencia < 0 ? 'wg.banco.arqueo.faltan' : 'wg.banco.arqueo.sobran') | translate: { n: miles(abs(diferencia)) } }}
                </p>
              } @else {
                <p class="text-lg sm:text-xl font-bold text-gray-400 text-right sm:text-left">—</p>
              }
            </div>
          </div>
          <div class="mt-4 flex flex-col sm:flex-row gap-3">
            <input [(ngModel)]="observaciones" [placeholder]="'wg.banco.arqueo.observacionOpcional' | translate" [attr.aria-label]="'wg.banco.arqueo.observacion' | translate"
                   class="flex-1 px-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            <button type="button" (click)="guardar()" [disabled]="guardando || !hayConteo"
                    class="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:brightness-110 disabled:opacity-50">
              {{ (guardando ? 'wg.banco.guardando' : 'wg.banco.arqueo.guardar') | translate }}
            </button>
          </div>
          @if (aviso) { <p class="mt-2 text-sm" [class]="avisoError ? 'text-red-700' : 'text-emerald-700'" role="status">{{ aviso }}</p> }
        </div>

        <!-- Historial -->
        <h3 class="font-bold text-gray-800 mt-6 mb-3">{{ 'wg.banco.arqueo.anteriores' | translate }}</h3>
        @if (!historialPais.length) {
          <p class="text-sm text-gray-500">{{ 'wg.banco.arqueo.sinArqueos' | translate: { pais: pais.nombre } }}</p>
        } @else {
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <ul class="divide-y divide-gray-100">
              @for (a of historialPais; track a.id) {
                <li class="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span class="font-semibold text-gray-800 w-36">{{ a.date_created | wgFecha:'d MMM, h:mm a' }}</span>
                  <span class="text-gray-600">{{ 'wg.banco.arqueo.contadoDebia' | translate: { contado: miles(a.total_contado), debia: miles(a.saldo_sistema) } }}</span>
                  <span class="font-semibold" [class]="a.diferencia === 0 ? 'text-emerald-600' : a.diferencia < 0 ? 'text-red-600' : 'text-amber-600'">
                    {{ (a.diferencia === 0 ? 'wg.banco.arqueo.cuadro' : a.diferencia < 0 ? 'wg.banco.arqueo.faltaron' : 'wg.banco.arqueo.sobraron') | translate: { n: miles(abs(a.diferencia)) } }}
                  </span>
                  <span class="text-gray-500 lg:ml-auto">{{ a.responsable }}{{ a.observaciones ? ' · ' + a.observaciones : '' }}</span>
                </li>
              }
            </ul>
          </div>
        }
      }
    }
  `,
})
export class ArqueoComponent implements OnChanges {
  @Input({ required: true }) edicionId!: string;
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  readonly miles = (v: unknown) => formatearNumero(v as number);
  readonly abs = Math.abs;

  datos: DatosArqueo | null = null;
  pais: PaisArqueo | null = null;
  vista: 'arqueo' | 'movimientos' = 'arqueo';
  /** Total contado en curso por país: { paisId: monto } */
  contados: Record<string, number | null> = {};
  observaciones = '';
  cargando = true;
  guardando = false;
  error = '';
  aviso = '';
  avisoError = false;

  ngOnChanges(): void {
    this.cargar();
  }

  get total(): number {
    return Number(this.pais ? this.contados[this.pais.id] ?? 0 : 0) || 0;
  }

  /** Ya se escribió el total contado (un banco vacío también se puede contar: 0). */
  get hayConteo(): boolean {
    return this.pais ? this.contados[this.pais.id] != null : false;
  }

  get diferencia(): number {
    return this.total - (this.pais?.saldo_sistema ?? 0);
  }

  get historialPais(): Arqueo[] {
    return (this.datos?.historial ?? []).filter((a) => a.pais_id === this.pais?.id);
  }

  cargar(): void {
    this.cargando = true;
    this.willGo.arqueo(this.edicionId).subscribe({
      next: (datos) => {
        this.datos = datos;
        this.pais = datos.paises.find((p) => p.id === this.pais?.id) ?? datos.paises[0] ?? null;
        this.cargando = false;
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  guardar(): void {
    if (!this.pais || !this.datos || !this.hayConteo) return;
    this.guardando = true;
    this.aviso = '';
    const pais = this.pais;
    this.willGo.guardarArqueo(this.edicionId, pais.id, this.total, this.observaciones).subscribe({
      next: (a) => {
        this.guardando = false;
        this.avisoError = a.diferencia !== 0;
        this.aviso = this.t.instant(
          a.diferencia === 0 ? 'wg.banco.arqueo.guardadoCuadra' : a.diferencia < 0 ? 'wg.banco.arqueo.guardadoFaltan' : 'wg.banco.arqueo.guardadoSobran',
          { pais: pais.nombre, n: this.miles(Math.abs(a.diferencia)) });
        this.contados[pais.id] = null;
        this.observaciones = '';
        this.cargar();
      },
      error: (e) => { this.guardando = false; this.avisoError = true; this.aviso = WillGoService.mensajeDeError(e); },
    });
  }

  /** En Movimientos se ven por separado los del efectivo y los de la cuenta virtual del banco. */
  medioMov: 'efectivo' | 'virtual' = 'efectivo';
  movimientosDe(p: PaisArqueo): PaisArqueo['movimientos'] {
    return (p.movimientos ?? []).filter((m) => (m.medio ?? 'efectivo') === this.medioMov);
  }
}
