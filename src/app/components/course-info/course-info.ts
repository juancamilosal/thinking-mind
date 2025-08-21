import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Course {
  id: string;
  name: string;
  price: number;
  code: string;
  duration: number;
  imageUrl: string;
}

@Component({
  selector: 'app-course-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-info.html'
})

export class CourseInfoComponent {
  @Input() courseId: string;
  @Input() courseName: string;
  @Input() coursePrice: number;
  @Input() courseCode: string;
  @Input() courseDuration: number;
  @Input() courseImageUrl: string;

  @Output() close = new EventEmitter<void>();
}
