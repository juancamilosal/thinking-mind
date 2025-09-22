import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  imports: [CommonModule],
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
}
