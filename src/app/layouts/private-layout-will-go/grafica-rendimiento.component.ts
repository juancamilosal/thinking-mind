import { AfterViewInit, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, ViewChild, inject } from '@angular/core';

export interface RondaGrafica { nombre: string; resultados: { fondo_id: string; rendimiento: number }[] }
export interface FondoGrafica { id: string; nombre: string }

/** Colores fijos por empresa (en el orden de las empresas; validados para daltonismo). */
const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#9a6b2f'];
const IZQ = 44, DER = 14, ARRIBA = 14, ABAJO = 30;

/**
 * Rendimiento de cada empresa en cada ronda (línea por empresa, % ganado o perdido).
 * Debajo, el detalle de la ronda elegida (toca un punto) y una tabla completa opcional.
 */
@Component({
  selector: 'wg-grafica-rendimiento',
  standalone: true,
  template: `
    <section class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <h3 class="font-bold text-gray-800">Rendimiento por ronda</h3>
      <p class="text-xs text-gray-500">Cuánto ganó (+) o perdió (−) cada empresa en cada ronda.</p>

      @if (!rondas.length) {
        <p class="mt-4 text-sm text-gray-500">La gráfica aparece cuando se cierre la primera ronda.</p>
      } @else {
        <!-- Leyenda -->
        <ul class="mt-3 flex flex-wrap gap-x-1 gap-y-1">
          @for (s of series; track s.id) {
            <li>
              <button type="button" (click)="resaltar(s.id)" [attr.aria-pressed]="resaltada === s.id"
                      class="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition"
                      [class]="resaltada === s.id ? 'bg-gray-800 text-white' : (resaltada ? 'text-gray-400 hover:bg-gray-100' : 'text-gray-600 hover:bg-gray-100')">
                <span class="w-3 h-3 rounded-full shrink-0" [style.background]="s.color" aria-hidden="true"></span>{{ s.nombre }}
              </button>
            </li>
          }
        </ul>
        <p class="text-[11px] text-gray-400 mt-1">Toca una empresa para ver solo su línea.</p>

        <div #lienzo class="mt-2 w-full">
        <svg [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" [attr.width]="ancho" [attr.height]="alto" class="block select-none" role="img" [attr.aria-label]="'Gráfica del rendimiento de las empresas en ' + rondas.length + ' rondas'">
          <!-- Rejilla y eje -->
          @for (t of marcas; track t) {
            <line [attr.x1]="izq" [attr.x2]="ancho - der" [attr.y1]="y(t)" [attr.y2]="y(t)" [attr.stroke]="t === 0 ? '#9ca3af' : '#eef0f2'" [attr.stroke-width]="t === 0 ? 1.5 : 1" vector-effect="non-scaling-stroke" />
            <text [attr.x]="izq - 6" [attr.y]="y(t) + 3.5" text-anchor="end" font-size="11" fill="#6b7280">{{ t > 0 ? '+' : '' }}{{ t }}%</text>
          }
          @for (r of rondas; track $index; let i = $index) {
            @if (i === elegida || i % saltoEtiquetas === 0 || i === rondas.length - 1) {
            <text [attr.x]="x(i)" [attr.y]="alto - 9" text-anchor="middle" font-size="11" [attr.fill]="i === elegida ? '#111827' : '#6b7280'" [attr.font-weight]="i === elegida ? 700 : 400">{{ corto(r.nombre) }}</text>
            }
          }
          @if (elegida !== null) {
            <line [attr.x1]="x(elegida)" [attr.x2]="x(elegida)" [attr.y1]="arriba" [attr.y2]="alto - abajo" stroke="#d1d5db" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
          }
          <!-- Líneas -->
          @for (s of ordenSeries; track s.id) {
            <g [attr.opacity]="resaltada && resaltada !== s.id ? 0.15 : 1">
              @if (s.puntos.length > 1) {
                <polyline [attr.points]="s.trazo" fill="none" [attr.stroke]="s.color" [attr.stroke-width]="resaltada === s.id ? 2.5 : 1.5"
                          vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
              }
              @for (p of s.puntos; track p.i) {
                <circle [attr.cx]="x(p.i)" [attr.cy]="y(p.v)" [attr.r]="p.i === elegida || resaltada === s.id ? 4.5 : 3.5" [attr.fill]="s.color"
                        stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke" />
              }
            </g>
          }
          <!-- Zonas para tocar cada ronda (más grandes que los puntos) -->
          @for (r of rondas; track $index; let i = $index) {
            <rect [attr.x]="x(i) - paso / 2" [attr.y]="0" [attr.width]="paso" [attr.height]="alto" fill="transparent" class="cursor-pointer"
                  (click)="elegida = i" (mouseenter)="elegida = i" />
          }
        </svg>
        </div>

        <!-- Detalle de la ronda elegida -->
        @if (elegida !== null) {
          <div class="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-3">
            <p class="text-xs font-semibold text-gray-500 mb-2">{{ rondas[elegida].nombre }}</p>
            <ul class="space-y-1.5">
              @for (v of detalle; track v.id) {
                <li class="flex items-center gap-2 text-sm cursor-pointer rounded-md px-1 -mx-1" (click)="resaltar(v.id)"
                    [class.bg-white]="resaltada === v.id" [class.opacity-40]="resaltada && resaltada !== v.id">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background]="v.color" aria-hidden="true"></span>
                  <span class="flex-1 text-gray-700 truncate">{{ v.nombre }}</span>
                  <span class="font-bold tabular-nums" [class]="v.valor >= 0 ? 'text-emerald-700' : 'text-red-600'">{{ pct(v.valor) }}</span>
                </li>
              }
            </ul>
          </div>
        }

        <button type="button" (click)="verTabla = !verTabla" class="mt-3 text-sm font-semibold text-orange-600 hover:underline">{{ verTabla ? 'Ocultar tabla' : 'Ver tabla' }}</button>
        @if (verTabla) {
          <div class="mt-2 overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="text-left text-xs text-gray-500">
                <th class="py-1.5 pr-3 font-semibold">Empresa</th>
                @for (r of rondas; track $index) { <th class="py-1.5 px-2 font-semibold text-right whitespace-nowrap">{{ corto(r.nombre) }}</th> }
              </tr></thead>
              <tbody>
                @for (s of series; track s.id) {
                  <tr class="border-t border-gray-100">
                    <td class="py-1.5 pr-3 text-gray-700 whitespace-nowrap">{{ s.nombre }}</td>
                    @for (r of rondas; track $index; let i = $index) {
                      <td class="py-1.5 px-2 text-right tabular-nums" [class]="(valor(s.id, i) ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'">{{ valor(s.id, i) === null ? '—' : pct(valor(s.id, i)!) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>
  `,
})
export class GraficaRendimientoComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) fondos: FondoGrafica[] = [];
  /** Rondas cerradas, de la más vieja a la más nueva. */
  @Input({ required: true }) rondas: RondaGrafica[] = [];

  readonly izq = IZQ; readonly der = DER; readonly arriba = ARRIBA; readonly abajo = ABAJO;
  /** Se dibuja al tamaño real de la pantalla (las letras y líneas no se estiran). */
  ancho = 340;
  get alto(): number { return this.ancho < 640 ? 280 : 360; }
  @ViewChild('lienzo') set lienzo(el: ElementRef<HTMLElement> | undefined) { this.observar(el?.nativeElement); }
  private observador: ResizeObserver | null = null;
  private zona = inject(NgZone);
  private maximo = 5;
  private minimo = -5;
  series: { id: string; nombre: string; color: string; puntos: { i: number; v: number }[]; trazo: string }[] = [];
  marcas: number[] = [];
  elegida: number | null = null;
  /** Empresa resaltada (las demás líneas se desvanecen); null = todas. */
  resaltada: string | null = null;
  resaltar(id: string): void { this.resaltada = this.resaltada === id ? null : id; }
  /** La línea resaltada se dibuja de última para que quede encima de las demás. */
  get ordenSeries() { return this.resaltada ? [...this.series.filter((s) => s.id !== this.resaltada), ...this.series.filter((s) => s.id === this.resaltada)] : this.series; }
  verTabla = false;

  ngAfterViewInit(): void { /* el tamaño llega por el ResizeObserver del lienzo */ }
  ngOnDestroy(): void { this.observador?.disconnect(); }

  private observar(el: HTMLElement | undefined): void {
    this.observador?.disconnect();
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.observador = new ResizeObserver(([e]) => {
      const w = Math.max(260, Math.floor(e.contentRect.width));
      // El aviso de cambio de tamaño llega fuera de Angular: se vuelve a entrar para que se redibuje
      if (w !== this.ancho) this.zona.run(() => { this.ancho = w; this.calcular(); });
    });
    this.observador.observe(el);
  }

  ngOnChanges(): void {
    // El eje se ajusta a los datos (siempre incluye el 0) con una línea cada 5 %, para usar toda la altura
    const todos = this.rondas.flatMap((r) => r.resultados.map((x) => Number(x.rendimiento) * 100));
    const salto = Math.max(...todos.map(Math.abs), 5) > 30 ? 10 : 5;
    this.maximo = Math.max(salto, Math.ceil(Math.max(0, ...todos) / salto) * salto);
    this.minimo = Math.min(-salto, Math.floor(Math.min(0, ...todos) / salto) * salto);
    this.marcas = [];
    for (let t = this.minimo; t <= this.maximo; t += salto) this.marcas.push(t);
    this.elegida = this.rondas.length ? this.rondas.length - 1 : null;
    this.calcular();
  }

  private calcular(): void {
    this.series = this.fondos.map((f, k) => {
      const puntos = this.rondas.map((_, i) => ({ i, v: this.valor(f.id, i) })).filter((p): p is { i: number; v: number } => p.v !== null);
      return { id: f.id, nombre: f.nombre, color: COLORES[k % COLORES.length], puntos, trazo: puntos.map((p) => `${this.x(p.i)},${this.y(p.v)}`).join(' ') };
    });
  }

  /** Con muchas rondas, se muestra una etiqueta sí y otras no para que no se monten. */
  get saltoEtiquetas(): number { return Math.max(1, Math.ceil(this.rondas.length / Math.floor((this.ancho - IZQ - DER) / 34))); }

  get paso(): number { return (this.ancho - IZQ - DER) / Math.max(this.rondas.length, 1); }
  x(i: number): number { return this.rondas.length <= 1 ? (IZQ + this.ancho - DER) / 2 : IZQ + this.paso / 2 + i * this.paso; }
  y(v: number): number { return ARRIBA + ((this.maximo - v) / (this.maximo - this.minimo)) * (this.alto - ARRIBA - ABAJO); }

  /** % de la empresa en esa ronda, o null si no participó. */
  valor(fondoId: string, i: number): number | null {
    const x = this.rondas[i]?.resultados.find((r) => r.fondo_id === fondoId);
    return x ? Math.round(Number(x.rendimiento) * 1000) / 10 : null;
  }

  get detalle() {
    if (this.elegida === null) return [];
    return this.series.map((s) => ({ id: s.id, nombre: s.nombre, color: s.color, valor: this.valor(s.id, this.elegida!) }))
      .filter((v): v is { id: string; nombre: string; color: string; valor: number } => v.valor !== null)
      .sort((a, b) => b.valor - a.valor);
  }

  corto(nombre: string): string { return nombre.replace(/^Ronda\s*/i, 'R'); }
  pct(v: number): string { return `${v > 0 ? '+' : ''}${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`; }
}
