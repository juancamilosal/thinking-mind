import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { CalificacionRubrica, CriterioRubrica, DatosRubrica, EstudianteRubrica, PaisRubrica, WillGoService } from '../../../../core/services/will-go.service';
import { formatearNumero } from '../../numero-miles.directive';

type Idioma = 'ingles' | 'frances';
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const CLAVE_IDIOMA = 'wg-rubrica-idioma';

/** Los 4 criterios: Sí suma 1 punto. */
const CRITERIOS: { id: CriterioRubrica; titulo: string; ayuda: (idioma: Idioma) => string; icono: string }[] = [
  { id: 'uso_lengua', titulo: 'Uso de la lengua', ayuda: (i) => `Se comunicó en ${i === 'frances' ? 'francés' : 'inglés'}`,
    icono: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  { id: 'iniciativa', titulo: 'Iniciativa', ayuda: () => 'Participó por su cuenta, sin que se lo pidieran',
    icono: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'nivel_reto', titulo: 'Nivel del reto', ayuda: () => 'Asumió un reto difícil para su nivel',
    icono: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
  { id: 'colaboracion', titulo: 'Colaboración', ayuda: () => 'Ayudó y trabajó en equipo',
    icono: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
];

/** Rúbrica del docente: marca asistencia y califica (4 criterios Sí/No). Los puntos mueven el tipo de cambio. */
@Component({
  selector: 'app-rubrica-will-go',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Rúbrica</h1>
          <p class="text-gray-500 mt-1">Califica a tus estudiantes. Sus puntos mueven el tipo de cambio de su país.</p>
        </div>
        @if (ediciones.length > 1) {
          <select [(ngModel)]="edicionId" (ngModelChange)="cargar()" aria-label="Edición" class="sm:w-72 px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
            @for (e of ediciones; track e.id) { <option [value]="e.id">{{ e.nombre }}</option> }
          </select>
        }
      </div>

      @if (cargando && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Cargando…</div>
      } @else if (error && !datos) {
        <div class="mt-5 bg-white rounded-2xl border border-red-200 p-8 text-center text-red-700">{{ error }}</div>
      } @else if (!ediciones.length) {
        <div class="mt-5 bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-600">No haces parte del equipo de ninguna edición abierta.</div>
      } @else if (datos && pais) {
        <!-- Idioma de la clase -->
        <div class="mt-5 flex items-center gap-3">
          <span class="text-sm font-semibold text-gray-600">Idioma:</span>
          <div class="inline-flex gap-1 bg-white border border-gray-200 rounded-xl p-1" role="radiogroup" aria-label="Idioma de la calificación">
            @for (i of idiomas; track i.id) {
              <button type="button" role="radio" [attr.aria-checked]="idioma === i.id" (click)="elegirIdioma(i.id)"
                      class="px-4 py-1.5 rounded-lg text-sm font-semibold" [class]="idioma === i.id ? 'bg-slate-800 text-white' : 'text-gray-500 hover:bg-gray-100'">{{ i.texto }}</button>
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
              <p class="text-xs uppercase tracking-wide opacity-90">Tipo de cambio</p>
              <p class="text-2xl font-extrabold">{{ miles(pais.tasa_actual) }}</p>
              <p class="text-xs opacity-90">pesos por billete</p>
            </div>
            <div>
              <p class="text-xs uppercase tracking-wide opacity-90">Presentes</p>
              <p class="text-2xl font-extrabold">{{ presentes }} <span class="text-base font-semibold opacity-90">de {{ pais.estudiantes.length }}</span></p>
              <p class="text-xs opacity-90">{{ calificadosHoy }} {{ calificadosHoy === 1 ? 'calificado' : 'calificados' }} hoy</p>
            </div>
          </div>
          @if (datos.edicion.estado !== 'abierta') {
            <p class="text-sm mt-3 bg-white/20 rounded-lg px-3 py-1.5 inline-block">Podrás calificar cuando la edición esté abierta.</p>
          }
        </div>

        @if (aviso) {
          <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between gap-3" role="status">
            <span>{{ aviso }}</span>
            @if (ultimaId) { <button type="button" (click)="deshacer(ultimaId)" class="font-semibold underline shrink-0">Deshacer</button> }
          </p>
        }
        @if (error) { <p class="mt-3 rounded-xl px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700" role="alert">{{ error }}</p> }

        <!-- Estudiantes -->
        <input type="search" [(ngModel)]="busqueda" placeholder="Buscar estudiante…" aria-label="Buscar estudiante"
               class="mt-5 w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300">
        <ul class="mt-3 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          @for (e of filtrados; track e.id) {
            <li class="flex items-center gap-3 px-4 py-3" [class.bg-gray-50]="!e.presente">
              <button type="button" (click)="alternarAsistencia(e)" [disabled]="datos.edicion.estado !== 'abierta'"
                      class="shrink-0 w-11 h-11 p-0 rounded-full flex items-center justify-center border-2 transition disabled:opacity-50"
                      [class]="e.presente ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-300 bg-white text-gray-300'"
                      [attr.aria-label]="(e.presente ? 'Presente: marcar ausente a ' : 'Ausente: marcar presente a ') + e.nombre" [attr.aria-pressed]="e.presente">
                <svg class="shrink-0" width="24" height="24" style="width:24px;height:24px" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
              </button>
              <div class="min-w-0 flex-1">
                <p class="font-semibold truncate" [class]="e.presente ? 'text-gray-800' : 'text-gray-400'">{{ e.nombre }} {{ e.apellido }}</p>
                <p class="text-xs text-gray-500">{{ e.presente ? 'Presente' : 'Ausente' }}{{ e.hoy ? ' · calificado ' + e.hoy + (e.hoy === 1 ? ' vez hoy' : ' veces hoy') : '' }}</p>
              </div>
              <button type="button" (click)="abrir(e)" [disabled]="datos.edicion.estado !== 'abierta'"
                      class="shrink-0 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">Calificar</button>
            </li>
          }
          @if (!filtrados.length) {
            <li class="px-4 py-6 text-center text-sm text-gray-500">{{ pais.estudiantes.length ? 'Nadie coincide con «' + busqueda + '».' : 'No hay estudiantes en ' + pais.nombre + '.' }}</li>
          }
        </ul>

        <!-- Mis últimas calificaciones -->
        @if (datos.recientes.length) {
          <h2 class="mt-6 text-sm font-bold text-gray-700">Mis últimas calificaciones</h2>
          <ul class="mt-2 bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            @for (r of datos.recientes; track r.id) {
              <li class="px-4 py-3 flex items-center gap-3">
                <div class="w-11 h-11 shrink-0 rounded-xl bg-slate-800 text-white flex flex-col items-center justify-center leading-none">
                  <span class="text-lg font-black">{{ r.puntaje }}</span><span class="text-[10px] opacity-80">de 4</span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-gray-800 truncate">{{ r.nombre }} {{ r.apellido }}</p>
                  <div class="mt-1 flex flex-wrap gap-1">
                    @for (c of criterios; track c.id) {
                      <span class="text-[11px] px-1.5 py-0.5 rounded-full" [class]="r[c.id] ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-400 line-through'">{{ c.titulo }}</span>
                    }
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-xs text-gray-500">{{ r.date_created | date:'h:mm a' }}</p>
                  @if (r.se_puede_deshacer) { <button type="button" (click)="deshacer(r.id)" class="text-xs font-semibold text-red-600 hover:underline">Deshacer</button> }
                </div>
              </li>
            }
          </ul>
        }
      }
    </div>

    <!-- Calificar -->
    @if (estudiante) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" (click)="cerrar()">
        <div class="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="titulo-calificar">
          <div class="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-calificar" class="text-lg font-bold text-gray-800">Calificar a {{ estudiante.nombre }}</h2>
              <p class="text-sm text-gray-500">Toca lo que sí hizo. Clase en {{ idioma === 'frances' ? 'francés' : 'inglés' }}.</p>
            </div>
            <button type="button" (click)="cerrar()" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">✕</button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            @for (c of criterios; track c.id) {
              <button type="button" (click)="valores[c.id] = valores[c.id] ? 0 : 1" [attr.aria-pressed]="!!valores[c.id]"
                      class="text-left rounded-2xl border-2 p-4 transition"
                      [class]="valores[c.id] ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'">
                <div class="flex items-center justify-between gap-2">
                  <span class="w-10 h-10 rounded-xl flex items-center justify-center" [class]="valores[c.id] ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'" aria-hidden="true">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="c.icono"/></svg>
                  </span>
                  <span class="text-xs font-bold px-2.5 py-1 rounded-full" [class]="valores[c.id] ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'">{{ valores[c.id] ? 'Sí' : 'No' }}</span>
                </div>
                <p class="mt-3 font-bold text-gray-800">{{ c.titulo }}</p>
                <p class="text-sm text-gray-500">{{ c.ayuda(idioma) }}</p>
              </button>
            }
          </div>
          <div class="px-5 py-4 border-t border-gray-100">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-gray-500">Puntaje</span>
              <span class="text-2xl font-extrabold text-gray-800">{{ puntaje }} <span class="text-sm font-semibold text-gray-500">de 4</span></span>
            </div>
            <div class="flex gap-1 mb-4" aria-hidden="true">
              @for (n of [1, 2, 3, 4]; track n) { <div class="h-2 flex-1 rounded-full" [class]="n <= puntaje ? 'bg-emerald-500' : 'bg-gray-200'"></div> }
            </div>
            @if (errorPanel) { <p class="mb-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700" role="alert">{{ errorPanel }}</p> }
            <button type="button" (click)="guardar()" [disabled]="enviando"
                    class="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 disabled:opacity-40">
              {{ enviando ? 'Guardando…' : 'Guardar calificación' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class RubricaWillGo implements OnInit {
  private willGo = inject(WillGoService);
  readonly miles = (v: unknown) => formatearNumero((v as number) ?? 0);
  readonly criterios = CRITERIOS;
  readonly idiomas: { id: Idioma; texto: string }[] = [{ id: 'ingles', texto: 'Inglés' }, { id: 'frances', texto: 'Francés' }];

  ediciones: { id: string; nombre: string; estado: string }[] = [];
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
  valores: Record<CriterioRubrica, number> = { uso_lengua: 0, iniciativa: 0, nivel_reto: 0, colaboracion: 0 };
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
  get puntaje(): number { return CRITERIOS.reduce((t, c) => t + (this.valores[c.id] ? 1 : 0), 0); }

  private avisar(texto: string, id: string | null = null): void {
    this.aviso = texto;
    this.ultimaId = id;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => { this.aviso = ''; this.ultimaId = null; }, 6000);
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
    this.valores = { uso_lengua: 0, iniciativa: 0, nivel_reto: 0, colaboracion: 0 };
    this.errorPanel = '';
  }

  cerrar(): void { if (!this.enviando) this.estudiante = null; }

  guardar(): void {
    const e = this.estudiante;
    if (!e || this.enviando) return;
    this.enviando = true;
    this.errorPanel = '';
    this.willGo.calificar(e.id, { ...this.valores }, this.idioma).subscribe({
      next: (r) => {
        this.enviando = false;
        this.estudiante = null;
        this.avisar(`${e.nombre}: ${r.puntaje} de 4.`, r.id ?? null);
        this.cargar();
      },
      error: (err) => { this.enviando = false; this.errorPanel = WillGoService.mensajeDeError(err); },
    });
  }

  deshacer(id: string): void {
    this.error = '';
    this.willGo.deshacerCalificacion(id).subscribe({
      next: () => { this.avisar('Calificación deshecha.'); this.cargar(); },
      error: (e) => { this.error = WillGoService.mensajeDeError(e); },
    });
  }
}
