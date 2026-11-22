import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { DatosDocente, EstudianteDocente, PaisDocente, WillGoService, EdicionVigente } from '../../../../core/services/will-go.service';
import { NumeroMilesDirective, formatearNumero } from '../../numero-miles.directive';
import { imagenBillete } from '../../imagen-billete';
import { ListaMovimientosComponent, MovimientoLista } from '../../lista-movimientos.component';

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Pantalla del docente: sus billetes (los que le dio el banco) y entregarlos a los estudiantes. */
@Component({
  selector: 'app-entregar-will-go',
  standalone: true,
  imports: [FormsModule, NumeroMilesDirective, ListaMovimientosComponent, SelectorEdicionComponent, TranslatePipe],
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.operacion.entregar.titulo' | translate }}</h1>
          <p class="text-gray-500 mt-1">{{ 'wg.operacion.entregar.subtitulo' | translate }}</p>
        </div>
      </div>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" (cambio)="cargar()" />

      @if (cargando) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.operacion.comun.cargando' | translate }}</div>
      } @else if (error) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.operacion.comun.sinEquipo' | translate }}</div>
      } @else if (datos && pais) {
        @if (datos.paises.length > 1) {
          <div class="mt-5 flex flex-wrap gap-2">
            @for (p of datos.paises; track p.id) {
              <button type="button" (click)="elegirPais(p)" class="px-4 py-2 rounded-xl text-sm font-semibold border-2"
                      [style.background]="pais.id === p.id ? (p.color || '#1e293b') : '#fff'" [style.border-color]="p.color || '#cbd5e1'"
                      [style.color]="pais.id === p.id ? '#fff' : '#334155'">{{ p.nombre }}</button>
            }
          </div>
        }

        <!-- Mis billetes -->
        <div class="mt-4 rounded-2xl p-5 text-white shadow" [style.background]="pais.color || '#1e293b'">
          <p class="text-sm opacity-90">{{ 'wg.operacion.entregar.tusBilletesDe' | translate: { pais: pais.nombre } }}</p>
          <p class="text-3xl font-extrabold mt-1 break-all">{{ miles(pais.saldo) }} <span class="text-base font-semibold opacity-90">{{ pais.codigo_moneda }}</span></p>
          @if (conBilletes.length) {
            <button type="button" (click)="verBilletes = !verBilletes" [attr.aria-expanded]="verBilletes"
                    class="mt-3 inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-sm font-semibold">
              {{ (verBilletes ? 'wg.operacion.entregar.ocultarBilletes' : 'wg.operacion.entregar.verBilletes') | translate }}
              <svg class="w-4 h-4 transition-transform" [class.rotate-180]="verBilletes" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
          }
          @if (datos.edicion.estado !== 'abierta') {
            <p class="text-sm mt-2 bg-white/20 rounded-lg px-3 py-1.5 inline-block">{{ 'wg.operacion.entregar.podrasEntregar' | translate }}</p>
          }
        </div>

        @if (verBilletes && conBilletes.length) {
          <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            @for (d of conBilletes; track d) {
              <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                @if (imagen(d); as src) {
                  <img [src]="src" [alt]="'wg.operacion.comun.billeteDe' | translate: { n: miles(d) }" class="w-full aspect-[520/281] object-cover">
                } @else {
                  <div class="w-full aspect-[520/281] flex items-center justify-center text-xl font-black text-white" [style.background]="pais.color || '#64748b'">{{ miles(d) }}</div>
                }
                <p class="py-1.5 text-center text-sm text-gray-600"><b class="text-gray-800 text-base">{{ miles(tengo(d)) }}</b> {{ (tengo(d) === 1 ? 'wg.operacion.comun.billete' : 'wg.operacion.comun.billetes') | translate }}</p>
              </div>
            }
          </div>
        }

        @if (aviso) {
          <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800" role="status">{{ aviso }}</p>
        }

        <!-- Pestañas -->
        <div class="mt-5 inline-flex gap-1 bg-white border border-gray-200 rounded-xl p-1" role="tablist">
          @for (v of vistas; track v.id) {
            <button type="button" role="tab" [attr.aria-selected]="vista === v.id" (click)="vista = v.id"
                    class="px-4 py-2 rounded-lg text-sm font-semibold" [class]="vista === v.id ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:bg-gray-100'">{{ v.texto | translate }}</button>
          }
        </div>

        @if (vista === 'estudiantes') {
          <input type="search" [(ngModel)]="busqueda" [placeholder]="'wg.operacion.comun.buscarEstudiante' | translate" [attr.aria-label]="'wg.operacion.comun.buscarEstudianteAria' | translate"
                 class="mt-4 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
          @if (!pais.estudiantes.length) {
            <div class="mt-3 bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">{{ 'wg.operacion.comun.noHayEstudiantesEn' | translate: { pais: pais.nombre } }}</div>
          } @else {
            <ul class="mt-3 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              @for (e of filtrados; track e.id) {
                <li class="flex items-center gap-3 px-4 py-3">
                  <div class="w-11 h-11 shrink-0 rounded-full text-white font-bold flex items-center justify-center" [style.background]="pais.color || '#0d9488'">{{ (e.nombre[0] || '') + (e.apellido[0] || '') }}</div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-gray-800 truncate">{{ e.nombre }} {{ e.apellido }}</p>
                    <p class="text-xs text-gray-500">{{ 'wg.operacion.entregar.tiene' | translate }} <b class="text-gray-700">{{ miles(e.saldo) }}</b></p>
                  </div>
                  <button type="button" (click)="abrir(e)" [disabled]="datos.edicion.estado !== 'abierta' || !pais.saldo"
                          class="shrink-0 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">{{ 'wg.operacion.entregar.botonEntregar' | translate }}</button>
                </li>
              }
              @if (!filtrados.length) { <li class="px-4 py-6 text-center text-sm text-gray-500">{{ 'wg.operacion.comun.nadieCoincide' | translate: { q: busqueda } }}</li> }
            </ul>
          }
        }

        @if (vista === 'movimientos') {
          <wg-lista-movimientos class="block mt-4" [movimientos]="movimientos" [pais]="pais" [totalEntro]="totalEntro" [totalSalio]="totalSalio"
                                [vacio]="'wg.operacion.entregar.vacioMovimientos' | translate" />
        }
      }
    </div>

    <!-- Panel para entregar -->
    @if (estudiante && pais && datos) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrar()">
        <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-entrega">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-entrega" class="text-lg font-bold text-gray-800">{{ 'wg.operacion.entregar.entregarA' | translate: { nombre: estudiante.nombre + ' ' + estudiante.apellido } }}</h2>
              <p class="text-sm text-gray-500">{{ 'wg.operacion.entregar.tocaBilletes' | translate }}</p>
              @if (recomendado && recomendado.estudiante === estudiante.id) {
                <p class="mt-1 inline-block text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">{{ 'wg.operacion.entregar.recompensaRecomendada' | translate: { n: recomendado.billetes } }}</p>
              }
            </div>
            <button type="button" (click)="cerrar()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.operacion.comun.cerrar' | translate">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5">
            @if (!conBilletes.length) {
              <p class="py-6 text-center text-sm text-gray-500">{{ 'wg.operacion.entregar.sinBilletes' | translate }}</p>
            }
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3">
              @for (d of conBilletes; track d) {
                <div class="rounded-xl border-2 overflow-hidden" [style.border-color]="cantidad(d) ? (pais.color || '#f97316') : '#e5e7eb'">
                  <button type="button" class="block w-full" (click)="sumar(d, 1)" [disabled]="tengo(d) - cantidad(d) <= 0" [attr.aria-label]="'wg.operacion.entregar.agregarBillete' | translate: { n: miles(d) }">
                    @if (imagen(d); as src) {
                      <img [src]="src" [alt]="'wg.operacion.comun.billeteDe' | translate: { n: miles(d) }" class="w-full aspect-[520/281] object-cover">
                    } @else {
                      <div class="w-full aspect-[520/281] flex items-center justify-center text-xl font-black text-white" [style.background]="pais.color || '#64748b'">{{ miles(d) }}</div>
                    }
                  </button>
                  <div class="flex items-center gap-1 p-1.5">
                    <button type="button" (click)="sumar(d, -1)" [disabled]="!cantidad(d)" class="w-9 h-9 shrink-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'wg.operacion.entregar.quitarBillete' | translate: { n: miles(d) }">−</button>
                    <input wgNumero [ngModel]="elegidos[d]" (ngModelChange)="elegidos[d] = $event" placeholder="0" [attr.aria-label]="'wg.operacion.entregar.billetesDe' | translate: { n: miles(d) }"
                           class="w-full min-w-0 h-9 bg-gray-50 border border-gray-200 rounded-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-300">
                    <button type="button" (click)="sumar(d, 1)" [disabled]="tengo(d) - cantidad(d) <= 0" class="w-9 h-9 shrink-0 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 disabled:opacity-30" [attr.aria-label]="'wg.operacion.entregar.agregarBillete' | translate: { n: miles(d) }">+</button>
                  </div>
                  <p class="text-[11px] text-center pb-1.5" [class]="cantidad(d) > tengo(d) ? 'text-red-600 font-semibold' : 'text-gray-500'">{{ 'wg.operacion.entregar.tienes' | translate: { n: miles(tengo(d)) } }}</p>
                </div>
              }
            </div>
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            @if (errorEntrega) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorEntrega }}</p> }
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm text-gray-500">{{ 'wg.operacion.entregar.totalAEntregar' | translate }}</span>
              <span class="text-2xl font-extrabold text-gray-800 break-all">{{ miles(total) }} <span class="text-sm font-semibold text-gray-500">{{ pais.codigo_moneda }}</span></span>
            </div>
            <button type="button" (click)="entregar()" [disabled]="!total || enviando || excede"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              {{ enviando ? ('wg.operacion.comun.entregando' | translate) : (total ? ('wg.operacion.comun.entregarMonto' | translate: { n: miles(total) }) : ('wg.operacion.comun.eligeBilletes' | translate)) }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EntregarWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private t = inject(TranslateService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  readonly vistas: { id: 'estudiantes' | 'movimientos'; texto: string }[] = [
    { id: 'estudiantes', texto: 'wg.operacion.entregar.vistaEstudiantes' },
    { id: 'movimientos', texto: 'wg.operacion.entregar.vistaMovimientos' },
  ];

  ediciones: EdicionVigente[] = [];
  edicionId = '';
  datos: DatosDocente | null = null;
  pais: PaisDocente | null = null;
  vista: 'estudiantes' | 'movimientos' = 'estudiantes';
  busqueda = '';
  verBilletes = false;
  cargando = true;
  error = '';
  aviso = '';

  estudiante: EstudianteDocente | null = null;
  elegidos: Record<number, number | null> = {};
  clave = '';
  enviando = false;
  errorEntrega = '';

  ngOnInit(): void {
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  cargar(): void {
    this.cargando = true;
    this.willGo.panelDocente(this.edicionId).subscribe({
      next: (d) => {
        this.datos = d;
        // Por defecto, el país donde tiene billetes
        this.pais = d.paises.find((p) => p.id === this.pais?.id) ?? d.paises.find((p) => p.saldo > 0) ?? d.paises[0] ?? null;
        this.cargando = false;
        this.abrirRecomendado();
      },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  elegirPais(p: PaisDocente): void {
    this.pais = p;
    this.busqueda = '';
  }

  get filtrados(): EstudianteDocente[] {
    const palabras = normalizar(this.busqueda).split(/\s+/).filter(Boolean);
    return (this.pais?.estudiantes ?? []).filter((e) => { const n = normalizar(`${e.nombre} ${e.apellido} ${e.codigo}`); return palabras.every((w) => n.includes(w)); });
  }

  get conBilletes(): number[] {
    return (this.datos?.denominaciones ?? []).filter((d) => this.tengo(d) > 0);
  }

  imagen(d: number): string | null { return imagenBillete(this.pais ?? undefined, d); }
  tengo(d: number): number { return Number(this.pais?.inventario?.[d] ?? 0); }
  cantidad(d: number): number { return Number(this.elegidos[d]) || 0; }
  get total(): number { return (this.datos?.denominaciones ?? []).reduce((t, d) => t + d * this.cantidad(d), 0); }
  get excede(): boolean { return (this.datos?.denominaciones ?? []).some((d) => this.cantidad(d) > this.tengo(d)) || this.total > (this.pais?.saldo ?? 0); }
  sumar(d: number, n: number): void { this.elegidos[d] = Math.max(0, Math.min(this.cantidad(d) + n, Math.max(this.tengo(d), 0))); }

  /** Lo que entra (del banco) y lo que sale (a estudiantes), del más reciente al más viejo. */
  get movimientos(): MovimientoLista[] {
    const p = this.pais;
    if (!p) return [];
    const idioma = this.t.getCurrentLang();
    if (this.cacheMov?.pais === p && this.cacheMov.idioma === idioma) return this.cacheMov.lista;
    const lista = [
      ...p.recibidos.map((m) => ({ id: m.id, entra: true, titulo: this.t.instant('wg.operacion.entregar.recibidoBanco'), quien: m.quien || '', monto: Number(m.monto), fecha: m.date_created, billetes: m.billetes })),
      ...p.entregas.map((m) => ({ id: m.id, entra: false, titulo: this.t.instant('wg.operacion.entregar.entregadoA', { nombre: `${m.nombre ?? ''} ${m.apellido ?? ''}`.trim() }), monto: Number(m.monto), fecha: m.date_created, billetes: m.billetes })),
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    this.cacheMov = { pais: p, idioma, lista };
    return lista;
  }
  private cacheMov: { pais: PaisDocente; idioma: string; lista: MovimientoLista[] } | null = null;

  get totalEntro(): number { return Number(this.pais?.total_recibido ?? 0); }
  get totalSalio(): number { return Number(this.pais?.total_entregado ?? 0); }

  /** Viene de la rúbrica (?estudiante=…&billetes=…): abre de una vez el panel para entregarle la recompensa. */
  private route = inject(ActivatedRoute);
  recomendado: { estudiante: string; billetes: number } | null = null;
  private yaAbierto = false;

  private abrirRecomendado(): void {
    if (this.yaAbierto || !this.datos) return;
    const q = this.route.snapshot.queryParamMap;
    const id = q.get('estudiante');
    if (!id) return;
    this.yaAbierto = true;
    for (const p of this.datos.paises) {
      const e = p.estudiantes.find((x) => x.id === id);
      if (e) {
        this.pais = p;
        this.recomendado = { estudiante: id, billetes: Number(q.get('billetes')) || 0 };
        this.abrir(e);
        return;
      }
    }
  }

  abrir(e: EstudianteDocente): void {
    this.estudiante = e;
    this.elegidos = {};
    this.errorEntrega = '';
    this.clave = crypto.randomUUID();
  }

  cerrar(): void {
    if (!this.enviando) this.estudiante = null;
  }

  entregar(): void {
    if (!this.estudiante || !this.pais || !this.total || this.excede) return;
    const billetes: Record<string, number> = {};
    for (const d of this.datos!.denominaciones) if (this.cantidad(d)) billetes[d] = this.cantidad(d);
    const est = this.estudiante;
    this.enviando = true;
    this.errorEntrega = '';
    this.willGo.entregarAEstudiante(est.id, billetes, this.clave).subscribe({
      next: (r) => {
        this.enviando = false;
        this.estudiante = null;
        this.aviso = this.t.instant('wg.operacion.entregar.avisoEntregaste', { monto: this.miles(r.monto), nombre: est.nombre });
        setTimeout(() => (this.aviso = ''), 5000);
        this.cargar();
      },
      error: (e) => { this.enviando = false; this.errorEntrega = WillGoService.mensajeDeError(e); },
    });
  }
}
