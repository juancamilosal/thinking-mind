import { Component, OnInit } from '@angular/core';

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CourseService } from '../../../../core/services/course.service';
import { Course } from '../../../../core/models/Course';
import { CourseCardComponent } from '../../../../components/course-card/course-card';
import { CourseInfoComponent } from '../../../../components/course-info/course-info';
import { FormCourse } from './form-course/form-course';
import { ColegioCursosComponent } from './form-colegio-cursos/form-colegio-cursos';
import { NotificationService } from '../../../../core/services/notification.service';
import { ColegioCursosService } from '../../../../core/services/colegio-cursos.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CourseCardComponent,
    CourseInfoComponent,
    FormCourse,
    ColegioCursosComponent
],
  templateUrl: './courses.html'
})

export class Courses {
  courseForm!: FormGroup;
  showForm = false;
  showCourseInfo = false;
  showDetail = false;
  showColegioForm = false;
  editMode = false;
  selectedCourse: Course | null = null;
  courses: Course[] = [];
  isLoading = false;
  searchTerm = '';
  private searchTimeout: any;
  
  // Variables para el modal de edición de fecha
  showEditModal = false;
  selectedColegioCurso: any = null;
  editFechaForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private courseServices: CourseService,
    private colegioCursosService: ColegioCursosService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {
    this.initEditForm();
  }

  ngOnInit(): void {
    this.initForm();
    this.searchCourse();
  }

  initEditForm(): void {
    this.editFechaForm = this.fb.group({
      fecha_finalizacion: ['', Validators.required],
      precio_curso: ['']
    });
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.editMode = false;
    this.selectedCourse = null;
    // Scroll al inicio de la página cuando se abre el formulario
    if (this.showForm) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    // Scroll al inicio de la página
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Nuevo método para mostrar el formulario de colegio
  showColegioFormForCourse(course: Course) {
    this.selectedCourse = course;
    this.showColegioForm = true;
    // Scroll al inicio de la página
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Método para cerrar el formulario de colegio
  closeColegioForm() {
    this.showColegioForm = false;
    this.selectedCourse = null;
  }

  // Método para manejar cuando se agrega un colegio exitosamente
  onColegioAdded() {
    // Recargar los cursos para mostrar los colegios actualizados
    this.searchCourse();
  }

  // Nuevos métodos para editar y eliminar colegios_cursos
  editColegioCurso(colegioCurso: any) {
    this.selectedColegioCurso = colegioCurso;
    this.editFechaForm.patchValue({
      fecha_finalizacion: this.formatDateForInput(colegioCurso.fecha_finalizacion),
      precio_curso: (colegioCurso.precio_curso !== null && colegioCurso.precio_curso !== undefined)
        ? this.formatPrice(colegioCurso.precio_curso)
        : ''
    });
    this.showEditModal = true;
  }

  deleteColegioCurso(colegioCurso: any) {
    this.confirmationService.showDeleteConfirmation(
      colegioCurso.colegio_id?.nombre || 'este colegio',
      'colegio del programa',
      () => {
        this.colegioCursosService.deleteColegioCurso(colegioCurso.id).subscribe({
          next: (response) => {
            this.notificationService.showSuccess(
              'Éxito',
              'Colegio eliminado del programa correctamente'
            );
            this.searchCourse(); // Recargar los cursos
          },
          error: (error) => {
            console.error('Error al eliminar colegio_curso:', error);
            this.notificationService.showError(
              'Error',
              'Error al eliminar el colegio del programa'
            );
          }
        });
      }
    );
  }

  // Método para guardar la fecha editada
  saveEditedFecha() {
    if (this.editFechaForm.valid && this.selectedColegioCurso) {
      const updatedData: any = {
        // Convertimos a ISO compatible con el backend (YYYY-MM-DDT00:00:00)
        fecha_finalizacion: this.toIsoDateString(this.editFechaForm.get('fecha_finalizacion')?.value)
      };

      const rawPrice = this.editFechaForm.get('precio_curso')?.value;
      const unformattedPrice = this.unformatPrice(rawPrice);
      if (rawPrice !== null && rawPrice !== undefined && String(rawPrice).trim() !== '') {
        updatedData.precio_curso = unformattedPrice as number;
      }

      this.colegioCursosService.updateColegioCurso(this.selectedColegioCurso.id, updatedData).subscribe({
        next: (response) => {
          this.notificationService.showSuccess(
            'Éxito',
            'Fecha de finalización actualizada correctamente'
          );
          this.closeEditModal();
          this.searchCourse(); // Recargar los cursos
        },
        error: (error) => {
          console.error('Error al actualizar fecha:', error);
          this.notificationService.showError(
            'Error',
            'Error al actualizar la fecha de finalización'
          );
        }
      });
    }
  }

  // Formateo del precio para visualización en el input del modal
  onEditPriceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatPrice(input.value);
    this.editFechaForm.get('precio_curso')?.setValue(formatted, { emitEvent: false });
  }

  private formatPrice(value: any): string {
    if (value === null || value === undefined) return '';
    const numericString = String(value).replace(/[^0-9]/g, '');
    if (!numericString) return '';
    return numericString.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  private unformatPrice(value: any): number | null {
    if (value === null || value === undefined) return null;
    const numericString = String(value).replace(/\./g, '').trim();
    if (!numericString) return null;
    const num = Number(numericString);
    return isNaN(num) ? null : num;
  }

  // Formatea una fecha (string/Date) a 'YYYY-MM-DD' para input type="date"
  private formatDateForInput(value: any): string {
    if (!value) return '';
    // Si viene como string ISO, tomamos los primeros 10 caracteres
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10);
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Convierte 'YYYY-MM-DD' a 'YYYY-MM-DDT00:00:00' para el backend
  private toIsoDateString(value: any): string | null {
    if (!value) return null;
    const str = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const d = new Date(value);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00`;
    }
    return `${str}T00:00:00`;
  }

  // Método para cerrar el modal de edición
  closeEditModal() {
    this.showEditModal = false;
    this.selectedColegioCurso = null;
    this.editFechaForm.reset();
  }

  deleteCourse(course: Course) {
    this.confirmationService.showDeleteConfirmation(
      course.nombre,
      'programa',
      () => {
        this.courseServices.deleteCourse(course.id).subscribe({
          next: (response) => {
            this.notificationService.showSuccess(
              'Programa eliminado',
              `${course.nombre} ha sido eliminado exitosamente.`
            );
            this.searchCourse(); // Recargar la lista de cursos
          },
          error: (error) => {
            console.error('Error al eliminar el programa:', error);
            this.notificationService.showError(
              'Error al eliminar',
              'No se pudo eliminar el programa. Inténtalo nuevamente.'
            );
          }
        });
      }
    );
  }
}
