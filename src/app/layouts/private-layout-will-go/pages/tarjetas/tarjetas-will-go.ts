import { Component, DOCUMENT, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TarjetaImprimir, WillGoService } from '../../../../core/services/will-go.service';
import { QrLlaveComponent } from '../../qr-llave.component';

/** Clase que se pone en <body> mientras esta página está abierta: con ella se oculta el layout al imprimir. */
const CLASE_BODY = 'wg-imprimiendo-tarjetas';

/** Hoja para imprimir las tarjetas débito (tamaño tarjeta de crédito, 2 columnas en A4, con borde de corte). */
@Component({
  selector: 'app-tarjetas-will-go',
  standalone: true,
  imports: [FormsModule, TranslatePipe, QrLlaveComponent],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="wg-tj">
      <!-- Encabezado (no se imprime) -->
      <div class="wg-tj-noimprimir max-w-4xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ 'wg.cuentas.tarjetas.titulo' | translate }}</p>
        <h1 class="text-xl font-bold text-gray-800 break-words">{{ nombreEdicion || '—' }}</h1>
        @if (!cargando && !error && tarjetas.length) {
          <div class="mt-3 flex flex-col sm:flex-row sm:items-end gap-3">
            @if (paises.length > 1) {
              <div class="sm:w-60">
                <label for="wg-tj-pais" class="block text-xs font-semibold text-gray-500 mb-1">{{ 'wg.cuentas.tarjetas.pais' | translate }}</label>
                <select id="wg-tj-pais" [(ngModel)]="paisId"
                        class="w-full h-11 px-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <option value="">{{ 'wg.cuentas.tarjetas.todos' | translate }}</option>
                  @for (p of paises; track p.id) { <option [value]="p.id">{{ p.nombre }}</option> }
                </select>
              </div>
            }
            <p class="flex-1 text-sm text-gray-600">{{ (visibles.length === 1 ? 'wg.cuentas.tarjetas.una' : 'wg.cuentas.tarjetas.varias') | translate: { n: visibles.length } }}</p>
            <button type="button" (click)="imprimir()" [disabled]="!visibles.length"
                    class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              {{ 'wg.cuentas.tarjetas.imprimir' | translate }}
            </button>
          </div>
          <p class="mt-3 text-xs text-gray-500">{{ 'wg.cuentas.tarjetas.consejo' | translate }}</p>
        }
      </div>

      @if (cargando) {
        <div class="wg-tj-noimprimir max-w-4xl mx-auto mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.cuentas.cargando' | translate }}</div>
      } @else if (error) {
        <div class="wg-tj-noimprimir max-w-4xl mx-auto mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!visibles.length) {
        <div class="wg-tj-noimprimir max-w-4xl mx-auto mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.cuentas.tarjetas.sinTarjetas' | translate }}</div>
      } @else {
        <div class="wg-tj-hoja">
          @for (t of visibles; track t.id) {
            <div class="wg-tj-celda">
              <article class="wg-tj-tarjeta" [style.background]="degradado(t.color)">
                <div class="wg-tj-datos">
                  <p class="wg-tj-marca">WILL-GO ECONOMY · <span>{{ 'wg.cuentas.tarjetaDebito' | translate }}</span></p>
                  <p class="wg-tj-pais">{{ t.pais }}@if (t.codigo_moneda) { · {{ t.codigo_moneda }} }</p>
                  <div class="wg-tj-pie">
                    <p class="wg-tj-llave" [style.font-size]="tamLlave(t.llave)">{{ t.llave }}</p>
                    <p class="wg-tj-nombre">{{ t.nombre }} {{ t.apellido }}</p>
                  </div>
                </div>
                <div class="wg-tj-qr">
                  <wg-qr-llave [llave]="t.llave" [color]="'#0f172a'" />
                </div>
              </article>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .wg-tj-hoja {
      display: grid;
      grid-template-columns: repeat(auto-fill, 85.6mm);
      justify-content: center;
      gap: 4mm;
      margin-top: 1.25rem;
    }
    .wg-tj-celda {
      width: 85.6mm;
      height: 54mm;
      outline: 0.25mm dashed #94a3b8;
      outline-offset: 0.8mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .wg-tj-tarjeta {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border-radius: 3.2mm;
      padding: 3.6mm;
      display: flex;
      gap: 3mm;
      color: #fff;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(15, 23, 42, .18);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wg-tj-datos { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .wg-tj-marca { margin: 0; font-size: 2.3mm; font-weight: 800; letter-spacing: .12em; line-height: 1.25; opacity: .95; }
    .wg-tj-marca span { font-weight: 600; letter-spacing: .02em; }
    .wg-tj-pais { margin: 1mm 0 0; font-size: 3mm; font-weight: 600; opacity: .9; }
    .wg-tj-pie { margin-top: auto; }
    .wg-tj-llave {
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 4.4mm;
      font-weight: 800;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-shadow: 0 1px 2px rgba(0, 0, 0, .25);
    }
    .wg-tj-nombre {
      margin: 1mm 0 0;
      font-size: 3.2mm;
      font-weight: 600;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .wg-tj-qr {
      flex-shrink: 0;
      align-self: center;
      width: 36mm;
      height: 36mm;
      padding: 1.5mm;
      background: #fff;
      border-radius: 2.4mm;
      box-sizing: border-box;
    }
    .wg-tj-qr wg-qr-llave { width: 100%; height: 100%; }

    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      body.${CLASE_BODY} { background: #fff !important; }
      body.${CLASE_BODY} aside,
      body.${CLASE_BODY} header,
      body.${CLASE_BODY} .wg-tj-noimprimir { display: none !important; }
      body.${CLASE_BODY} main { padding: 0 !important; margin: 0 !important; }
      body.${CLASE_BODY} .min-h-screen { min-height: 0 !important; background: #fff !important; }
      body.${CLASE_BODY} .wg-tj-hoja {
        grid-template-columns: repeat(2, 85.6mm);
        gap: 3mm 4mm;
        margin: 0;
      }
      body.${CLASE_BODY} .wg-tj-tarjeta { box-shadow: none; }
      body.${CLASE_BODY} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `],
})
export class TarjetasWillGo implements OnInit, OnDestroy {
  private willGo = inject(WillGoService);
  private ruta = inject(ActivatedRoute);
  private documento = inject(DOCUMENT);

  nombreEdicion = '';
  tarjetas: TarjetaImprimir[] = [];
  paisId = '';
  cargando = true;
  error = '';

  ngOnInit(): void {
    this.documento.body.classList.add(CLASE_BODY);
    const edicion = this.ruta.snapshot.queryParamMap.get('edicion') ?? '';
    if (!edicion) { this.cargando = false; return; }
    this.willGo.tarjetasParaImprimir(edicion).subscribe({
      next: (d) => { this.nombreEdicion = d.edicion?.nombre ?? ''; this.tarjetas = d.tarjetas ?? []; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  ngOnDestroy(): void {
    this.documento.body.classList.remove(CLASE_BODY);
  }

  /** Países que aparecen en las tarjetas (para el filtro). */
  get paises(): { id: string; nombre: string }[] {
    const vistos = new Map<string, string>();
    for (const t of this.tarjetas) if (!vistos.has(t.pais_id)) vistos.set(t.pais_id, t.pais);
    return [...vistos].map(([id, nombre]) => ({ id, nombre }));
  }

  get visibles(): TarjetaImprimir[] {
    return this.paisId ? this.tarjetas.filter((t) => t.pais_id === this.paisId) : this.tarjetas;
  }

  /** Degradado con el color del país (más oscuro hacia abajo a la derecha). */
  degradado(color: string | null): string {
    const c = color || '#1e293b';
    return `linear-gradient(135deg, ${c} 0%, color-mix(in srgb, ${c} 62%, #000) 100%)`;
  }

  imprimir(): void { window.print(); }

  /** Achica la llave para que quepa en una sola línea de la tarjeta (unos 40 mm de ancho). */
  tamLlave(llave: string): string {
    return `${Math.min(4.4, 40 / (0.62 * Math.max(1, llave.length))).toFixed(2)}mm`;
  }
}
