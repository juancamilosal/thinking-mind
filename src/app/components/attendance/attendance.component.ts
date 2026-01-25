import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface AttendanceItem {
  id?: string;
  fecha: string | Date;
  studentName: string;
  email?: string;
  attended: boolean;
  score: string | number;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.css']
})
export class AttendanceComponent implements OnInit {
  @Input() attendanceList: AttendanceItem[] = [];

  constructor() { }

  ngOnInit(): void {
  }
}
