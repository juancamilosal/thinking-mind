import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Student } from '../../../../../core/models/Student';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-detail.html'
})
export class StudentDetail {
  @Input() student: Student | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Student>();

  onClose() {
    this.close.emit();
  }

  onEdit() {
    if (this.student) {
      this.edit.emit(this.student);
    }
  }
}