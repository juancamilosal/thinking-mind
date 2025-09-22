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
  selector: 'app-course-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-info.html'
})

export class CourseInfoComponent {
  @Input() courseId: string;
  @Input() courseName: string;
  @Input() coursePrice: string;
  @Input() courseCode: string;
  @Input() courseImageUrl: string;

  @Output() close = new EventEmitter<void>();
}
