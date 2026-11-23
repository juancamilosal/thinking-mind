import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CalificacionRubrica, CriterioRubrica, DatosRubrica, EstudianteRubrica, PaisRubrica, WillGoService, EdicionVigente } from '../../../../core/services/will-go.service';
import { formatearNumero } from '../../numero-miles.directive';
import { SelectorEdicionComponent } from '../../selector-edicion.component';
import { FechaWillGoPipe } from '../../fecha.pipe';

type Idioma = 'ingles' | 'frances';
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const CLAVE_IDIOMA = 'wg-rubrica-idioma';

/** Rúbrica de la Especificación Maestra (sección 5): cada criterio de 0 a 3. Los textos son claves de traducción. */
const C = 'wg.operacion.rubrica.criterios.';
const niveles = (id: string) => [0, 1, 2, 3].map((n) => `${C}${id}.n${n}`);
const CRITERIOS: { id: CriterioRubrica; titulo: string; corto: string; niveles: string[]; icono: string }[] = [
  { id: 'uso_lengua', titulo: `${C}uso_lengua.titulo`, corto: `${C}uso_lengua.corto`,
    niveles: niveles('uso_lengua'),
    icono: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  { id: 'iniciativa', titulo: `${C}iniciativa.titulo`, corto: `${C}iniciativa.corto`,
    niveles: niveles('iniciativa'),
    icono: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'nivel_reto', titulo: `${C}nivel_reto.titulo`, corto: `${C}nivel_reto.corto`,
    niveles: niveles('nivel_reto'),
    icono: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
  { id: 'colaboracion', titulo: `${C}colaboracion.titulo`, corto: `${C}colaboracion.corto`,
    niveles: niveles('colaboracion'),
    icono: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
];

/** Recompensa recomendada por la Especificación Maestra (el servidor usa la misma tabla). */
const recompensa = (p: number) => (p >= 11 ? 20 : p >= 9 ? 10 : p >= 7 ? 5 : p >= 5 ? 2 : 0);

/** Rúbrica del docente: marca asistencia y califica (4 criterios Sí/No). Los puntos mueven el tipo de cambio. */
@Component({
  selector: 'app-rubrica-will-go',
  standalone: true,
  imports: [FormsModule, FechaWillGoPipe, SelectorEdicionComponent, TranslatePipe],
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">{{ 'wg.operacion.rubrica.titulo' | translate }}</h1>
          <p class="text-gray-500 mt-1">{{ 'wg.operacion.rubrica.subtitulo' | translate }}</p>
        </div>
      </div>
      <wg-selector-edicion class="block mt-4" [ediciones]="ediciones" [(edicionId)]="edicionId" (cambio)="cargar()" />

      @if (cargando && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">{{ 'wg.operacion.comun.cargando' | translate }}</div>
      } @else if (error && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">{{ 'wg.operacion.comun.sinEquipo' | translate }}</div>
      } @else if (datos && pais) {
        <!-- Idioma de la clase -->
        <div class="mt-5 flex items-center gap-3">
          <span class="text-sm font-semibold text-gray-600">{{ 'wg.operacion.rubrica.idioma' | translate }}</span>
          <div class="inline-flex gap-1 bg-white border border-gray-200 rounded-xl p-1" role="radiogroup" [attr.aria-label]="'wg.operacion.rubrica.idiomaAria' | translate">
            @for (i of idiomas; track i.id) {
              <button type="button" role="radio" [attr.aria-checked]="idioma === i.id" (click)="elegirIdioma(i.id)"
                      class="px-4 py-1.5 rounded-lg text-sm font-semibold" [class]="idioma === i.id ? 'bg-slate-800 text-white' : 'text-gray-500 hover:bg-gray-100'">{{ i.texto | translate }}</button>
            }
          </div>
        </div>

        @if (datos.paises.length > 1) {
          <div class="mt-4 flex flex-wrap gap-2">
            @for (p of datos.paises; track p.id) {
              <button type="button" (click)="pais = p; busqueda = ''" class="px-4 py-2 rounded-xl text-sm font-semibold border-2"
                      [style.background]="pais.id === p.id ? (p.color || '#1e293b') : '#fff'" [style.border-color]="p.color || '#cbd5e1'"
                      [style.color]="pais.id === p.id ? '#fff' : '#334155'">{{ p.nombre }}</button>
            }
          </div>
        }

        <!-- Resumen del país -->
        <div class="mt-4 rounded-2xl p-5 text-white shadow" [style.background]="pais.color || '#1e293b'">
          <p class="text-sm opacity-90">{{ pais.nombre }}</p>
          <div class="mt-2 grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs uppercase tracking-wide opacity-90">{{ 'wg.operacion.rubrica.tipoCambio' | translate }}</p>
              <p class="text-2xl font-extrabold">{{ miles(pais.tasa_actual) }}</p>
              <p class="text-xs opacity-90">{{ 'wg.operacion.rubrica.pesosPorBillete' | translate }}</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-wide opacity-90">{{ 'wg.operacion.rubrica.presentes' | translate }}</p>
              <p class="text-2xl font-extrabold">{{ presentes }} <span class="text-base font-semibold opacity-90">{{ 'wg.operacion.rubrica.deN' | translate: { n: pais.estudiantes.length } }}</span></p>
              <p class="text-xs opacity-90">{{ (calificadosHoy === 1 ? 'wg.operacion.rubrica.calificadoHoy' : 'wg.operacion.rubrica.calificadosHoy') | translate: { n: calificadosHoy } }}</p>
            </div>
          </div>
          @if (datos.edicion.estado !== 'abierta') {
            <p class="text-sm mt-3 bg-white/20 rounded-lg px-3 py-1.5 inline-block">{{ 'wg.operacion.rubrica.podrasCalificar' | translate }}</p>
          }
        </div>

        @if (aviso) {
          <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 flex flex-wrap items-center justify-between gap-3" role="status">
            <span>{{ aviso }}</span>
            <span class="flex items-center gap-3 shrink-0">
              @if (entregarA) { <button type="button" (click)="irAEntregar()" class="px-3 py-1.5 rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700">{{ 'wg.operacion.rubrica.entregarBilletes' | translate }}</button> }
              @if (ultimaId) { <button type="button" (click)="deshacer(ultimaId)" class="font-semibold underline">{{ 'wg.operacion.comun.deshacer' | translate }}</button> }
            </span>
          </p>
        }
        @if (error) { <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700" role="alert">{{ error }}</p> }

        <!-- Estudiantes -->
        <input type="search" [(ngModel)]="busqueda" [placeholder]="'wg.operacion.comun.buscarEstudiante' | translate" [attr.aria-label]="'wg.operacion.comun.buscarEstudianteAria' | translate"
               class="mt-5 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
        <ul class="mt-3 space-y-3">
          @for (e of filtrados; track e.id) {
            <!-- Cada estudiante en su tarjeta; en celular el botón Calificar va debajo -->
            <li class="rounded-2xl border border-gray-200 shadow-sm px-4 py-4 flex flex-wrap sm:flex-nowrap items-center gap-3" [class]="e.presente ? 'bg-white' : 'bg-gray-50'">
              <button type="button" (click)="alternarAsistencia(e)" [disabled]="datos.edicion.estado !== 'abierta'"
                      class="shrink-0 w-11 h-11 p-0 rounded-full flex items-center justify-center border-2 transition disabled:opacity-50"
                      [class]="e.presente ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-300 bg-white text-gray-300'"
                      [attr.aria-label]="(e.presente ? 'wg.operacion.rubrica.ariaPresente' : 'wg.operacion.rubrica.ariaAusente') | translate: { nombre: e.nombre }" [attr.aria-pressed]="e.presente">
                <svg class="shrink-0" width="24" height="24" style="width:24px;height:24px" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
              </button>
              <div class="min-w-0 flex-1">
                <p class="font-semibold leading-snug" [class]="e.presente ? 'text-gray-800' : 'text-gray-400'">{{ e.nombre }} {{ e.apellido }}</p>
                <p class="text-xs text-gray-500">{{ (e.presente ? 'wg.operacion.rubrica.presente' : 'wg.operacion.rubrica.ausente') | translate }}@if (e.hoy) { · {{ (e.hoy === 1 ? 'wg.operacion.rubrica.calificadoVez' : 'wg.operacion.rubrica.calificadoVeces') | translate: { n: e.hoy } }} }</p>
              </div>
              <button type="button" (click)="abrir(e)" [disabled]="datos.edicion.estado !== 'abierta'"
                      class="w-full sm:w-auto shrink-0 px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">{{ 'wg.operacion.rubrica.calificar' | translate }}</button>
            </li>
          }
          @if (!filtrados.length) {
            <li class="bg-white rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">{{ pais.estudiantes.length ? ('wg.operacion.comun.nadieCoincide' | translate: { q: busqueda }) : ('wg.operacion.comun.noHayEstudiantesEn' | translate: { pais: pais.nombre }) }}</li>
          }
        </ul>

        <!-- Mis últimas calificaciones -->
        @if (datos.recientes.length) {
          <h2 class="mt-6 text-sm font-bold text-gray-700">{{ 'wg.operacion.rubrica.ultimas' | translate }}</h2>
          <ul class="mt-2 space-y-3">
            @for (r of datos.recientes; track r.id) {
              <li class="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 flex items-start gap-3">
                <div class="w-12 h-12 shrink-0 rounded-xl bg-slate-800 text-white flex flex-col items-center justify-center leading-none">
                  <span class="text-lg font-black">{{ r.puntaje }}</span><span class="text-[10px] opacity-80">{{ 'wg.operacion.rubrica.de12' | translate }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <p class="font-semibold text-gray-800 leading-snug">{{ r.nombre }} {{ r.apellido }}</p>
                    <span class="text-xs text-gray-500 whitespace-nowrap">{{ r.date_created | wgFecha:'h:mm a' }}</span>
                  </div>
                  <div class="mt-1 flex flex-wrap gap-1">
                    @for (c of criterios; track c.id) {
                      <span class="text-[11px] px-1.5 py-0.5 rounded-full" [class]="r[c.id] >= 2 ? 'bg-emerald-100 text-emerald-800' : (r[c.id] === 1 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500')">{{ c.corto | translate }} {{ r[c.id] }}</span>
                    }
                  </div>
                  @if (r.evidencia) { <p class="text-xs text-gray-500 mt-1 truncate">“{{ r.evidencia }}”</p> }
                  <div class="mt-1 flex items-center justify-between gap-2">
                    @if (r.recompensa) { <p class="text-xs font-semibold text-amber-700">{{ 'wg.operacion.rubrica.recompensaRecomendada' | translate: { n: r.recompensa } }}</p> } @else { <span></span> }
                    @if (r.se_puede_deshacer) { <button type="button" (click)="deshacer(r.id)" class="text-xs font-semibold text-red-600 hover:underline">{{ 'wg.operacion.comun.deshacer' | translate }}</button> }
                  </div>
                </div>
              </li>
            }
          </ul>
        }
      }
    </div>

    <!-- Calificar: cada criterio de 0 a 3 -->
    @if (estudiante) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrar()">
        <div class="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-calificar">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-calificar" class="text-lg font-bold text-gray-800">{{ 'wg.operacion.rubrica.calificarA' | translate: { nombre: estudiante.nombre } }}</h2>
              <p class="text-sm text-gray-500">{{ 'wg.operacion.rubrica.eligeNivel' | translate: { idioma: ((idioma === 'frances' ? 'wg.operacion.rubrica.claseFrances' : 'wg.operacion.rubrica.claseIngles') | translate) } }}</p>
            </div>
            <button type="button" (click)="cerrar()" class="p-1 text-gray-400 hover:text-gray-600" [attr.aria-label]="'wg.operacion.comun.cerrar' | translate">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 pb-3">
            @for (c of criterios; track c.id; let primero = $first) {
              <!-- Cada criterio separado del anterior por una línea y más espacio -->
              <fieldset class="pb-5" [class]="primero ? '' : 'pt-5 border-t border-gray-200'">
                <legend class="flex items-center gap-2 mb-3 float-left w-full">
                  <span class="w-8 h-8 rounded-lg flex items-center justify-center" [class]="valores[c.id] !== null ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'" aria-hidden="true">
                    <svg width="18" height="18" style="width:18px;height:18px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="c.icono"/></svg>
                  </span>
                  <span class="font-bold text-gray-800">{{ c.titulo | translate }}</span>
                  @if (valores[c.id] !== null) { <span class="ml-auto text-sm font-bold text-emerald-700">{{ 'wg.operacion.rubrica.nDe3' | translate: { n: valores[c.id] } }}</span> }
                </legend>
                <div class="clear-both grid grid-cols-2 sm:grid-cols-4 gap-2.5" role="radiogroup" [attr.aria-label]="c.titulo | translate">
                  @for (texto of c.niveles; track $index; let n = $index) {
                    <button type="button" role="radio" [attr.aria-checked]="valores[c.id] === n" (click)="valores[c.id] = n"
                            class="text-left rounded-xl border-2 px-3 py-2 transition min-h-[64px]"
                            [class]="valores[c.id] === n ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'">
                      <span class="block text-lg font-black" [class]="valores[c.id] === n ? 'text-emerald-700' : 'text-gray-400'">{{ n }}</span>
                      <span class="block text-xs leading-tight" [class]="valores[c.id] === n ? 'text-emerald-900' : 'text-gray-600'">{{ texto | translate }}</span>
                    </button>
                  }
                </div>
              </fieldset>
            }
            <div class="pt-5 border-t border-gray-200">
              <label for="r-evidencia" class="block text-sm font-semibold text-gray-700">{{ 'wg.operacion.rubrica.evidencia' | translate }} <span class="font-normal text-gray-400">{{ 'wg.operacion.rubrica.opcional' | translate }}</span></label>
              <input id="r-evidencia" [(ngModel)]="evidencia" maxlength="255" [placeholder]="'wg.operacion.rubrica.placeholderEvidencia' | translate: { idioma: ((idioma === 'frances' ? 'wg.operacion.rubrica.claseFrances' : 'wg.operacion.rubrica.claseIngles') | translate) }"
                     class="mt-1 w-full px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            </div>
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-500">{{ 'wg.operacion.rubrica.puntaje' | translate }}</span>
              <span class="text-2xl font-extrabold text-gray-800">{{ puntaje }} <span class="text-sm font-semibold text-gray-500">{{ 'wg.operacion.rubrica.de12' | translate }}</span></span>
            </div>
            <div class="h-2 rounded-full bg-gray-200 overflow-hidden mb-2" aria-hidden="true">
              <div class="h-full rounded-full bg-emerald-500 transition-all" [style.width.%]="puntaje / 12 * 100"></div>
            </div>
            <p class="text-sm mb-3" [class]="recompensaActual ? 'text-amber-700 font-semibold' : 'text-gray-500'">
              {{ faltan ? ((faltan === 1 ? 'wg.operacion.rubrica.faltaCriterio' : 'wg.operacion.rubrica.faltanCriterios') | translate: { n: faltan }) : (recompensaActual ? ('wg.operacion.rubrica.recompensaRecomendadaPunto' | translate: { n: recompensaActual }) : ('wg.operacion.rubrica.sinRecompensa' | translate)) }}
            </p>
            @if (errorPanel) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorPanel }}</p> }
            <button type="button" (click)="guardar()" [disabled]="enviando || faltan > 0"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              {{ (enviando ? 'wg.operacion.comun.guardando' : 'wg.operacion.rubrica.guardarCalificacion') | translate }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class RubricaWillGo implements OnInit {
  private willGo = inject(WillGoService);
  private router = inject(Router);
  private t = inject(TranslateService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  readonly criterios = CRITERIOS;
  readonly idiomas: { id: Idioma; texto: string }[] = [{ id: 'ingles', texto: 'wg.operacion.rubrica.ingles' }, { id: 'frances', texto: 'wg.operacion.rubrica.frances' }];

  ediciones: EdicionVigente[] = [];
  edicionId = '';
  datos: DatosRubrica | null = null;
  pais: PaisRubrica | null = null;
  idioma: Idioma = 'ingles';
  busqueda = '';
  cargando = true;
  error = '';
  aviso = '';
  ultimaId: string | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  estudiante: EstudianteRubrica | null = null;
  /** Nivel elegido en cada criterio (null = todavía no lo eligió: los 4 son obligatorios). */
  valores: Record<CriterioRubrica, number | null> = { uso_lengua: null, iniciativa: null, nivel_reto: null, colaboracion: null };
  evidencia = '';
  /** Estudiante y billetes recomendados tras la última calificación (para ir a entregarlos). */
  entregarA: { id: string; billetes: number } | null = null;
  enviando = false;
  errorPanel = '';

  ngOnInit(): void {
    try { const i = localStorage.getItem(CLAVE_IDIOMA); if (i === 'ingles' || i === 'frances') this.idioma = i; } catch { /* sin almacenamiento */ }
    this.willGo.misEdiciones().subscribe({
      next: (l) => { this.ediciones = l; this.edicionId = l[0]?.id ?? ''; if (this.edicionId) this.cargar(); else this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  cargar(): void {
    this.cargando = true;
    this.willGo.rubrica(this.edicionId).subscribe({
      next: (d) => { this.datos = d; this.pais = d.paises.find((p) => p.id === this.pais?.id) ?? d.paises[0] ?? null; this.cargando = false; },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); this.cargando = false; },
    });
  }

  elegirIdioma(i: Idioma): void {
    this.idioma = i;
    try { localStorage.setItem(CLAVE_IDIOMA, i); } catch { /* sin almacenamiento */ }
  }

  get filtrados(): EstudianteRubrica[] {
    const palabras = normalizar(this.busqueda).split(/\s+/).filter(Boolean);
    return (this.pais?.estudiantes ?? []).filter((e) => { const n = normalizar(`${e.nombre} ${e.apellido}`); return palabras.every((w) => n.includes(w)); });
  }
  get presentes(): number { return (this.pais?.estudiantes ?? []).filter((e) => e.presente).length; }
  get calificadosHoy(): number { return (this.pais?.estudiantes ?? []).filter((e) => e.hoy > 0).length; }
  get puntaje(): number { return CRITERIOS.reduce((t, c) => t + (this.valores[c.id] ?? 0), 0); }
  get faltan(): number { return CRITERIOS.filter((c) => this.valores[c.id] === null).length; }
  get recompensaActual(): number { return this.faltan ? 0 : recompensa(this.puntaje); }

  private avisar(texto: string, id: string | null = null, entregarA: { id: string; billetes: number } | null = null): void {
    this.aviso = texto;
    this.ultimaId = id;
    this.entregarA = entregarA;
    if (this.temporizador) clearTimeout(this.temporizador);
    // Si hay recompensa, el aviso se queda más tiempo para que alcance a ir a entregarla
    this.temporizador = setTimeout(() => { this.aviso = ''; this.ultimaId = null; this.entregarA = null; }, entregarA ? 20000 : 6000);
  }

  irAEntregar(): void {
    if (!this.entregarA) return;
    this.router.navigate(['/private-will-go/entregar'], { queryParams: { estudiante: this.entregarA.id, monto: this.entregarA.billetes } });
  }

  alternarAsistencia(e: EstudianteRubrica): void {
    const nuevo = !e.presente;
    e.presente = nuevo; // se ve de una vez; si falla, se revierte
    this.error = '';
    this.willGo.marcarAsistencia(e.id, nuevo).subscribe({
      error: (err) => { e.presente = !nuevo; this.error = WillGoService.mensajeDeError(err); },
    });
  }

  abrir(e: EstudianteRubrica): void {
    this.estudiante = e;
    this.valores = { uso_lengua: null, iniciativa: null, nivel_reto: null, colaboracion: null };
    this.evidencia = '';
    this.errorPanel = '';
  }

  cerrar(): void { if (!this.enviando) this.estudiante = null; }

  guardar(): void {
    const e = this.estudiante;
    if (!e || this.enviando || this.faltan) return;
    this.enviando = true;
    this.errorPanel = '';
    this.willGo.calificar(e.id, { ...this.valores } as Record<CriterioRubrica, number>, this.idioma, this.evidencia).subscribe({
      next: (r) => {
        this.enviando = false;
        this.estudiante = null;
        const texto = this.t.instant('wg.operacion.rubrica.avisoPuntaje', { nombre: e.nombre, puntaje: r.puntaje })
          + (r.recompensa ? ' ' + this.t.instant('wg.operacion.rubrica.avisoRecomendacion', { n: r.recompensa }) : '');
        this.avisar(texto, r.id ?? null, r.recompensa ? { id: e.id, billetes: r.recompensa } : null);
        this.cargar();
      },
      error: (err) => { this.enviando = false; this.errorPanel = WillGoService.mensajeDeError(err); },
    });
  }

  deshacer(id: string): void {
    this.error = '';
    this.willGo.deshacerCalificacion(id).subscribe({
      next: () => { this.avisar(this.t.instant('wg.operacion.rubrica.deshecha')); this.cargar(); },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
