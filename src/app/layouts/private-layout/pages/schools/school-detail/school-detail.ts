import { Component, Input, Output, EventEmitter } from '@angular/core';

import { School } from '../../../../../core/models/School';
import { AppButtonComponent } from '../../../../../components/app-button/app-button.component';

@Component({
  selector: 'app-school-detail',
  standalone: true,
  imports: [AppButtonComponent],
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