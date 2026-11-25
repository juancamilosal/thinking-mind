import { Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, ViewChild, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FechaWillGoPipe } from './fecha.pipe';
import { formatearNumero } from './numero-miles.directive';

export interface PaisTasa {
  id: string; nombre: string; color: string | null; tasa_actual: number;
  historial: { ventana: string; tasa_anterior: number; tasa_nueva: number }[];
}

const IZQ = 52, DER = 14, ARRIBA = 14, ABAJO = 30;

/** Tasa de cada país en el tiempo (una línea por país, con su color). Arranca en la tasa inicial. */
@Component({
  selector: 'wg-grafica-tasa',
  standalone: true,
  imports: [TranslatePipe, FechaWillGoPipe],
  template: `
    <section class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <h3 class="font-bold text-gray-800">{{ 'wg.nucleo.tasa.titulo' | translate }}</h3>
      <p class="text-xs text-gray-500">{{ 'wg.nucleo.tasa.subtitulo' | translate: { n: miles(tasaInicial) } }}</p>

      @if (!momentos.length) {
        <p class="mt-4 text-sm text-gray-500">{{ 'wg.nucleo.tasa.vacio' | translate: { n: intervalo } }}</p>
      } @else {
        <div class="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1">
          @for (s of series; track s.id) {
            <label class="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full cursor-pointer select-none hover:bg-gray-100"
                   [class.text-gray-700]="!ocultas.has(s.id)" [class.text-gray-400]="ocultas.has(s.id)">
              <input type="checkbox" class="w-4 h-4 rounded" [style.accent-color]="s.color" [checked]="!ocultas.has(s.id)" (change)="alternar(s.id)">
              <span class="w-3 h-3 rounded-full shrink-0" [style.background]="s.color" [class.opacity-30]="ocultas.has(s.id)" aria-hidden="true"></span>
              <span [class.line-through]="ocultas.has(s.id)">{{ s.nombre }}</span>
            </label>
          }
        </div>

        <div #lienzo class="mt-2 w-full">
          <svg [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" [attr.width]="ancho" [attr.height]="alto" class="block select-none" role="img" [attr.aria-label]="'wg.nucleo.tasa.aria' | translate">
            @for (t of marcas; track t) {
              <line [attr.x1]="izq" [attr.x2]="ancho - der" [attr.y1]="y(t)" [attr.y2]="y(t)" stroke="#eef0f2" stroke-width="1" />
              <text [attr.x]="izq - 6" [attr.y]="y(t) + 3.5" text-anchor="end" font-size="11" fill="#6b7280">{{ miles(t) }}</text>
            }
            <line [attr.x1]="izq" [attr.x2]="ancho - der" [attr.y1]="y(tasaInicial)" [attr.y2]="y(tasaInicial)" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="5 4" />
            @for (m of momentos; track $index; let i = $index) {
              @if (i === elegida || i % saltoEtiquetas === 0 || i === momentos.length - 1) {
                <text [attr.x]="x(i)" [attr.y]="alto - 9" text-anchor="middle" font-size="11" [attr.fill]="i === elegida ? '#111827' : '#6b7280'" [attr.font-weight]="i === elegida ? 700 : 400">{{ m ? (m | wgFecha: ('wg.nucleo.tasa.formatoHora' | translate)) : ('wg.nucleo.tasa.inicio' | translate) }}</text>
              }
            }
            @if (elegida !== null) {
              <line [attr.x1]="x(elegida)" [attr.x2]="x(elegida)" [attr.y1]="arriba" [attr.y2]="alto - abajo" stroke="#d1d5db" stroke-width="1" stroke-dasharray="3 3" />
            }
            @for (s of visibles; track s.id) {
              <polyline [attr.points]="s.trazo" fill="none" [attr.stroke]="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
              @if (elegida !== null && s.valores[elegida] !== null) {
                <circle [attr.cx]="x(elegida)" [attr.cy]="y(s.valores[elegida]!)" r="4.5" [attr.fill]="s.color" stroke="#fff" stroke-width="1.5" />
              }
            }
            @if (!visibles.length) {
              <text [attr.x]="(izq + ancho - der) / 2" [attr.y]="(arriba + alto - abajo) / 2" text-anchor="middle" font-size="12" fill="#9ca3af">{{ 'wg.nucleo.tasa.marcaPais' | translate }}</text>
            }
            @for (m of momentos; track $index; let i = $index) {
              <rect [attr.x]="x(i) - paso / 2" y="0" [attr.width]="paso" [attr.height]="alto" fill="transparent" class="cursor-pointer" (click)="elegida = i" (mouseenter)="elegida = i" />
            }
          </svg>
        </div>

        @if (elegida !== null) {
          <div class="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-3">
            <p class="text-xs font-semibold text-gray-500 mb-2">{{ momentos[elegida] ? (momentos[elegida] | wgFecha: ('wg.nucleo.tasa.formatoFecha' | translate)) : ('wg.nucleo.tasa.alInicio' | translate) }}</p>
            <ul class="space-y-1.5">
              @for (s of visibles; track s.id) {
                @if (s.valores[elegida] !== null) {
                  <li class="flex items-center gap-2 text-sm">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background]="s.color" aria-hidden="true"></span>
                    <span class="flex-1 text-gray-700 truncate">{{ s.nombre }}</span>
                    <span class="font-bold tabular-nums text-gray-800">{{ miles(s.valores[elegida]) }}</span>
                    <span class="w-16 text-right text-xs font-semibold tabular-nums" [class]="cambio(s, elegida) > 0 ? 'text-emerald-700' : cambio(s, elegida) < 0 ? 'text-red-600' : 'text-gray-400'">{{ textoCambio(s, elegida) }}</span>
                  </li>
                }
              }
            </ul>
          </div>
        }
      }
    </section>
  `,
})
export class GraficaTasaComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) paises: PaisTasa[] = [];
  @Input({ required: true }) tasaInicial = 1000;
  @Input() intervalo = 30;

  readonly izq = IZQ; readonly der = DER; readonly arriba = ARRIBA; readonly abajo = ABAJO;
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  ancho = 340;
  get alto(): number { return this.ancho < 640 ? 260 : 320; }
  /** Momentos de la gráfica: null = el inicio (tasa inicial) y luego cada cálculo. */
  momentos: (string | null)[] = [];
  series: { id: string; nombre: string; color: string; valores: (number | null)[]; trazo: string }[] = [];
  marcas: number[] = [];
  elegida: number | null = null;
  ocultas = new Set<string>();
  private minimo = 0;
  private maximo = 1;
  private zona = inject(NgZone);
  private observador: ResizeObserver | null = null;

  @ViewChild('lienzo') set lienzo(el: ElementRef<HTMLElement> | undefined) {
    this.observador?.disconnect();
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.observador = new ResizeObserver(([e]) => {
      const w = Math.max(260, Math.floor(e.contentRect.width));
      if (w !== this.ancho) this.zona.run(() => { this.ancho = w; this.trazar(); });
    });
    this.observador.observe(el.nativeElement);
  }
  ngOnDestroy(): void { this.observador?.disconnect(); }

  ngOnChanges(): void {
    const ventanas = [...new Set(this.paises.flatMap((p) => p.historial.map((h) => new Date(h.ventana).toISOString())))].sort();
    this.momentos = ventanas.length ? [null, ...ventanas] : [];
    this.series = this.paises.map((p) => {
      const porVentana = new Map(p.historial.map((h) => [new Date(h.ventana).toISOString(), Number(h.tasa_nueva)]));
      let ultimo: number | null = Number(this.tasaInicial);
      const valores = this.momentos.map((m) => { if (m === null) return ultimo; const v = porVentana.get(m); if (v !== undefined) ultimo = v; return ultimo; });
      return { id: p.id, nombre: p.nombre, color: p.color || '#64748b', valores, trazo: '' };
    });
    // Eje ajustado a las tasas (con un margen) e incluyendo la tasa inicial
    const todas = this.series.flatMap((s) => s.valores.filter((v): v is number => v !== null));
    const lo = Math.min(Number(this.tasaInicial), ...todas), hi = Math.max(Number(this.tasaInicial), ...todas);
    const rango = Math.max(hi - lo, Number(this.tasaInicial) * 0.04);
    const paso = this.pasoBonito(rango / 4);
    this.minimo = Math.floor((lo - rango * 0.15) / paso) * paso;
    this.maximo = Math.ceil((hi + rango * 0.15) / paso) * paso;
    this.marcas = [];
    for (let t = this.minimo; t <= this.maximo + 1e-9; t += paso) this.marcas.push(Math.round(t));
    this.elegida = this.momentos.length ? this.momentos.length - 1 : null;
    this.trazar();
  }

  private pasoBonito(bruto: number): number {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(bruto, 1))));
    const n = bruto / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  private trazar(): void {
    this.series = this.series.map((s) => ({ ...s, trazo: s.valores.map((v, i) => (v === null ? null : `${this.x(i)},${this.y(v)}`)).filter(Boolean).join(' ') }));
  }

  get visibles() { return this.series.filter((s) => !this.ocultas.has(s.id)); }
  alternar(id: string): void { const n = new Set(this.ocultas); n.has(id) ? n.delete(id) : n.add(id); this.ocultas = n; }
  get paso(): number { return (this.ancho - IZQ - DER) / Math.max(this.momentos.length, 1); }
  get saltoEtiquetas(): number { return Math.max(1, Math.ceil(this.momentos.length / Math.floor((this.ancho - IZQ - DER) / 46))); }
  x(i: number): number { return this.momentos.length <= 1 ? (IZQ + this.ancho - DER) / 2 : IZQ + this.paso / 2 + i * this.paso; }
  y(v: number): number { return ARRIBA + ((this.maximo - v) / Math.max(this.maximo - this.minimo, 1)) * (this.alto - ARRIBA - ABAJO); }

  cambio(s: { valores: (number | null)[] }, i: number): number {
    const v = s.valores[i], antes = i > 0 ? s.valores[i - 1] : null;
    return v !== null && antes !== null ? v - antes : 0;
  }
  textoCambio(s: { valores: (number | null)[] }, i: number): string {
    if (i === 0) return '';
    const c = this.cambio(s, i), antes = s.valores[i - 1] ?? 0;
    if (!c) return '=';
    return `${c > 0 ? '▲' : '▼'} ${Math.abs((c / (antes || 1)) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
  }
}
