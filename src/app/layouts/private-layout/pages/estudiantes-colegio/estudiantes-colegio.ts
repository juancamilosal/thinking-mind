import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentService } from '../../../../core/services/student.service';
import { SchoolService } from '../../../../core/services/school.service';
import { Student } from '../../../../core/models/Student';
import { School } from '../../../../core/models/School';
import { NotificationService } from '../../../../core/services/notification.service';
import { StudentDetail } from '../students/student-detail/student-detail';

@Component({
  selector: 'app-estudiantes-colegio',
  standalone: true,
  imports: [CommonModule, StudentDetail],
  templateUrl: './estudiantes-colegio.html'
})
export class EstudiantesColegio implements OnInit {
  students: Student[] = [];
  school: School | null = null;
  isLoading = false;
  schoolId: string = '';
  searchTerm = '';
  showDetail = false;
  selectedStudent: Student | null = null;
  private searchTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.schoolId = params['schoolId'];
      if (this.schoolId) {
        this.loadSchoolInfo();
        this.loadStudents();
      }
    });
  }

  loadSchoolInfo(): void {
    this.schoolService.getSchoolById(this.schoolId).subscribe({
      next: (response) => {
        this.school = response.data;
      },
      error: (error) => {
        this.notificationService.showError(
          'Error',
          'Error al cargar la información del colegio'
        );
      }
    });
  }

  loadStudents(): void {
    this.isLoading = true;
    // Cargar estudiantes desde la información del colegio
    if (this.school && this.school.estudiante_id) {
      this.students = this.school.estudiante_id;
      this.isLoading = false;
    } else {
      // Fallback: intentar cargar estudiantes directamente
      this.studentService.getStudentsBySchool(this.schoolId).subscribe({
        next: (response) => {
          this.students = response.data;
          this.isLoading = false;
        },
        error: (error) => {
          this.notificationService.showError(
            'Error',
            'Error al cargar los estudiantes del colegio'
          );
          this.isLoading = false;
        }
      });
    }
  }

  onSearchInputChange(event: any): void {
    this.searchTerm = event.target.value;
    
    // Limpiar el timeout anterior si existe
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Establecer un nuevo timeout para la búsqueda
    this.searchTimeout = setTimeout(() => {
      this.searchStudents();
    }, 500); // Esperar 500ms después de que el usuario deje de escribir
  }

  searchStudents(): void {
    if (!this.searchTerm.trim()) {
      this.loadStudents();
      return;
    }

    this.isLoading = true;
    this.studentService.searchStudent(this.searchTerm).subscribe({
      next: (response) => {
        // Filtrar solo los estudiantes de este colegio
        this.students = response.data.filter(student => student.colegio === this.schoolId);
        this.isLoading = false;
      },
      error: (error) => {
        this.notificationService.showError(
          'Error',
          'Error al buscar estudiantes'
        );
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    this.searchStudents();
  }

  viewStudent(student: Student): void {
    this.selectedStudent = student;
    this.showDetail = true;
  }

  closeDetail(): void {
    this.showDetail = false;
    this.selectedStudent = null;
  }

  editStudent(student: Student): void {
    // Por ahora solo cerramos el detalle, se puede implementar edición más tarde
    this.closeDetail();
  }

  goBack(): void {
    this.router.navigate(['/private/list-schools']);
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
}