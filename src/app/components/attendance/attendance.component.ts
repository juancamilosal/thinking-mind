import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {AttendanceItem} from '../../core/models/Attendance';

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
  @Output() locate = new EventEmitter<AttendanceItem>();
  @Output() updateCredits = new EventEmitter<AttendanceItem[]>();

  isEditingCredits = false;
  private originalCredits = new Map<string, number | string>();

  openPromotionModal(student: AttendanceItem): void {
    this.promote.emit(student);
  }

  openDegradeModal(student: AttendanceItem): void {
    this.degrade.emit(student);
  }

  openLocateModal(student: AttendanceItem): void {
    this.locate.emit(student);
  }

  toggleEditCredits(): void {
    this.isEditingCredits = !this.isEditingCredits;
    this.originalCredits.clear();
    if (this.isEditingCredits) {
      for (const item of this.attendanceList) {
        this.originalCredits.set(String(item.id), item.creditos as any);
      }
    }
  }

  cancelEditCredits(): void {
    for (const item of this.attendanceList) {
      const backup = this.originalCredits.get(String(item.id));
      if (backup !== undefined) {
        (item as any).creditos = backup as any;
      }
    }
    this.isEditingCredits = false;
    this.originalCredits.clear();
  }

  saveCredits(): void {
    this.isEditingCredits = false;
    this.originalCredits.clear();
    this.updateCredits.emit(this.attendanceList);
  }
}
