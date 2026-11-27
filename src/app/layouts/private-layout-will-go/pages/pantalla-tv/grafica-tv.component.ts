import { Component, Input, OnChanges } from '@angular/core';

export interface SerieTv { nombre: string; color: string; valores: number[]; }

const ANCHO = 1000;
const ALTO = 520;
const IZQ = 90;
const DER = 30;
const ARRIBA = 24;
const ABAJO = 56;

/** Gráfica de líneas grande para el televisor: se escala con la pantalla y no tiene interacción. */
@Component({
  selector: 'wg-grafica-tv',
  standalone: true,
  template: `
    <svg [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" class="block w-full h-full" role="img" [attr.aria-label]="titulo">
      <defs>
        @for (s of trazos; track s.nombre; let k = $index) {
          <linearGradient [attr.id]="idRelleno + k" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" [attr.stop-color]="s.color" stop-opacity="0.35" />
            <stop offset="100%" [attr.stop-color]="s.color" stop-opacity="0" />
          </linearGradient>
        }
      </defs>
      <!-- Líneas guía con su valor -->
      @for (m of marcas; track m) {
        <line [attr.x1]="izq" [attr.x2]="ancho - der" [attr.y1]="y(m)" [attr.y2]="y(m)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
        <text [attr.x]="izq - 14" [attr.y]="y(m) + 8" text-anchor="end" fill="rgba(255,255,255,0.7)" font-size="22" font-weight="600">{{ formato(m) }}</text>
      }
      @if (referencia !== null) {
        <line [attr.x1]="izq" [attr.x2]="ancho - der" [attr.y1]="y(referencia)" [attr.y2]="y(referencia)" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="8 8" />
      }
      <!-- Etiquetas del eje x -->
      @for (e of etiquetasX; track e.i) {
        <text [attr.x]="x(e.i)" [attr.y]="alto - 16" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="22" font-weight="600">{{ e.texto }}</text>
      }
      @for (s of trazos; track s.nombre; let k = $index) {
        @if (rellenar) { <path [attr.d]="s.area" [attr.fill]="'url(#' + idRelleno + k + ')'" /> }
        <polyline [attr.points]="s.linea" fill="none" [attr.stroke]="s.color" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />
        <circle [attr.cx]="s.fin.x" [attr.cy]="s.fin.y" r="11" [attr.fill]="s.color" stroke="#fff" stroke-width="4" />
      }
    </svg>
  `,
})
export class GraficaTvComponent implements OnChanges {
  @Input({ required: true }) series: SerieTv[] = [];
  /** Texto bajo cada punto (la misma cantidad que valores; los vacíos no se muestran). */
  @Input() etiquetas: string[] = [];
  /** Línea punteada de referencia (por ejemplo, la tasa inicial o los 100 invertidos). */
  @Input() referencia: number | null = null;
  @Input() rellenar = true;
  @Input() titulo = '';
  @Input() formato: (v: number) => string = (v) => Math.round(v).toLocaleString('es-CO');

  readonly ancho = ANCHO; readonly alto = ALTO; readonly izq = IZQ; readonly der = DER;
  readonly idRelleno = `wg-tv-${Math.random().toString(36).slice(2, 8)}-`;
  private minimo = 0;
  private maximo = 1;
  private puntos = 1;
  marcas: number[] = [];
  trazos: { nombre: string; color: string; linea: string; area: string; fin: { x: number; y: number } }[] = [];
  etiquetasX: { i: number; texto: string }[] = [];

  ngOnChanges(): void {
    this.puntos = Math.max(1, ...this.series.map((s) => s.valores.length));
    const todos = this.series.flatMap((s) => s.valores);
    if (this.referencia !== null) todos.push(this.referencia);
    let min = todos.length ? Math.min(...todos) : 0;
    let max = todos.length ? Math.max(...todos) : 1;
    if (max - min < 1e-9) { const m = Math.abs(max) * 0.05 || 1; min -= m; max += m; }
    const margen = (max - min) * 0.12;
    const paso = this.pasoBonito((max - min + 2 * margen) / 4);
    this.minimo = Math.floor((min - margen) / paso) * paso;
    this.maximo = Math.ceil((max + margen) / paso) * paso;
    this.marcas = [];
    for (let v = this.minimo; v <= this.maximo + paso / 2; v += paso) this.marcas.push(Math.round(v * 1000) / 1000);

    const base = ALTO - ABAJO;
    this.trazos = this.series.map((s) => {
      const pts = s.valores.map((v, i) => ({ x: this.x(i), y: this.y(v) }));
      const linea = pts.map((p) => `${p.x},${p.y}`).join(' ');
      const area = pts.length ? `M${pts[0].x},${base} ` + pts.map((p) => `L${p.x},${p.y}`).join(' ') + ` L${pts[pts.length - 1].x},${base} Z` : '';
      return { nombre: s.nombre, color: s.color, linea, area, fin: pts[pts.length - 1] ?? { x: this.x(0), y: this.y(0) } };
    });

    // Como máximo 7 etiquetas en el eje x, repartidas (siempre la primera y la última)
    const n = this.puntos;
    const cada = Math.max(1, Math.ceil(n / 7));
    this.etiquetasX = [];
    for (let i = 0; i < n; i += cada) if (this.etiquetas[i]) this.etiquetasX.push({ i, texto: this.etiquetas[i] });
    if (n > 1 && this.etiquetas[n - 1] && !this.etiquetasX.some((e) => e.i === n - 1)) {
      if (this.etiquetasX.length && n - 1 - this.etiquetasX[this.etiquetasX.length - 1].i < cada) this.etiquetasX.pop();
      this.etiquetasX.push({ i: n - 1, texto: this.etiquetas[n - 1] });
    }
  }

  x(i: number): number { return this.puntos <= 1 ? (IZQ + ANCHO - DER) / 2 : IZQ + 20 + (i * (ANCHO - IZQ - DER - 40)) / (this.puntos - 1); }
  y(v: number): number { return ARRIBA + ((this.maximo - v) / (this.maximo - this.minimo || 1)) * (ALTO - ARRIBA - ABAJO); }

  private pasoBonito(bruto: number): number {
    const p = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    const f = bruto / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
}
