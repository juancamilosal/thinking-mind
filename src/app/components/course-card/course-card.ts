import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Course {
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

  onImageError(event: any) {
    // Si hay error al cargar la imagen, ocultar el elemento img
    event.target.style.display = 'none';
    // El SVG se mostrará automáticamente porque courseImageUrl será falsy
    this.courseImageUrl = '';
  }
}
