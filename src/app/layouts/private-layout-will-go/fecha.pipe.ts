import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { IdiomaWillGoService } from '../../core/services/idioma-will-go.service';

/**
 * Como `date`, pero en el idioma elegido en Will-Go (los nombres de días y meses cambian con el selector).
 * Uso: {{ fecha | wgFecha:'d MMM, h:mm a' }}
 */
@Pipe({ name: 'wgFecha', standalone: true, pure: false })
export class FechaWillGoPipe implements PipeTransform {
  private idioma = inject(IdiomaWillGoService);
  transform(valor: string | number | Date | null | undefined, formato = 'mediumDate', zona?: string): string {
    if (valor === null || valor === undefined || valor === '') return '';
    // En francés la hora va en formato de 24 horas (14:30), no con a. m./p. m.
    const f = this.idioma.actual === 'fr' ? formato.replace(/h:mm(:ss)?\s*a/g, 'HH:mm$1').replace(/\bh\s*a\b/g, 'HH') : formato;
    try { return formatDate(valor, f, this.idioma.locale, zona); } catch { return ''; }
  }
}
