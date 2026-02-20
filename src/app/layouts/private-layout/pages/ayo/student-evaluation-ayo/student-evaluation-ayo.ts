import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../../core/services/user.service';
import { AttendanceService } from '../../../../../core/services/attendance.service';
import { Roles } from '../../../../../core/const/Roles';
import { Router } from '@angular/router';

interface StudentStat {
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatar?: string;
  averageRating: number;
  totalEvaluations: number;
  lastEvaluationDate: string;
}

@Component({
  selector: 'app-student-evaluation-ayo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-evaluation-ayo.html'
})
export class StudentEvaluationAyoComponent implements OnInit {
  isLoading = true;
  isLoadingDetail = false;
  isLoadingAttendance = false;
  students: any[] = [];
  selectedStudent: StudentStat | null = null;
  state: 'list' | 'detail' = 'list';

  // Detail view data
  attendanceRecords: any[] = [];

  selectedObservation: string | null = null;
  isObservationModalOpen = false;

  constructor(
    private userService: UserService,
    private attendanceService: AttendanceService,
    private router: Router
  ) {}

  openObservationModal(observation: string) {
    if (observation) {
      this.selectedObservation = observation;
      this.isObservationModalOpen = true;
    }
  }

  closeObservationModal() {
    this.isObservationModalOpen = false;
    this.selectedObservation = null;
  }

  getStarsArray(score: any): number[] {
    if (!score || isNaN(Number(score))) {
      return [];
    }
    const count = Math.round(Number(score));
    return Array(count).fill(0);
  }

  ngOnInit() {
    this.loadStudents();
  }

  loadStudents() {
    this.isLoading = true;
    this.userService.getUsersByRole(Roles.STUDENT).subscribe({
      next: (response) => {
        this.students = (response.data || []).map((user: any) => ({
          studentId: user.id,
          studentName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          studentEmail: user.email,
          avatar: user.avatar
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading students', err);
        this.isLoading = false;
      }
    });
  }

  selectStudent(student: any) {
    this.isLoadingDetail = true;
    this.state = 'detail';

    // Initialize selected student with basic info
    this.selectedStudent = {
      ...student,
      averageRating: 0,
      totalEvaluations: 0,
      lastEvaluationDate: ''
    };

    // Clear previous attendance data
    this.attendanceRecords = [];

    // Load Attendance
    this.loadAttendance(student.studentId);
  }

  loadAttendance(studentId: string) {
    this.isLoadingAttendance = true;
    
    // Fields to fetch: include related data for criteria and program
    const fields = '*,criterio_evaluacion_estudiante_id.*,programa_ayo_id.*,programa_ayo_id.id_nivel.nivel';
    
    this.attendanceService.getAttendances(1, 50, undefined, { 'estudiante_id': studentId }, '-fecha', fields).subscribe({
        next: (response) => {
            this.attendanceRecords = response.data || [];
            this.processDetailData();
            this.isLoadingAttendance = false;
            this.isLoadingDetail = false;
        },
        error: (err) => {
            console.error('Error loading attendance', err);
            this.isLoadingAttendance = false;
            this.isLoadingDetail = false;
        }
    });
  }

  processDetailData() {
    if (!this.selectedStudent || this.attendanceRecords.length === 0) return;

    // Calculate stats from attendance records
    const totalRecords = this.attendanceRecords.length;
    let totalScore = 0;
    let validScores = 0;
    let lastDate = '';

    this.attendanceRecords.forEach(record => {
      // Assuming 'calificacion' is the score field
      if (record.calificacion !== null && record.calificacion !== undefined) {
        totalScore += Number(record.calificacion);
        validScores++;
      }

      if (!lastDate && record.fecha) {
        lastDate = record.fecha;
      }
    });

    this.selectedStudent.averageRating = validScores > 0 ? totalScore / validScores : 0;
    this.selectedStudent.totalEvaluations = totalRecords; // Or total attendances
    this.selectedStudent.lastEvaluationDate = lastDate;
  }

  goBack() {
    if (this.state === 'detail') {
        this.state = 'list';
        this.selectedStudent = null;
        this.attendanceRecords = [];
    } else {
        this.router.navigate(['/private/ayo']);
    }
  }
}
