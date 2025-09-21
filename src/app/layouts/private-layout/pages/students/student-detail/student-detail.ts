import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Student } from '../../../../../core/models/Student';
import { Client } from '../../../../../core/models/Clients';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-detail.html'
})
export class StudentDetail {
  @Input() student: Student | null = null;
  @Input() clientInfo: Client | null = null; // Nueva propiedad para recibir información del cliente
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Student>();

  // Getter para obtener la información del acudiente desde student.acudiente o clientInfo
  get acudienteInfo(): Client | null {
    if (this.student?.acudiente && typeof this.student.acudiente === 'object') {
      return this.student.acudiente as Client;
    }
    return this.clientInfo;
  }

  onClose() {
    this.close.emit();
  }

  onEdit() {
    if (this.student) {
      this.edit.emit(this.student);
    }
  }
}