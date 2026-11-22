import { Component, ElementRef, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FechaWillGoPipe } from './fecha.pipe';
import { Oferta } from '../../core/services/will-go.service';

/** Quita tildes y mayúsculas para comparar ("Británico" = "britanico"). */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export interface OfertaElegida { colegio_id: string | null; curso_id: string; edicion_programa: string; }

/**
 * Elegir la oferta de la edición escribiendo el colegio o el programa.
 * Una oferta es un programa habilitado en un colegio con su número de edición (colegios_cursos).
 */
@Component({
  selector: 'wg-buscador-oferta',
  standalone: true,
  imports: [TranslatePipe, FechaWillGoPipe],
  template: `
    <div class="relative">
      @if (seleccionada && !cambiando) {
        <div class="flex gap-3 w-full px-4 py-3 bg-orange-50 border-2 border-orange-200 rounded-xl" [class.items-start]="!compacto" [class.items-center]="compacto">
          <svg class="w-5 h-5 mt-0.5 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-gray-800 truncate">{{ seleccionada.colegio || ('wg.nucleo.oferta.sinColegio' | translate) }}</p>
            @if (!compacto) {
              <p class="text-sm text-gray-600">{{ seleccionada.programa }} · <b>{{ 'wg.nucleo.oferta.edicion' | translate: { n: seleccionada.edicion } }}</b>{{ seleccionada.fecha_finalizacion ? ('wg.nucleo.oferta.termina' | translate: { fecha: (seleccionada.fecha_finalizacion | wgFecha:'d MMM y') }) : '' }}</p>
            }
          </div>
          @if (!desactivado) {
            <button type="button" (click)="abrir()" class="text-sm font-semibold text-orange-700 hover:underline">{{ 'wg.nucleo.oferta.cambiar' | translate }}</button>
          }
        </div>
      } @else {
        <div class="relative">
          <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" [id]="inputId" [value]="texto" (input)="alEscribir($any($event.target).value)" (focus)="lista = true"
                 (keydown)="teclado($event)" autocomplete="off" role="combobox" [attr.aria-expanded]="lista" [attr.aria-controls]="inputId + '-lista'"
                 [placeholder]="'wg.nucleo.oferta.placeholder' | translate"
                 class="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400">
        </div>
        @if (lista) {
          <ul [id]="inputId + '-lista'" role="listbox" class="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1">
            @for (o of coincidencias; track o.id; let i = $index) {
              <li role="option" [attr.aria-disabled]="ocupada(o)" (mousedown)="elegir(o)"
                  class="px-4 py-2.5 text-sm" [class]="ocupada(o) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-orange-50'" [class.bg-orange-50]="activo === i && !ocupada(o)">
                <p class="font-semibold text-gray-800">{{ o.colegio || ('wg.nucleo.oferta.sinColegio' | translate) }}</p>
                <p class="text-gray-600">{{ o.programa }} · {{ 'wg.nucleo.oferta.edicion' | translate: { n: o.edicion } }}{{ o.fecha_finalizacion ? ('wg.nucleo.oferta.termina' | translate: { fecha: (o.fecha_finalizacion | wgFecha:'d MMM y') }) : '' }}</p>
                @if (ocupada(o)) { <p class="text-xs font-semibold text-amber-700">{{ 'wg.nucleo.oferta.ocupada' | translate: { nombre: o.edicion_will_go } }}</p> }
              </li>
            }
            @if (!coincidencias.length) {
              <li class="px-4 py-3 text-sm text-gray-500">{{ texto.trim() ? ('wg.nucleo.oferta.nadaCoincide' | translate: { texto: texto }) : ('wg.nucleo.oferta.sinProgramas' | translate) }}</li>
            }
            @if (hayMas) { <li class="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">{{ 'wg.nucleo.oferta.sigueEscribiendo' | translate }}</li> }
          </ul>
        }
      }
    </div>
  `,
})
export class BuscadorOfertaComponent {
  @Input() ofertas: Oferta[] = [];
  @Input() inputId = 'buscar-oferta';
  /** Si se indica, solo se muestran ofertas de ese programa. */
  @Input() soloPrograma: string | null = null;
  /** Edición de Will-Go que se está editando: su propia oferta no cuenta como ocupada. */
  @Input() nombreEdicionActual: string | null = null;
  @Input() desactivado = false;
  /** Solo el colegio en el recuadro elegido (cuando el programa y la edición ya se ven en otra parte). */
  @Input() compacto = false;
  @Input() set actual(v: OfertaElegida | null) { this._actual = v; this.cambiando = false; }
  @Output() elegida = new EventEmitter<Oferta>();

  private host = inject(ElementRef<HTMLElement>);
  private _actual: OfertaElegida | null = null;
  texto = '';
  lista = false;
  cambiando = false;
  activo = 0;
  private readonly maximo = 10;

  get seleccionada(): Oferta | undefined {
    const a = this._actual;
    if (!a) return undefined;
    return this.ofertas.find((o) => (o.colegio_id ?? null) === (a.colegio_id ?? null) && o.curso_id === a.curso_id && String(o.edicion) === String(a.edicion_programa));
  }

  ocupada(o: Oferta): boolean {
    return !!o.edicion_will_go && o.edicion_will_go !== this.nombreEdicionActual;
  }

  private get todas(): Oferta[] {
    const palabras = normalizar(this.texto).split(/\s+/).filter(Boolean);
    return this.ofertas
      .filter((o) => !this.soloPrograma || o.curso_id === this.soloPrograma)
      .filter((o) => { const n = normalizar(`${o.colegio ?? ''} ${o.programa} edicion ${o.edicion}`); return palabras.every((p) => n.includes(p)); })
      // Primero las que se pueden elegir
      .sort((a, b) => Number(this.ocupada(a)) - Number(this.ocupada(b)));
  }

  get coincidencias(): Oferta[] { return this.todas.slice(0, this.maximo); }
  get hayMas(): boolean { return this.todas.length > this.maximo; }

  alEscribir(t: string): void {
    this.texto = t;
    this.lista = true;
    this.activo = 0;
  }

  teclado(e: KeyboardEvent): void {
    const l = this.coincidencias;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.lista = true; this.activo = Math.min(this.activo + 1, l.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.activo = Math.max(this.activo - 1, 0); }
    else if (e.key === 'Enter' && this.lista) { e.preventDefault(); if (l[this.activo]) this.elegir(l[this.activo]); }
    else if (e.key === 'Escape') { this.lista = false; }
  }

  elegir(o: Oferta): void {
    if (this.ocupada(o)) return;
    this._actual = { colegio_id: o.colegio_id, curso_id: o.curso_id, edicion_programa: String(o.edicion) };
    this.texto = '';
    this.lista = false;
    this.cambiando = false;
    this.elegida.emit(o);
  }

  abrir(): void {
    this.cambiando = true;
    this.texto = '';
    this.lista = true;
    setTimeout(() => this.host.nativeElement.querySelector('input')?.focus());
  }

  @HostListener('document:mousedown', ['$event'])
  clicAfuera(e: MouseEvent): void {
    if (!this.host.nativeElement.contains(e.target as Node)) {
      this.lista = false;
      this.cambiando = false;
      this.texto = '';
    }
  }
}
