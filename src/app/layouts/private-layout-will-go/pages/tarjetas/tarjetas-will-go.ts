import { Component, DOCUMENT, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
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
        <button type="button" (click)="volver()" class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-800">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          {{ 'wg.cuentas.tarjetas.volver' | translate }}
        </button>
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ 'wg.cuentas.tarjetas.titulo' | translate }}</p>
        <h1 class="text-xl font-bold text-gray-800 break-words">{{ nombreEdicion || '—' }}</h1>
        @if (!cargando && !error && tarjetas.length) {
          <div class="mt-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
            <div class="sm:w-64 shrink-0">
              <label for="wg-tj-buscar" class="block text-xs font-semibold text-gray-500 mb-1">{{ 'wg.cuentas.tarjetas.buscar' | translate }}</label>
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
                <input id="wg-tj-buscar" type="search" [(ngModel)]="busqueda" [placeholder]="'wg.cuentas.tarjetas.buscarPh' | translate" autocomplete="off"
                       class="w-full h-11 pl-9 pr-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
            </div>
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
            <div>
              <p class="block text-xs font-semibold text-gray-500 mb-1">{{ 'wg.cuentas.tarjetas.lado' | translate }}</p>
              <div class="inline-flex gap-1 bg-gray-100 rounded-xl p-1" role="tablist">
                @for (l of lados; track l.id) {
                  <button type="button" role="tab" [attr.aria-selected]="lado === l.id" (click)="lado = l.id"
                          class="px-3 h-9 rounded-lg text-sm font-semibold whitespace-nowrap" [class]="lado === l.id ? 'bg-white shadow text-gray-900' : 'text-gray-600'">{{ l.texto | translate }}</button>
                }
              </div>
            </div>
            <div>
              <p class="block text-xs font-semibold text-gray-500 mb-1">{{ 'wg.cuentas.tarjetas.tamano' | translate }}</p>
              <div class="inline-flex gap-1 bg-gray-100 rounded-xl p-1" role="tablist">
                @for (o of tamanos; track o.id) {
                  <button type="button" role="tab" [attr.aria-selected]="tamano === o.id" (click)="elegirTamano(o.id)"
                          class="px-3 h-9 rounded-lg text-sm font-semibold whitespace-nowrap" [class]="tamano === o.id ? 'bg-white shadow text-gray-900' : 'text-gray-600'">{{ o.texto | translate }}</button>
                }
              </div>
            </div>
            <p class="flex-1 text-sm text-gray-600 whitespace-nowrap">{{ (visibles.length === 1 ? 'wg.cuentas.tarjetas.una' : 'wg.cuentas.tarjetas.varias') | translate: { n: visibles.length } }}</p>
            <button type="button" (click)="imprimir()" [disabled]="!visibles.length"
                    class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              {{ 'wg.cuentas.tarjetas.imprimir' | translate }}
            </button>
          </div>
          <p class="mt-3 text-xs text-gray-500">{{ (tamano === 'grande' ? 'wg.cuentas.tarjetas.consejoGrande' : 'wg.cuentas.tarjetas.consejo') | translate }}</p>
          @if (lado === 'ambas' && tamano === 'real') { <p class="mt-1 text-xs text-gray-500">{{ 'wg.cuentas.tarjetas.consejoReverso' | translate }}</p> }
        }
      </div>

      @if (cargando) {
        <div class="wg-tj-noimprimir max-w-4xl mx-auto mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.cuentas.cargando' | translate }}</div>
      } @else if (error) {
        <div class="wg-tj-noimprimir max-w-4xl mx-auto mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!visibles.length) {
        <div class="wg-tj-noimprimir max-w-4xl mx-auto mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ (tarjetas.length ? 'wg.cuentas.tarjetas.sinCoincidencias' : 'wg.cuentas.tarjetas.sinTarjetas') | translate }}</div>
      } @else {
        <!-- Cada tarjeta en su fila: el frente y, al lado, su reverso -->
        <div class="wg-tj-hoja" [class.wg-tj-grande]="tamano === 'grande'">
          @for (t of visibles; track t.id) {
            <!-- Las tarjetas de un estudiante (en tamaño grande, cada estudiante en su propia hoja) -->
            <div class="wg-tj-alumno">
            @if (lado !== 'reverso') {
              <div class="wg-tj-celda">
              <!-- Tarjeta débito GO.BANK (cada QR lleva la llave del estudiante) -->
                <article class="wg-tj-tarjeta">
                  <svg class="wg-tj-onda" viewBox="0 0 856 540" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M856 300 C 760 430 520 505 200 540 L 856 540 Z" fill="#f47216" />
                    <path d="M856 300 C 760 430 520 505 200 540" fill="none" stroke="#f9a04a" stroke-width="3" />
                    <path d="M720 452 C 560 500 380 528 120 540" fill="none" stroke="#5fd32c" stroke-width="3" />
                  </svg>
                  <img class="wg-tj-gobank" src="assets/images/will-go/tarjeta-gobank.png" alt="GO.BANK">
                  <span class="wg-tj-debito">Debit Card <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7c2 3 2 7 0 10M12 5c3 4 3 10 0 14M16 3c4 5 4 13 0 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
                  <img class="wg-tj-willgo" src="assets/images/will-go/tarjeta-willgo.png" alt="Will-go! Will-Go Economy">
                  <p class="wg-tj-lema">Who translates, betrays! <b>Just speak!</b></p>
                  <div class="wg-tj-pie">
                    <p class="wg-tj-llave" [style.font-size]="tamLlave(t.llave)">{{ t.llave }}</p>
                    <p class="wg-tj-nombre" [style.font-size]="tamNombre(t).tam" [style.letter-spacing]="tamNombre(t).espacio">{{ t.nombre }} {{ t.apellido }}</p>
                  </div>
                  <div class="wg-tj-qr">
                    <wg-qr-llave [llave]="t.llave" [color]="'#001938'" />
                  </div>
                </article>
                </div>
            }
            @if (lado !== 'frente') {
              <div class="wg-tj-celda">
                    <!-- Reverso de la tarjeta -->
                    <article class="wg-tj-tarjeta wg-tj-atras">
                      <svg class="wg-tj-onda" viewBox="0 0 856 540" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M0 440 C 120 500 330 532 620 540 L 0 540 Z" fill="#f47216" />
                        <path d="M0 440 C 120 500 330 532 620 540" fill="none" stroke="#f9a04a" stroke-width="3" />
                        <path d="M150 496 C 320 522 500 535 760 540" fill="none" stroke="#5fd32c" stroke-width="3" />
                      </svg>
                      <div class="wg-tj-banda"></div>
                      <div class="wg-tj-firma">
                        <span class="wg-tj-firma-titulo">Authorized signature</span>
                        <span class="wg-tj-firma-nombre" [style.font-size]="tamFirma(t)">{{ t.nombre }} {{ t.apellido }}</span>
                      </div>
                      <span class="wg-tj-atras-sin">)))</span>
                      <p class="wg-tj-atras-texto">This card belongs to the <b>Will-Go Economy</b> program by Thinking Mind. It is personal and has no commercial value. If you find it, please return it to the <b>GO.BANK</b>.</p>
                      <p class="wg-tj-atras-llave">{{ t.llave }}</p>
                      <img class="wg-tj-atras-gobank" src="assets/images/will-go/tarjeta-gobank.png" alt="GO.BANK">
                      <img class="wg-tj-atras-willgo" src="assets/images/will-go/tarjeta-willgo.png" alt="Will-go!">
                    </article>
              </div>
            }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .wg-tj-hoja {
      display: grid;
      grid-template-columns: 85.6mm;
      justify-content: center;
      gap: 4mm;
      margin-top: 1.25rem;
    }
    /* En pantalla, igual que en la hoja: 2 columnas (frente y, al lado, su reverso) */
    @media (min-width: 640px) { .wg-tj-hoja { grid-template-columns: repeat(2, 85.6mm); } }
    /* Real: las tarjetas van seguidas (2 columnas). Grande: cada estudiante en su hoja, frente y reverso ampliados */
    .wg-tj-alumno { display: contents; }
    .wg-tj-grande { grid-template-columns: 1fr !important; }
    .wg-tj-grande .wg-tj-alumno {
      display: flex; flex-direction: column; align-items: center; gap: 12mm;
      padding: 6mm 0 10mm; border-bottom: 2px dashed #cbd5e1;
    }
    .wg-tj-grande .wg-tj-celda { zoom: 1; }
    @media (min-width: 900px) { .wg-tj-grande .wg-tj-celda { zoom: 1.4; } }
    .wg-tj-celda {
      width: 85.6mm;
      height: 54mm;
      outline: 0.25mm dashed #94a3b8;
      outline-offset: 0.8mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    /* Diseño GO.BANK: azul noche, logos arriba, lema, llave y QR; onda naranja abajo a la derecha */
    .wg-tj-tarjeta {
      position: relative;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border-radius: 3.2mm;
      background: #001938;
      color: #fff;
      overflow: hidden;
      box-shadow: 0 4px 14px rgba(15, 23, 42, .25);
      font-family: 'Poppins', 'Montserrat', system-ui, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wg-tj-onda { position: absolute; inset: 0; width: 100%; height: 100%; }
    .wg-tj-gobank { position: absolute; left: 4.6mm; top: 3.6mm; height: 7.4mm; width: auto; }
    .wg-tj-debito {
      position: absolute; right: 4mm; top: 4.2mm;
      display: inline-flex; align-items: center; gap: .8mm;
      padding: .9mm 2.4mm; border: .35mm solid #5fd32c; border-radius: 99mm;
      font-size: 2.6mm; font-weight: 500; line-height: 1; white-space: nowrap;
    }
    .wg-tj-debito svg { width: 3mm; height: 3mm; }
    .wg-tj-willgo { position: absolute; left: 4.4mm; top: 13.2mm; height: 10.6mm; width: auto; }
    .wg-tj-lema {
      position: absolute; left: 4.4mm; top: 25.6mm; margin: 0;
      padding: .8mm 2.4mm; border: .3mm solid #f47216; border-radius: 99mm;
      font-size: 2.05mm; font-style: italic; font-weight: 500; line-height: 1.1; white-space: nowrap;
    }
    .wg-tj-lema b { color: #f9a04a; font-weight: 800; }
    .wg-tj-pie { position: absolute; left: 4.8mm; bottom: 6.2mm; width: 47mm; }
    .wg-tj-llave {
      margin: 0;
      font-size: 4.6mm;
      font-weight: 700;
      line-height: 1.15;
      white-space: nowrap;
    }
    .wg-tj-nombre {
      margin: .9mm 0 0;
      font-size: 2.1mm;
      font-weight: 600;
      line-height: 1.25;
      overflow-wrap: anywhere;
      text-transform: uppercase;
      letter-spacing: .28em;
    }
    .wg-tj-qr {
      position: absolute;
      right: 4mm;
      top: 11mm;
      width: 28mm;
      height: 28mm;
      padding: 1.6mm;
      background: #fff;
      border-radius: 2.6mm;
      box-sizing: border-box;
    }
    .wg-tj-qr wg-qr-llave { width: 100%; height: 100%; }

    /* Reverso */
    .wg-tj-banda { position: absolute; left: 0; right: 0; top: 4.5mm; height: 9mm; background: #0a0f1c; }
    .wg-tj-firma {
      position: absolute; left: 4.6mm; top: 16.4mm; width: 52mm; height: 8.4mm; box-sizing: border-box;
      padding: .7mm 2mm; border-radius: 1mm;
      background: repeating-linear-gradient(135deg, #f8fafc 0 1.4mm, #e2e8f0 1.4mm 2.8mm);
      color: #001938; display: flex; flex-direction: column; justify-content: center; overflow: hidden;
    }
    .wg-tj-firma-titulo { font-size: 1.5mm; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #64748b; }
    .wg-tj-firma-nombre { font-size: 3mm; font-weight: 600; font-style: italic; white-space: nowrap; }
    .wg-tj-atras-sin { position: absolute; left: 59mm; top: 18mm; font-size: 3.4mm; font-weight: 800; color: #5fd32c; letter-spacing: -.1em; }
    .wg-tj-atras-texto {
      position: absolute; left: 4.6mm; top: 26.6mm; width: 50mm; margin: 0;
      font-size: 1.85mm; line-height: 1.35; color: #cbd5e1;
    }
    .wg-tj-atras-texto b { color: #fff; }
    .wg-tj-atras-llave { position: absolute; left: 4.6mm; top: 36.4mm; margin: 0; font-size: 2.4mm; font-weight: 700; color: #f9a04a; white-space: nowrap; }
    .wg-tj-atras-gobank { position: absolute; right: 4mm; top: 28.6mm; height: 5.6mm; width: auto; }
    .wg-tj-atras-willgo { position: absolute; right: 4mm; top: 36mm; height: 6.6mm; width: auto; }

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
      /* Tamaño grande: una hoja por estudiante; 85,6 × 54 mm × 1,6 ≈ 137 × 86 mm cada lado */
      body.${CLASE_BODY} .wg-tj-grande { grid-template-columns: 1fr !important; gap: 0; }
      body.${CLASE_BODY} .wg-tj-grande .wg-tj-alumno { padding: 0; border: 0; gap: 10mm; break-after: page; page-break-after: always; }
      body.${CLASE_BODY} .wg-tj-grande .wg-tj-alumno:last-child { break-after: auto; page-break-after: auto; }
      body.${CLASE_BODY} .wg-tj-grande .wg-tj-celda { zoom: 1.6; }
      body.${CLASE_BODY} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `],
})
export class TarjetasWillGo implements OnInit, OnDestroy {
  private willGo = inject(WillGoService);
  private ruta = inject(ActivatedRoute);
  private documento = inject(DOCUMENT);
  private ubicacion = inject(Location);
  private router = inject(Router);

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

  /** Qué lado imprimir: frente, reverso o ambos (doble cara). */
  readonly lados: { id: 'frente' | 'reverso' | 'ambas'; texto: string }[] = [
    { id: 'ambas', texto: 'wg.cuentas.tarjetas.ambas' },
    { id: 'frente', texto: 'wg.cuentas.tarjetas.frente' },
    { id: 'reverso', texto: 'wg.cuentas.tarjetas.reverso' },
  ];
  /** Real: tamaño de tarjeta (varias por hoja). Grande: una hoja por estudiante, con la tarjeta ampliada. */
  readonly tamanos: { id: 'real' | 'grande'; texto: string }[] = [
    { id: 'real', texto: 'wg.cuentas.tarjetas.real' },
    { id: 'grande', texto: 'wg.cuentas.tarjetas.grande' },
  ];
  tamano: 'real' | 'grande' = (() => { try { return localStorage.getItem('wg_tarjetas_tamano') === 'grande' ? 'grande' : 'real'; } catch { return 'real'; } })();
  elegirTamano(t: 'real' | 'grande'): void {
    this.tamano = t;
    try { localStorage.setItem('wg_tarjetas_tamano', t); } catch { /* sin almacenamiento */ }
  }

  /** Por defecto, cada tarjeta con su frente y al lado su reverso. */
  lado: 'frente' | 'reverso' | 'ambas' = 'ambas';

  /** Nombre, apellido o llave (sin importar tildes ni mayúsculas), para imprimir solo algunas. */
  busqueda = '';
  private static normal(v: string): string {
    return (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  get visibles(): TarjetaImprimir[] {
    const palabras = TarjetasWillGo.normal(this.busqueda).split(/\s+/).filter(Boolean);
    return this.tarjetas.filter((t) => {
      if (this.paisId && t.pais_id !== this.paisId) return false;
      if (!palabras.length) return true;
      const texto = TarjetasWillGo.normal(`${t.nombre} ${t.apellido} ${t.llave}`);
      return palabras.every((p) => texto.includes(p));
    });
  }

  imprimir(): void { window.print(); }

  /** Vuelve a la pantalla anterior (Cuentas y tarjetas o la edición); si se abrió directo, a Cuentas y tarjetas. */
  volver(): void {
    if (typeof history !== 'undefined' && history.length > 1) this.ubicacion.back();
    else this.router.navigateByUrl('/private-will-go/cuentas');
  }

  /** Achica la llave para que quepa en una sola línea de la tarjeta (unos 47 mm de ancho). */
  tamLlave(llave: string): string {
    // Ancho medio de una letra en negrilla ≈ 0,62 del tamaño: la llave siempre cabe completa en una línea.
    return `${Math.min(4.6, 47 / (0.62 * Math.max(1, llave.length))).toFixed(2)}mm`;
  }

  /** Nombre en el recuadro de la firma (reverso): se achica para que quepa completo. */
  tamFirma(t: TarjetaImprimir): string {
    const n = Math.max(1, `${t.nombre} ${t.apellido}`.trim().length);
    return `${Math.min(3, 48 / (0.56 * n)).toFixed(2)}mm`;
  }

  /** El nombre completo: con nombres largos se junta el espaciado y se achica la letra (y si aún no cabe, pasa a 2 líneas). */
  tamNombre(t: TarjetaImprimir): { tam: string; espacio: string } {
    const n = Math.max(1, `${t.nombre} ${t.apellido}`.trim().length);
    const espacio = n <= 22 ? 0.28 : n <= 30 ? 0.16 : 0.08;
    const tam = Math.max(1.6, Math.min(2.1, 47 / ((0.66 + espacio) * n)));
    return { tam: `${tam.toFixed(2)}mm`, espacio: `${espacio}em` };
  }
}
