import { Directive, ElementRef, HostListener, Input, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Formato colombiano: punto para los miles y coma para los decimales (1.000.000 · 0,7). */
export function formatearNumero(valor: number | string | null | undefined, decimales = 0): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = Number(valor);
  if (!Number.isFinite(n)) return '';
  const signo = n < 0 ? '-' : '';
  const [entera, fraccion = ''] = Math.abs(n).toFixed(decimales).split('.');
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = fraccion.replace(/0+$/, '');
  return signo + miles + (dec ? ',' + dec : '');
}

/**
 * Campo numérico que se ve con puntos de miles mientras se escribe.
 * Uso: <input wgNumero [(ngModel)]="valor">  ·  con decimales: <input wgNumero [decimales]="2">
 *      con negativos: <input wgNumero [negativos]="true">
 * El modelo siempre recibe un número (o null si está vacío).
 */
@Directive({
  selector: 'input[wgNumero]',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NumeroMilesDirective), multi: true }],
  host: { type: 'text', autocomplete: 'off', '[attr.inputmode]': 'decimales > 0 ? "decimal" : "numeric"' },
})
export class NumeroMilesDirective implements ControlValueAccessor {
  @Input() decimales = 0;
  @Input() negativos = false;

  private el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private alCambiar: (v: number | null) => void = () => {};
  private alTocar: () => void = () => {};

  writeValue(valor: number | string | null): void {
    this.el.value = formatearNumero(valor, this.decimales);
  }

  registerOnChange(fn: (v: number | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(desactivado: boolean): void {
    this.el.disabled = desactivado;
  }

  @HostListener('input')
  alEscribir(): void {
    const texto = this.el.value;
    const cursor = this.el.selectionStart ?? texto.length;
    // Cuántos caracteres "útiles" (dígitos, coma, signo) hay antes del cursor, para dejarlo en el mismo sitio
    const utilesAntes = texto.slice(0, cursor).replace(/[^\d,-]/g, '').length;

    const { visible, valor } = this.limpiar(texto);
    this.el.value = visible;

    let pos = 0;
    let vistos = 0;
    while (pos < visible.length && vistos < utilesAntes) {
      if (/[\d,-]/.test(visible[pos])) vistos++;
      pos++;
    }
    this.el.setSelectionRange(pos, pos);
    this.alCambiar(valor);
  }

  @HostListener('blur')
  alSalir(): void {
    const { valor } = this.limpiar(this.el.value);
    this.el.value = formatearNumero(valor, this.decimales);
    this.alTocar();
  }

  /** Quita todo lo que no sea número, arma el texto con puntos y devuelve el valor numérico. */
  private limpiar(texto: string): { visible: string; valor: number | null } {
    const negativo = this.negativos && texto.trim().startsWith('-');
    let resto = texto.replace(/[^\d,]/g, '');
    let fraccion = '';
    let conComa = false;
    if (this.decimales > 0 && resto.includes(',')) {
      const i = resto.indexOf(',');
      fraccion = resto.slice(i + 1).replace(/,/g, '').slice(0, this.decimales);
      resto = resto.slice(0, i);
      conComa = true;
    } else {
      resto = resto.replace(/,/g, '');
    }
    const entera = resto.replace(/^0+(?=\d)/, '');
    const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const visible = (negativo ? '-' : '') + miles + (conComa ? ',' + fraccion : '');
    if (!entera && !fraccion) return { visible: negativo ? '-' : (conComa ? ',' : ''), valor: null };
    const valor = Number(`${negativo ? '-' : ''}${entera || '0'}.${fraccion || '0'}`);
    return { visible: conComa && !entera ? (negativo ? '-' : '') + '0,' + fraccion : visible, valor };
  }
}
