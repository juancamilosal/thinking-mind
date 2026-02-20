import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../../../core/services/user.service';
import { AttendanceService } from '../../../../../core/services/attendance.service';
import { Roles } from '../../../../../core/const/Roles';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './student-evaluation-ayo.html'
})
export class StudentEvaluationAyoComponent implements OnInit, OnDestroy {
  isLoading = true;
  isLoadingDetail = false;
  isLoadingAttendance = false;
  students: any[] = [];
  selectedStudent: StudentStat | null = null;
  state: 'list' | 'detail' = 'list';

  // Filters for student list
  searchTerm: string = '';
  private searchSubject = new Subject<string>();
  private searchSubscription: Subscription | undefined;

  // Detail view data
  attendanceRecords: any[] = [];

  // Filters for detail view
  filterDateStart: string = '';
  filterDateEnd: string = '';
  filterProgram: string = '';
  filterCriterion: string = '';

  // Options for filters
  uniquePrograms: string[] = [];
  uniqueCriteria: string[] = [];

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
    
    // Setup search subscription with debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(term => {
      this.loadStudents(term);
    });
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onSearchChange() {
    this.searchSubject.next(this.searchTerm);
  }

  loadStudents(search?: string) {
    this.isLoading = true;
    this.userService.getUsersByRole(Roles.STUDENT, search).subscribe({
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

  get filteredStudents() {
    return this.students;
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

    // Reset detail filters
    this.filterDateStart = '';
    this.filterDateEnd = '';
    this.filterProgram = '';
    this.filterCriterion = '';

    // Clear previous attendance data
    this.attendanceRecords = [];

    // Load Attendance
    this.loadAttendance(student.studentId);
  }

  applyFilters() {
    if (this.selectedStudent) {
      this.loadAttendance(this.selectedStudent.studentId);
    }
  }

  loadAttendance(studentId: string) {
    this.isLoadingAttendance = true;
    
    // Fields to fetch: include related data for criteria and program
    const fields = '*,criterio_evaluacion_estudiante_id.*,programa_ayo_id.*,programa_ayo_id.id_nivel.nivel';
    
    // Build Directus filter object
    const filter: any = {
      'estudiante_id': studentId
    };

    if (this.filterDateStart) {
      filter.fecha = { ...filter.fecha, _gte: this.filterDateStart };
    }
    if (this.filterDateEnd) {
      filter.fecha = { ...filter.fecha, _lte: this.filterDateEnd };
    }
    if (this.filterProgram) {
      filter.programa_ayo_id = { id_nivel: { nivel: { _eq: this.filterProgram } } };
    }
    if (this.filterCriterion) {
      filter.criterio_evaluacion_estudiante_id = { nombre: { _eq: this.filterCriterion } };
    }

    this.attendanceService.getAttendances(1, 100, undefined, filter, '-fecha', fields).subscribe({
        next: (response) => {
            this.attendanceRecords = response.data || [];
            
            // Only extract options if they haven't been populated yet (to preserve options during filtering)
            if (this.uniquePrograms.length === 0 && this.uniqueCriteria.length === 0) {
              this.extractFilterOptions();
            }
            
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

  extractFilterOptions() {
    const programs = new Set<string>();
    const criteria = new Set<string>();

    this.attendanceRecords.forEach(record => {
        if (record.programa_ayo_id?.id_nivel?.nivel) {
            programs.add(record.programa_ayo_id.id_nivel.nivel);
        }
        if (record.criterio_evaluacion_estudiante_id?.nombre) {
            criteria.add(record.criterio_evaluacion_estudiante_id.nombre);
        }
    });

    this.uniquePrograms = Array.from(programs).sort();
    this.uniqueCriteria = Array.from(criteria).sort();
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

      // Determine the latest date
      if (!lastDate || (record.fecha && new Date(record.fecha) > new Date(lastDate))) {
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
