import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {CourseCardComponent} from '../../../../components/course-card/course-card';
import {CourseInfoComponent} from '../../../../components/course-info/course-info';
import { CourseService } from '../../../../core/services/course.service';
import { Course } from '../../../../core/models/Course';
import { FormCourse } from './form-course/form-course';

@Component({
  selector: 'app-courses',
  imports: [
    CommonModule,
    CourseCardComponent,
    CourseInfoComponent,
    FormCourse
  ],
  templateUrl: './courses.html',
  standalone: true
})

export class Courses {
  courseForm!: FormGroup;
  showForm = false;
  showCourseInfo = false;
  showDetail = false;
  editMode = false;
  selectedCourse: Course | null = null;
  courses: Course[] = [];
  isLoading = false;
  searchTerm = '';
  private searchTimeout: any;

  constructor(private fb: FormBuilder, private courseServices: CourseService) {
    }

  ngOnInit() {
    this.initForm();
    this.searchCourse();
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.editMode = false;
    this.selectedCourse = null;
    // Consultar el servicio para actualizar la lista cuando se regresa del formulario
    if (!this.showForm) {
      this.searchCourse();
    }
  }

  initForm() {
    this.courseForm = this.fb.group({
      nombre: ['', Validators.required],
      precio: ['', Validators.required],
      codigo: ['', Validators.required]
    });
  }

  searchCourse(searchTerm?: string) {
    this.isLoading = true;
    this.courseServices.searchCourse(searchTerm).subscribe({
      next: (data) => {
        // Ordenar los cursos alfabéticamente por nombre
        this.courses = data.data.sort((a, b) =>
          a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
        );
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.searchCourse(this.searchTerm.trim() || undefined);
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;

    // Limpiar timeout anterior
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Si el campo está vacío, buscar inmediatamente
    if (this.searchTerm.trim() === '') {
      this.searchCourse();
      return;
    }

    // Establecer nuevo timeout para búsqueda automática
    this.searchTimeout = setTimeout(() => {
      this.searchCourse(this.searchTerm.trim() || undefined);
    }, 300); // Reducido a 300ms para mayor responsividad
  }

  // Método mejorado para limpiar búsqueda
  clearSearch() {
    this.searchTerm = '';
    this.searchCourse();
  }

  openCourseInfo(course: Course) {
    this.selectedCourse = course;
    this.showCourseInfo = true;
  }

  closeCourseInfo() {
    this.selectedCourse = null;
    this.showCourseInfo = false;
  }

  onCourseUpdated() {
    this.searchCourse();
    this.toggleForm();
  }


  loadCourses(): void {
    this.isLoading = true;
    this.courseServices.searchCourse(this.searchTerm).subscribe({
      next: (response) => {
        if (response.data) {
          // Ordenar los cursos alfabéticamente por nombre
          this.courses = response.data.sort((a, b) =>
            a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
          );
        }
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        // Manejar error
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  editCourse(course: Course) {
    this.selectedCourse = course;
    this.editMode = true;
    this.showForm = true;
  }

  deleteCourse(course: Course) {
    if (confirm(`¿Estás seguro de que deseas eliminar el curso "${course.nombre}"?`)) {
      this.courseServices.deleteCourse(course.id).subscribe({
        next: (response) => {
          this.searchCourse(); // Recargar la lista de cursos
        },
        error: (error) => {
          console.error('Error al eliminar el curso:', error);
          // Aquí puedes agregar una notificación de error
        }
      });
    }
  }
}
