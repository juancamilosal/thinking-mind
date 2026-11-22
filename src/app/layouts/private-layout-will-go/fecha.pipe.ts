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
  transform(valor: string | number | Date | null | undefined, formato = 'mediumDate'): string {
    if (valor === null || valor === undefined || valor === '') return '';
    try { return formatDate(valor, formato, this.idioma.locale); } catch { return ''; }
  }
}
