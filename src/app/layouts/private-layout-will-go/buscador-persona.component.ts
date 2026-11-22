import { Component, ElementRef, HostListener, Input, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

export interface Persona { id: string; nombre: string; apellido: string; email?: string; }

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Buscador y lista a la vez para elegir una persona. El valor es su id (o null = sin asignar). */
@Component({
  selector: 'wg-buscador-persona',
  standalone: true,
  imports: [TranslatePipe],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => BuscadorPersonaComponent), multi: true }],
  template: `
    <div class="relative">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" [id]="inputId" [value]="abierto ? texto : nombreElegido" (input)="escribir($any($event.target).value)"
               (focus)="abrir()" (keydown)="teclado($event)" [disabled]="desactivado" autocomplete="off" role="combobox"
               [attr.aria-expanded]="abierto" [placeholder]="nombreElegido || placeholder || ('wg.nucleo.persona.placeholder' | translate)"
               class="w-full pl-9 pr-9 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-100"
               [class.font-semibold]="!abierto && valor">
        <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </div>
      @if (abierto) {
        <ul role="listbox" class="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          <li role="option" (mousedown)="elegir(null)" class="px-4 py-2 text-sm text-gray-500 cursor-pointer hover:bg-orange-50" [class.bg-orange-50]="activo === -1">{{ 'wg.nucleo.persona.sinAsignar' | translate }}</li>
          @for (p of coincidencias; track p.id; let i = $index) {
            <li role="option" (mousedown)="elegir(p)" class="px-4 py-2 cursor-pointer hover:bg-orange-50" [class.bg-orange-50]="activo === i">
              <p class="text-sm font-semibold text-gray-800" [class.text-orange-700]="p.id === valor">{{ p.nombre }} {{ p.apellido }}{{ p.id === valor ? ' ✓' : '' }}</p>
              @if (p.email) { <p class="text-xs text-gray-500">{{ p.email }}</p> }
            </li>
          }
          @if (!coincidencias.length) {
            <li class="px-4 py-3 text-sm text-gray-500">{{ personas.length ? ('wg.nucleo.persona.nadieCoincide' | translate: { texto: texto }) : (vacio || ('wg.nucleo.persona.vacio' | translate)) }}</li>
          }
        </ul>
      }
    </div>
  `,
})
export class BuscadorPersonaComponent implements ControlValueAccessor {
  @Input() personas: Persona[] = [];
  @Input() inputId = 'buscar-persona';
  /** Vacíos = textos por defecto traducidos (wg.nucleo.persona.placeholder / .vacio). */
  @Input() placeholder = '';
  @Input() vacio = '';
  private host = inject(ElementRef<HTMLElement>);

  valor: string | null = null;
  texto = '';
  abierto = false;
  desactivado = false;
  activo = -1;
  private alCambiar: (v: string | null) => void = () => {};
  private alTocar: () => void = () => {};

  get nombreElegido(): string {
    const p = this.personas.find((x) => x.id === this.valor);
    return p ? `${p.nombre} ${p.apellido}` : '';
  }

  get coincidencias(): Persona[] {
    const palabras = normalizar(this.texto).split(/\s+/).filter(Boolean);
    return this.personas.filter((p) => { const n = normalizar(`${p.nombre} ${p.apellido} ${p.email ?? ''}`); return palabras.every((w) => n.includes(w)); }).slice(0, 30);
  }

  writeValue(v: string | null): void { this.valor = v || null; }
  registerOnChange(fn: (v: string | null) => void): void { this.alCambiar = fn; }
  registerOnTouched(fn: () => void): void { this.alTocar = fn; }
  setDisabledState(d: boolean): void { this.desactivado = d; }

  abrir(): void {
    this.abierto = true;
    this.texto = '';
    this.activo = Math.max(this.coincidencias.findIndex((p) => p.id === this.valor), -1);
  }

  escribir(t: string): void {
    this.texto = t;
    this.abierto = true;
    this.activo = this.coincidencias.length ? 0 : -1;
  }

  teclado(e: KeyboardEvent): void {
    const l = this.coincidencias;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.abierto = true; this.activo = Math.min(this.activo + 1, l.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.activo = Math.max(this.activo - 1, -1); }
    else if (e.key === 'Enter' && this.abierto) { e.preventDefault(); this.elegir(this.activo >= 0 ? l[this.activo] : null); }
    else if (e.key === 'Escape') { this.cerrar(); }
  }

  elegir(p: Persona | null): void {
    this.valor = p?.id ?? null;
    this.alCambiar(this.valor);
    this.alTocar();
    this.cerrar();
  }

  private cerrar(): void {
    this.abierto = false;
    this.texto = '';
    (this.host.nativeElement.querySelector('input') as HTMLInputElement | null)?.blur();
  }

  @HostListener('document:mousedown', ['$event'])
  clicAfuera(e: MouseEvent): void {
    if (this.abierto && !this.host.nativeElement.contains(e.target as Node)) { this.abierto = false; this.texto = ''; }
  }
}
