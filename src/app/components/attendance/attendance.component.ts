import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NivelService } from '../../core/services/nivel.service';
import { Nivel } from '../../core/models/Meeting';

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
  
  niveles: Nivel[] = [];
  showLevelModal = false;
  selectedStudent: AttendanceItem | null = null;
  isLoadingLevels = false;

  constructor(private nivelService: NivelService) { }

  ngOnInit(): void {
    this.loadNiveles();
  }

  loadNiveles(): void {
    this.isLoadingLevels = true;
    this.nivelService.getNiveles().subscribe({
      next: (response) => {
        this.niveles = response.data || [];
        this.isLoadingLevels = false;
      },
      error: (error) => {
        console.error('Error loading levels:', error);
        this.isLoadingLevels = false;
      }
    });
  }

  openPromotionModal(student: AttendanceItem): void {
    this.selectedStudent = student;
    this.showLevelModal = true;
  }

  closePromotionModal(): void {
    this.showLevelModal = false;
    this.selectedStudent = null;
  }
}
