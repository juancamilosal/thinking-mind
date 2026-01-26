import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppButtonComponent } from '../app-button/app-button.component';

export class Course {
  id: string;
  name: string;
  price: string;
  code: string;
  imageUrl: string;
}

@Component({
  selector: 'app-course-card',
  standalone: true,
  imports: [CommonModule, AppButtonComponent],
  templateUrl: './course-card.html'
})
export class CourseCardComponent {
  @Input() courseId: string = '1';
  @Input() courseName: string = 'Inglés Básico 1';
  @Input() coursePrice: string = '299000';
  @Input() courseCode: string = 'ANG-001';
  @Input() courseImageUrl: string = '';
  @Input() colegiosCursos: any[] = []; // Array de colegios asignados al curso

  // Outputs para los eventos existentes
  @Output() editCourse = new EventEmitter<void>();
  @Output() deleteCourse = new EventEmitter<void>();
  @Output() addColegio = new EventEmitter<void>();

  // Nuevos outputs para editar y eliminar colegios_cursos
  @Output() editColegioCurso = new EventEmitter<any>();
  @Output() deleteColegioCurso = new EventEmitter<any>();

  // Nueva propiedad para controlar el modal
  showColegiosModal = false;

  onImageError(event: any) {
    // Si hay error al cargar la imagen, ocultar el elemento img
    event.target.style.display = 'none';
    // El SVG se mostrará automáticamente porque courseImageUrl será falsy
    this.courseImageUrl = '';
  }

  onEdit() {
    this.editCourse.emit();
  }

  onDelete() {
    this.deleteCourse.emit();
  }

  onAddColegio() {
    this.addColegio.emit();
  }

  onEditColegioCurso(colegioCurso: any) {
    this.editColegioCurso.emit(colegioCurso);
  }

  onDeleteColegioCurso(colegioCurso: any) {
    this.deleteColegioCurso.emit(colegioCurso);
  }

  // Método para abrir el modal
  openColegiosModal() {
    this.showColegiosModal = true;
  }

  // Método para cerrar el modal
  closeColegiosModal() {
    this.showColegiosModal = false;
  }

  // Lista de colegios visibles ordenados alfabéticamente por nombre
  get visibleSortedColegiosCursos(): any[] {
    const normalizeVisible = (val: any): boolean => {
      if (typeof val === 'string') {
        return val.trim().toUpperCase() === 'TRUE';
      }
      if (typeof val === 'boolean') {
        return val === true;
      }
      if (typeof val === 'number') {
        return val === 1;
      }
      return false;
    };

    const items = this.colegiosCursos || [];
    // Si existe el campo 'visible' en al menos un elemento, respetamos ese filtro.
    // Si no existe en ninguno, mostramos todos por defecto.
    const hasVisibleField = items.some(cc => cc && cc.hasOwnProperty('visible'));
    const filteredByVisible = hasVisibleField ? items.filter(cc => normalizeVisible(cc?.visible)) : items;
    const filtered = (hasVisibleField && filteredByVisible.length > 0) ? filteredByVisible : items;

    return filtered.sort((a: any, b: any) => {
      const nameA = (a?.colegio_id?.nombre ?? '').toString().trim();
      const nameB = (b?.colegio_id?.nombre ?? '').toString().trim();
      if (!nameA && !nameB) return 0;
      if (!nameA) return 1; // Sin nombre al final
      if (!nameB) return -1;
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    });
  }

  // Método para obtener solo los primeros 2 colegios
  get displayedColegios(): any[] {
    return this.visibleSortedColegiosCursos.slice(0, 2);
  }

  // Método para verificar si hay más de 2 colegios
  get hasMoreColegios(): boolean {
    return this.visibleSortedColegiosCursos.length > 2;
  }

  // Normaliza flags provenientes de Directus tipo 'TRUE' | boolean | number
  isTruthyFlag(value: any): boolean {
    if (typeof value === 'string') {
      return value.trim().toUpperCase() === 'TRUE';
    }
    if (typeof value === 'boolean') {
      return value === true;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    return false;
  }
}
