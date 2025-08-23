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
  @Input() courseImageUrl: string = 'https://hotmart.com/media/2021/09/blog-image-criar-cursos-online.jpg';
}
