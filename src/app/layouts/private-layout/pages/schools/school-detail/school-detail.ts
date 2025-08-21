import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { School } from '../../../../../core/models/School';

@Component({
  selector: 'app-school-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './school-detail.html'
})
export class SchoolDetail {
  @Input() school: School | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<School>();

  onClose() {
    this.close.emit();
  }

  onEdit() {
    if (this.school) {
      this.edit.emit(this.school);
    }
  }
}