import { Component, Input, OnChanges } from '@angular/core';

export interface RondaGrafica { nombre: string; resultados: { fondo_id: string; rendimiento: number }[] }
export interface FondoGrafica { id: string; nombre: string }

/** Colores fijos por empresa (en el orden de las empresas; validados para daltonismo). */
const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#9a6b2f'];
const ANCHO = 360, ALTO = 210, IZQ = 40, DER = 12, ARRIBA = 12, ABAJO = 28;

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
        <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          @for (s of series; track s.id) {
            <li class="flex items-center gap-1.5 text-xs text-gray-600">
              <span class="w-3 h-3 rounded-full shrink-0" [style.background]="s.color" aria-hidden="true"></span>{{ s.nombre }}
            </li>
          }
        </ul>

        <svg [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" class="mt-2 w-full h-auto select-none" role="img" [attr.aria-label]="'Gráfica del rendimiento de las empresas en ' + rondas.length + ' rondas'">
          <!-- Rejilla y eje -->
          @for (t of marcas; track t) {
            <line [attr.x1]="izq" [attr.x2]="ancho - der" [attr.y1]="y(t)" [attr.y2]="y(t)" [attr.stroke]="t === 0 ? '#9ca3af' : '#eef0f2'" [attr.stroke-width]="t === 0 ? 1.5 : 1" />
            <text [attr.x]="izq - 6" [attr.y]="y(t) + 3.5" text-anchor="end" font-size="10" fill="#6b7280">{{ t > 0 ? '+' : '' }}{{ t }}%</text>
          }
          @for (r of rondas; track $index; let i = $index) {
            <text [attr.x]="x(i)" [attr.y]="alto - 8" text-anchor="middle" font-size="10" [attr.fill]="i === elegida ? '#111827' : '#6b7280'" [attr.font-weight]="i === elegida ? 700 : 400">{{ corto(r.nombre) }}</text>
          }
          @if (elegida !== null) {
            <line [attr.x1]="x(elegida)" [attr.x2]="x(elegida)" [attr.y1]="arriba" [attr.y2]="alto - abajo" stroke="#d1d5db" stroke-width="1" stroke-dasharray="3 3" />
          }
          <!-- Líneas -->
          @for (s of series; track s.id) {
            @if (s.puntos.length > 1) {
              <polyline [attr.points]="s.trazo" fill="none" [attr.stroke]="s.color" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
            }
            @for (p of s.puntos; track p.i) {
              <circle [attr.cx]="x(p.i)" [attr.cy]="y(p.v)" [attr.r]="p.i === elegida ? 5 : 4" [attr.fill]="s.color" stroke="#fff" stroke-width="2" />
            }
          }
          <!-- Zonas para tocar cada ronda (más grandes que los puntos) -->
          @for (r of rondas; track $index; let i = $index) {
            <rect [attr.x]="x(i) - paso / 2" [attr.y]="0" [attr.width]="paso" [attr.height]="alto" fill="transparent" class="cursor-pointer"
                  (click)="elegida = i" (mouseenter)="elegida = i" />
          }
        </svg>

        <!-- Detalle de la ronda elegida -->
        @if (elegida !== null) {
          <div class="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-3">
            <p class="text-xs font-semibold text-gray-500 mb-2">{{ rondas[elegida].nombre }}</p>
            <ul class="space-y-1.5">
              @for (v of detalle; track v.id) {
                <li class="flex items-center gap-2 text-sm">
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
export class GraficaRendimientoComponent implements OnChanges {
  @Input({ required: true }) fondos: FondoGrafica[] = [];
  /** Rondas cerradas, de la más vieja a la más nueva. */
  @Input({ required: true }) rondas: RondaGrafica[] = [];

  readonly ancho = ANCHO; readonly alto = ALTO; readonly izq = IZQ; readonly der = DER; readonly arriba = ARRIBA; readonly abajo = ABAJO;
  series: { id: string; nombre: string; color: string; puntos: { i: number; v: number }[]; trazo: string }[] = [];
  marcas: number[] = [];
  elegida: number | null = null;
  verTabla = false;
  private limite = 5;

  ngOnChanges(): void {
    const todos = this.rondas.flatMap((r) => r.resultados.map((x) => Math.abs(Number(x.rendimiento) * 100)));
    const maximo = Math.max(5, ...todos);
    const salto = maximo <= 10 ? 5 : maximo <= 20 ? 10 : 20;
    this.limite = Math.ceil(maximo / salto) * salto;
    this.marcas = [];
    for (let t = -this.limite; t <= this.limite; t += salto) this.marcas.push(t);
    this.series = this.fondos.map((f, k) => {
      const puntos = this.rondas.map((_, i) => ({ i, v: this.valor(f.id, i) })).filter((p): p is { i: number; v: number } => p.v !== null);
      return { id: f.id, nombre: f.nombre, color: COLORES[k % COLORES.length], puntos, trazo: puntos.map((p) => `${this.x(p.i)},${this.y(p.v)}`).join(' ') };
    });
    this.elegida = this.rondas.length ? this.rondas.length - 1 : null;
  }

  get paso(): number { return (ANCHO - IZQ - DER) / Math.max(this.rondas.length, 1); }
  x(i: number): number { return this.rondas.length <= 1 ? (IZQ + ANCHO - DER) / 2 : IZQ + this.paso / 2 + i * this.paso; }
  y(v: number): number { return ARRIBA + ((this.limite - v) / (2 * this.limite)) * (ALTO - ARRIBA - ABAJO); }

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
