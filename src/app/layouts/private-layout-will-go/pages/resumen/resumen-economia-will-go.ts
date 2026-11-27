import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DatosPantallaTv, EdicionVigente, FondoTv, PaisTv, WillGoService } from '../../../../core/services/will-go.service';
import { IdiomaWillGoService } from '../../../../core/services/idioma-will-go.service';
import { formatearNumero } from '../../numero-miles.directive';
import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { GraficaTvComponent, SerieTv } from '../pantalla-tv/grafica-tv.component';

const COLORES_FONDOS = ['#F97316', '#3B82F6', '#22C55E', '#A855F7', '#EF4444', '#14B8A6', '#EAB308', '#EC4899'];

/**
 * Resumen de la economía de una edición, todo en una sola vista (solo administradores):
 * precio de la moneda, cada país con su gráfica y su Top 10, y las empresas de W-Funds con su gráfica y su Top 10.
 * La misma información la proyecta en el televisor el rol TV.
 */
@Component({
  selector: 'app-resumen-economia-will-go',
  standalone: true,
  imports: [TranslatePipe, SelectorEdicionComponent, GraficaTvComponent],
  template: `
    <div class="max-w-6xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.resumenEco.titulo' | translate }}</h1>
          <p class="text-gray-500 mt-1">{{ 'wg.resumenEco.subtitulo' | translate }}</p>
        </div>
      </div>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" (cambio)="cargar()" />

      @if (cargando && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.operacion.comun.cargando' | translate }}</div>
      } @else if (error && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.tv.sinEdiciones' | translate }}</div>
      } @else if (datos) {
        <!-- Precio de la moneda -->
        <h2 class="mt-6 text-lg font-bold text-gray-800">{{ 'wg.tv.precioMoneda' | translate }}</h2>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (p of datos.paises; track p.id) {
            <div class="bg-white rounded-2xl border-2 p-4 flex items-center gap-4" [style.border-color]="p.color || '#e5e7eb'">
              @if (billete(p); as img) {
                <img [src]="img" [alt]="'1 ' + p.codigo_moneda" class="w-28 sm:w-32 rounded-lg shadow shrink-0">
              } @else {
                <div class="w-28 sm:w-32 aspect-[2/1] rounded-lg shrink-0 flex items-center justify-center text-white font-extrabold" [style.background]="p.color || '#475569'">1 {{ p.codigo_moneda }}</div>
              }
              <div class="min-w-0">
                <p class="font-bold" [style.color]="p.color || '#1f2937'">{{ p.nombre }}</p>
                <p class="text-2xl font-extrabold text-gray-900 tabular-nums leading-tight">{{ miles(p.tasa_actual) }} <span class="text-sm font-semibold text-gray-500">{{ 'wg.tv.pesos' | translate }}</span></p>
                <p class="text-xs text-gray-500">1 {{ p.codigo_moneda }}</p>
                <span class="mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full" [class]="cambio(p) > 0 ? 'bg-emerald-50 text-emerald-700' : cambio(p) < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'">
                  {{ cambio(p) > 0 ? '▲' : cambio(p) < 0 ? '▼' : '=' }} {{ pct(cambio(p)) }} {{ 'wg.tv.desdeInicio' | translate }}
                </span>
              </div>
            </div>
          }
        </div>

        <!-- Cada país -->
        @for (p of datos.paises; track p.id) {
          <section class="mt-5 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div class="flex items-center gap-3 px-5 py-3 border-b border-gray-100" [style.border-left]="'6px solid ' + (p.color || '#94a3b8')">
              <h2 class="text-lg font-bold text-gray-800">{{ p.nombre }}</h2>
              <p class="text-sm text-gray-500">1 {{ p.codigo_moneda }} = <b class="text-gray-800">{{ miles(p.tasa_actual) }}</b> {{ 'wg.tv.pesos' | translate }}</p>
            </div>
            <div class="grid lg:grid-cols-[1.2fr_1fr] gap-5 p-5">
              <div>
                <p class="text-sm font-semibold text-gray-600">{{ 'wg.tv.comportamiento' | translate }}</p>
                @if (p.historial.length) {
                  <wg-grafica-tv class="block mt-2" [claro]="true" [tamTexto]="26" [series]="seriePais(p)" [etiquetas]="horasPais(p)" [referencia]="datos.tasa_inicial" [titulo]="p.nombre" [formato]="milesFn" />
                } @else {
                  <p class="mt-2 rounded-xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">{{ 'wg.tv.sinHistorial' | translate }}</p>
                }
              </div>
              <div>
                <p class="text-sm font-semibold text-gray-600">{{ 'wg.tv.top10Dinero' | translate }}</p>
                <ol class="mt-2">
                  @for (r of p.ranking; track $index; let i = $index) {
                    <li class="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0 text-sm">
                      <span class="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold" [class]="medalla(i)">{{ i + 1 }}</span>
                      <span class="min-w-0 flex-1 truncate font-semibold text-gray-800">{{ r.nombre }} {{ r.apellido }}</span>
                      <span class="shrink-0 font-bold text-gray-900 tabular-nums">{{ miles(r.total) }} <span class="text-xs font-semibold text-gray-500">{{ p.codigo_moneda }}</span></span>
                    </li>
                  } @empty {
                    <li class="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">{{ 'wg.tv.sinDinero' | translate }}</li>
                  }
                </ol>
              </div>
            </div>
          </section>
        }

        <!-- Docentes que más han repartido -->
        <h2 class="mt-8 text-lg font-bold text-gray-800">{{ 'wg.tv.docentes' | translate }}</h2>
        <p class="text-sm text-gray-500">{{ 'wg.tv.docentesAyuda' | translate }}</p>
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (p of datos.paises; track p.id) {
            <div class="bg-white rounded-2xl border-2 p-4" [style.border-color]="p.color || '#e5e7eb'">
              <p class="font-bold" [style.color]="p.color || '#1f2937'">{{ p.nombre }}</p>
              @if (p.docentes?.length) {
                @let top = p.docentes![0];
                <div class="mt-2 flex items-center gap-3">
                  <span class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-extrabold bg-amber-400 text-amber-950">1</span>
                  <div class="min-w-0">
                    <p class="font-bold text-gray-900 truncate">{{ top.nombre }} {{ top.apellido }}</p>
                    <p class="text-sm text-gray-600"><b class="text-gray-900 tabular-nums">{{ miles(top.repartido) }}</b> {{ p.codigo_moneda }} · {{ 'wg.tv.aEstudiantes' | translate: { n: top.estudiantes } }}</p>
                  </div>
                </div>
                @if (p.docentes!.length > 1) {
                  <ol class="mt-3 border-t border-gray-100">
                    @for (d of p.docentes!.slice(1); track $index; let i = $index) {
                      <li class="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 text-sm">
                        <span class="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold" [class]="medalla(i + 1)">{{ i + 2 }}</span>
                        <span class="min-w-0 flex-1 truncate text-gray-800">{{ d.nombre }} {{ d.apellido }}</span>
                        <span class="shrink-0 font-bold text-gray-900 tabular-nums">{{ miles(d.repartido) }}</span>
                      </li>
                    }
                  </ol>
                }
              } @else {
                <p class="mt-2 text-sm text-gray-500">{{ 'wg.tv.sinRepartos' | translate }}</p>
              }
            </div>
          }
        </div>

        <!-- W-Funds -->
        @if (datos.fondos.length) {
          <h2 class="mt-8 text-lg font-bold text-gray-800">{{ 'wg.tv.fondos' | translate }}</h2>
          <p class="text-sm text-gray-500">{{ 'wg.tv.fondosAyuda' | translate: { n: datos.rondas } }}</p>
          <section class="mt-3 bg-white rounded-2xl border border-gray-200 p-5 grid lg:grid-cols-[1.6fr_1fr] gap-5">
            <wg-grafica-tv class="block" [claro]="true" [tamTexto]="26" [series]="seriesFondos" [etiquetas]="etiquetasRondas" [referencia]="100" [rellenar]="false" [titulo]="'wg.tv.fondos' | translate" />
            <ul class="self-center space-y-2">
              @for (f of fondosOrdenados; track f.fondo.id) {
                <li class="flex items-center gap-3 text-sm">
                  <span class="w-3 h-3 rounded-full shrink-0" [style.background]="f.color"></span>
                  @if (f.fondo.logo) { <img [src]="logo(f.fondo)" alt="" class="w-7 h-7 rounded-md object-cover shrink-0"> }
                  <span class="min-w-0 flex-1 truncate font-semibold text-gray-800">{{ f.fondo.nombre }}</span>
                  <span class="shrink-0 font-bold tabular-nums" [class]="valorFinal(f.fondo) >= 100 ? 'text-emerald-600' : 'text-red-600'">{{ pct(valorFinal(f.fondo) - 100) }}</span>
                </li>
              }
            </ul>
          </section>

          <div class="mt-5 grid gap-5 lg:grid-cols-2">
            @for (f of fondosOrdenados; track f.fondo.id) {
              <section class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div class="flex items-center gap-3 px-5 py-3 border-b border-gray-100" [style.border-left]="'6px solid ' + f.color">
                  @if (f.fondo.logo) { <img [src]="logo(f.fondo)" alt="" class="w-10 h-10 rounded-lg object-cover shrink-0"> }
                  <div class="min-w-0">
                    <h3 class="font-bold text-gray-800 truncate">{{ f.fondo.nombre }}</h3>
                    <p class="text-xs text-gray-500">
                      {{ 'wg.tv.valen' | translate: { v: miles(valorFinal(f.fondo)) } }}
                      @if (f.fondo.ultimo_rendimiento !== null) {
                        · <b [class]="f.fondo.ultimo_rendimiento >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ 'wg.tv.ultimaRonda' | translate: { v: pct(f.fondo.ultimo_rendimiento * 100) } }}</b>
                      }
                    </p>
                  </div>
                </div>
                <div class="p-5">
                  @if (f.fondo.puntos.length > 1) {
                    <wg-grafica-tv class="block" [claro]="true" [tamTexto]="30" [series]="serieFondo(f.fondo, f.color)" [etiquetas]="etiquetasRondas" [referencia]="100" [titulo]="f.fondo.nombre" />
                  } @else {
                    <p class="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">{{ 'wg.tv.sinRondas' | translate }}</p>
                  }
                  <p class="mt-4 text-sm font-semibold text-gray-600">{{ 'wg.tv.top10Inversion' | translate }}</p>
                  <ol class="mt-2">
                    @for (r of f.fondo.ranking; track $index; let i = $index) {
                      <li class="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0 text-sm">
                        <span class="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold" [class]="medalla(i)">{{ i + 1 }}</span>
                        <span class="min-w-0 flex-1 truncate font-semibold text-gray-800">{{ r.nombre }} {{ r.apellido }}</span>
                        <span class="shrink-0 text-[11px] font-bold text-white px-2 py-0.5 rounded-full" [style.background]="r.color || '#475569'">{{ r.pais }}</span>
                        <span class="shrink-0 font-bold text-gray-900 tabular-nums">{{ miles(r.invertido) }} <span class="text-xs font-semibold text-gray-500">{{ r.codigo_moneda }}</span></span>
                      </li>
                    } @empty {
                      <li class="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">{{ 'wg.tv.sinInversiones' | translate }}</li>
                    }
                  </ol>
                </div>
              </section>
            }
          </div>
        }
      }
    </div>
  `,
})
export class ResumenEconomiaWillGo implements OnInit, OnDestroy {
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  private idioma = inject(IdiomaWillGoService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  readonly milesFn = (v: number) => formatearNumero(Math.round(v));
  ediciones: EdicionVigente[] = [];
  edicionId = '';
  datos: DatosPantallaTv | null = null;
  cargando = true;
  error = '';
  private refresco: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
    // Se actualiza solo cada minuto (las tasas, saldos e inversiones cambian durante el día)
    this.refresco = setInterval(() => { if (this.edicionId && !this.cargando) this.cargar(); }, 60000);
  }
  ngOnDestroy(): void { if (this.refresco) clearInterval(this.refresco); }

  cargar(): void {
    this.cargando = true;
    this.willGo.pantallaTv(this.edicionId).subscribe({
      next: (d) => { this.datos = d; this.memo.clear(); this.cargando = false; this.error = ''; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  billete(p: PaisTv): string | null {
    const n = p.nombre.trim().toLowerCase();
    return ['wonderland', 'neverland', 'dreamland'].includes(n) ? `assets/images/billetes/${n}/1.jpg` : null;
  }
  cambio(p: PaisTv): number { const i = this.datos?.tasa_inicial || p.tasa_actual || 1; return ((p.tasa_actual - i) / i) * 100; }
  pct(v: number): string { return `${v > 0 ? '+' : ''}${v.toLocaleString(this.idioma.locale, { maximumFractionDigits: 1 })} %`; }
  medalla(i: number): string {
    return i === 0 ? 'bg-amber-400 text-amber-950' : i === 1 ? 'bg-slate-300 text-slate-900' : i === 2 ? 'bg-orange-700 text-white' : 'bg-gray-100 text-gray-600';
  }
  /** Lo calculado para las gráficas se guarda hasta que lleguen datos nuevos (así no se redibujan en cada ciclo). */
  private memo = new Map<string, unknown>();
  private recordar<T>(clave: string, calcular: () => T): T {
    if (!this.memo.has(clave)) this.memo.set(clave, calcular());
    return this.memo.get(clave) as T;
  }

  seriePais(p: PaisTv): SerieTv[] {
    return this.recordar('sp' + p.id, () => [{ nombre: p.nombre, color: p.color || '#F97316', valores: [this.datos!.tasa_inicial, ...p.historial.map((h) => h.tasa)] }]);
  }
  horasPais(p: PaisTv): string[] {
    return this.recordar('hp' + p.id + this.idioma.actual, () => ['', ...p.historial.map((h) => new Date(h.ventana).toLocaleTimeString(this.idioma.locale, { hour: 'numeric', minute: '2-digit' }))]);
  }
  valores(f: FondoTv): number[] { return f.puntos.map((x) => x.valor); }
  serieFondo(f: FondoTv, color: string): SerieTv[] { return this.recordar('s1' + f.id, () => [{ nombre: f.nombre, color, valores: this.valores(f) }]); }
  valorFinal(f: FondoTv): number { return f.puntos[f.puntos.length - 1]?.valor ?? 100; }
  get etiquetasRondas(): string[] {
    return this.recordar('er' + this.idioma.actual, () => (this.datos?.fondos[0]?.puntos ?? []).map((x, i) => (i === 0 ? this.t.instant('wg.tv.inicio') : (x.ronda ?? '').replace(/^(Ronda|Round|Manche)\s*/i, 'R'))));
  }
  get seriesFondos(): SerieTv[] {
    return this.recordar('sf', () => (this.datos?.fondos ?? []).map((f, k) => ({ nombre: f.nombre, color: COLORES_FONDOS[k % COLORES_FONDOS.length], valores: this.valores(f) })));
  }
  get fondosOrdenados(): { fondo: FondoTv; color: string }[] {
    return this.recordar('fo', () => (this.datos?.fondos ?? []).map((f, k) => ({ fondo: f, color: COLORES_FONDOS[k % COLORES_FONDOS.length] }))
      .sort((a, b) => this.valorFinal(b.fondo) - this.valorFinal(a.fondo)));
  }
  logo(f: FondoTv): string | null { return f.logo ? this.willGo.urlFoto(f.logo) : null; }
}
