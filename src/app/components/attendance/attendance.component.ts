import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface AttendanceItem {
  id?: string;
  fecha: string | Date;
  studentName: string;
  email?: string;
  attended: boolean;
  score: string | number;
  currentLevelId?: string;
  subcategoria?: string;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.css']
})
export class AttendanceComponent {
  @Input() attendanceList: AttendanceItem[] = [];
  @Output() promote = new EventEmitter<AttendanceItem>();
  @Output() degrade = new EventEmitter<AttendanceItem>();

  openPromotionModal(student: AttendanceItem): void {
    this.promote.emit(student);
  }

  openDegradeModal(student: AttendanceItem): void {
    this.degrade.emit(student);
  }
}
