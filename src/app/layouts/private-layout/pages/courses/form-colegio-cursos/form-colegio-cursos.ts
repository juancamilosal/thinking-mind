import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CourseService } from '../../../../../core/services/course.service';
import { Course } from '../../../../../core/models/Course';
import { SchoolService } from '../../../../../core/services/school.service';
import { School } from '../../../../../core/models/School';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ColegioCursosService } from '../../../../../core/services/colegio-cursos.service';

@Component({
  selector: 'app-form-colegio-cursos',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './form-colegio-cursos.html',
  styleUrl: './form-colegio-cursos.css'
})
export class ColegioCursosComponent implements OnInit {
  @Input() selectedCourse: Course | null = null;
  @Output() goBack = new EventEmitter<void>();

  fechaFinalizacionForm!: FormGroup;
  filteredSchools: School[] = [];
  filteredCourses: Course[] = [];
  courses: Course[] = [];
  isLoadingSchools: boolean = false;
  isLoadingCourses: boolean = false;
  isSchoolSelected: boolean = false;
  isCourseSelected: boolean = false;

  constructor(
    private fb: FormBuilder,
    private courseService: CourseService,
    private schoolService: SchoolService,
    private notificationService: NotificationService,
    private colegioCursosService: ColegioCursosService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCourses();
    
    // Si hay un curso seleccionado, pre-llenarlo
    if (this.selectedCourse) {
      this.fechaFinalizacionForm.get('curso_id')?.setValue(this.selectedCourse.id);
      this.fechaFinalizacionForm.get('courseSearchTerm')?.setValue(this.selectedCourse.nombre);
      this.isCourseSelected = true;
    }
  }

  initForm(): void {
    this.fechaFinalizacionForm = this.fb.group({
      fecha_finalizacion: ['', Validators.required],
      curso_id: ['', Validators.required],
      colegio_id: ['', Validators.required],
      courseSearchTerm: [''],
      schoolSearchTerm: ['']
    });
  }

  loadCourses(): void {
    this.isLoadingCourses = true;
    this.courseService.searchCourse().subscribe({
      next: (response) => {
        if (response.data) {
          this.courses = response.data.sort((a, b) =>
            a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
          );
          this.filteredCourses = [...this.courses];
        }
        this.isLoadingCourses = false;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.isLoadingCourses = false;
      }
    });
  }

  onCourseSearch(event: any): void {
    const searchTerm = event.target.value;
    this.fechaFinalizacionForm.get('courseSearchTerm')?.setValue(searchTerm);

    if (!this.isCourseSelected) {
      this.searchCourses(searchTerm);
    }
  }

  searchCourses(searchTerm: string): void {
    if (!searchTerm || searchTerm.length < 2) {
      this.filteredCourses = [];
      return;
    }

    this.filteredCourses = this.courses.filter(course =>
      course.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  selectCourse(course: Course): void {
    this.fechaFinalizacionForm.get('curso_id')?.setValue(course.id);
    this.fechaFinalizacionForm.get('courseSearchTerm')?.setValue(course.nombre);
    this.filteredCourses = [];
    this.isCourseSelected = true;
  }

  clearCourseSearch(): void {
    this.fechaFinalizacionForm.get('courseSearchTerm')?.setValue('');
    this.filteredCourses = [];
    this.isCourseSelected = false;
    this.fechaFinalizacionForm.get('curso_id')?.setValue('');
  }

  onSchoolSearch(event: any): void {
    const searchTerm = event.target.value;
    this.fechaFinalizacionForm.get('schoolSearchTerm')?.setValue(searchTerm);

    if (!this.isSchoolSelected) {
      this.searchSchools(searchTerm);
    }
  }

  searchSchools(searchTerm: string): void {
    if (!searchTerm || searchTerm.length < 2) {
      this.filteredSchools = [];
      return;
    }

    this.isLoadingSchools = true;
    this.schoolService.searchSchool(searchTerm, 1, 10).subscribe({
      next: (response) => {
        this.filteredSchools = response.data;
        this.isLoadingSchools = false;
      },
      error: (error) => {
        console.error('Error searching schools:', error);
        this.filteredSchools = [];
        this.isLoadingSchools = false;
      }
    });
  }

  selectSchool(school: School): void {
    this.fechaFinalizacionForm.get('colegio_id')?.setValue(school.id);
    this.fechaFinalizacionForm.get('schoolSearchTerm')?.setValue(school.nombre);
    this.filteredSchools = [];
    this.isSchoolSelected = true;
  }

  clearSchoolSearch(): void {
    this.fechaFinalizacionForm.get('schoolSearchTerm')?.setValue('');
    this.filteredSchools = [];
    this.isSchoolSelected = false;
    this.fechaFinalizacionForm.get('colegio_id')?.setValue('');
  }

  onSubmit(): void {
    if (this.fechaFinalizacionForm.valid) {
      const formData = {
        fecha_finalizacion: this.fechaFinalizacionForm.get('fecha_finalizacion')?.value,
        curso_id: this.fechaFinalizacionForm.get('curso_id')?.value,
        colegio_id: this.fechaFinalizacionForm.get('colegio_id')?.value
      };

      console.log('Datos del formulario:', formData);

      // Enviar datos a Directus
      this.colegioCursosService.createColegioCurso(formData).subscribe({
        next: (response) => {
          console.log('Colegio-Curso creado exitosamente:', response);
          
          // Obtener nombres para mostrar en la notificación
          const cursoNombre = this.fechaFinalizacionForm.get('courseSearchTerm')?.value;
          const colegioNombre = this.fechaFinalizacionForm.get('schoolSearchTerm')?.value;

          this.notificationService.showSuccess(
            'Colegio y fecha de finalización guardados',
            `Se ha establecido la fecha de finalización para el curso ${cursoNombre} en ${colegioNombre}`
          );

          // Resetear formulario
          this.fechaFinalizacionForm.reset();
          this.isSchoolSelected = false;
          this.isCourseSelected = false;
          this.filteredSchools = [];
          this.filteredCourses = [];

          // Emitir evento para regresar
          this.goBack.emit();
        },
        error: (error) => {
          console.error('Error al crear colegio-curso:', error);
          this.notificationService.showError(
            'Error al guardar',
            'No se pudo guardar la información. Inténtalo nuevamente.'
          );
        }
      });
    } else {
      console.log('Formulario inválido');
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.values(this.fechaFinalizacionForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }
}
