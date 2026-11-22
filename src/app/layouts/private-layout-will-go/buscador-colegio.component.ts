import { Component, ElementRef, HostListener, Input, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface Colegio { id: string; nombre: string; }

/** Quita tildes y mayúsculas para comparar ("Colegio Británico" = "colegio britanico"). */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Campo para elegir un colegio escribiendo: muestra los que coinciden a medida que se escribe.
 * Vacío significa "todos los colegios inscritos". Funciona con formControlName y con ngModel.
 */
@Component({
  selector: 'wg-buscador-colegio',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => BuscadorColegioComponent), multi: true }],
  template: `
    <div class="relative">
      @if (seleccionado && !escribiendo) {
        <div class="flex items-center gap-2 w-full px-4 py-2.5 bg-orange-50 border-2 border-orange-200 rounded-xl">
          <svg class="w-5 h-5 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
          <span class="flex-1 font-medium text-gray-800 truncate">{{ seleccionado.nombre }}</span>
          @if (!desactivado) {
            <button type="button" (click)="cambiar()" class="text-sm font-semibold text-orange-700 hover:underline">Cambiar</button>
            <button type="button" (click)="limpiar()" class="p-1 text-gray-400 hover:text-gray-600" aria-label="Quitar colegio">✕</button>
          }
        </div>
      } @else {
        <div class="relative">
          <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input #campo type="text" [id]="inputId" [value]="texto" (input)="alEscribir($any($event.target).value)" (focus)="abierto = true"
                 (keydown)="teclado($event)" [disabled]="desactivado" autocomplete="off" role="combobox"
                 [attr.aria-expanded]="abierto" [attr.aria-controls]="inputId + '-lista'"
                 placeholder="Escribe el nombre del colegio…"
                 class="w-full pl-11 pr-4 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100">
        </div>
        @if (abierto && !desactivado) {
          <ul [id]="inputId + '-lista'" role="listbox"
              class="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1">
            @if (!texto.trim()) {
              <li role="option" (mousedown)="elegir(null)" [class.bg-orange-50]="activo === -1"
                  class="px-4 py-2.5 text-sm text-gray-600 cursor-pointer hover:bg-orange-50">
                Todos los colegios inscritos
              </li>
            }
            @for (c of coincidencias; track c.id; let i = $index) {
              <li role="option" (mousedown)="elegir(c)" [class.bg-orange-50]="activo === i"
                  class="px-4 py-2.5 text-sm text-gray-800 cursor-pointer hover:bg-orange-50">
                {{ c.nombre }}
              </li>
            }
            @if (texto.trim() && !coincidencias.length) {
              <li class="px-4 py-3 text-sm text-gray-500">Ningún colegio coincide con «{{ texto }}»</li>
            }
            @if (hayMas) {
              <li class="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">Sigue escribiendo para ver más colegios</li>
            }
          </ul>
        }
      }
    </div>
  `,
})
export class BuscadorColegioComponent implements ControlValueAccessor {
  @Input() colegios: Colegio[] = [];
  @Input() inputId = 'buscar-colegio';
  private host = inject(ElementRef<HTMLElement>);

  valor: string | null = null;
  texto = '';
  abierto = false;
  escribiendo = false;
  desactivado = false;
  activo = -1;
  private readonly maximo = 8;
  private alCambiar: (v: string | null) => void = () => {};
  private alTocar: () => void = () => {};

  get seleccionado(): Colegio | undefined {
    return this.colegios.find((c) => c.id === this.valor);
  }

  private get todas(): Colegio[] {
    const q = normalizar(this.texto);
    if (!q) return this.colegios;
    const palabras = q.split(/\s+/);
    return this.colegios.filter((c) => {
      const n = normalizar(c.nombre);
      return palabras.every((p) => n.includes(p));
    });
  }

  get coincidencias(): Colegio[] {
    return this.todas.slice(0, this.maximo);
  }

  get hayMas(): boolean {
    return this.todas.length > this.maximo;
  }

  writeValue(v: string | null): void {
    this.valor = v || null;
    this.escribiendo = false;
    this.texto = '';
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(d: boolean): void {
    this.desactivado = d;
  }

  alEscribir(t: string): void {
    this.texto = t;
    this.abierto = true;
    this.activo = t.trim() ? 0 : -1;
  }

  teclado(e: KeyboardEvent): void {
    const lista = this.coincidencias;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.abierto = true; this.activo = Math.min(this.activo + 1, lista.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.activo = Math.max(this.activo - 1, this.texto.trim() ? 0 : -1); }
    else if (e.key === 'Enter' && this.abierto) {
      e.preventDefault();
      if (this.activo >= 0 && lista[this.activo]) this.elegir(lista[this.activo]);
      else if (!this.texto.trim()) this.elegir(null);
    } else if (e.key === 'Escape') { this.abierto = false; }
  }

  elegir(c: Colegio | null): void {
    this.valor = c?.id ?? null;
    this.texto = '';
    this.abierto = false;
    this.escribiendo = false;
    this.alCambiar(this.valor);
    this.alTocar();
  }

  cambiar(): void {
    this.escribiendo = true;
    this.texto = '';
    this.abierto = true;
    setTimeout(() => this.host.nativeElement.querySelector('input')?.focus());
  }

  limpiar(): void {
    this.elegir(null);
  }

  /** Al hacer clic afuera se cierra la lista (y si estaba cambiando, vuelve a mostrar el elegido). */
  @HostListener('document:mousedown', ['$event'])
  clicAfuera(e: MouseEvent): void {
    if (!this.host.nativeElement.contains(e.target as Node)) {
      this.abierto = false;
      this.escribiendo = false;
      this.texto = '';
    }
  }
}
