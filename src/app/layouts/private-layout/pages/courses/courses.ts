import { Component, OnInit, NgZone } from '@angular/core';

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
import { HistorialProgramasService } from '../../../../core/services/historial-programas.service';

declare var gapi: any;

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

  // Historial de Programas
  showHistory = false;
  isLoadingHistorial = false;
  historialItems: any[] = [];
  // Búsqueda y paginación para Historial
  historialSearchTerm: string = '';
  historialCurrentPage: number = 1;
  historialItemsPerPage: number = 10;
  historialTotalCount: number = 0;
  historialTotalPages: number = 1;
  // Utility method for Math functions in template
  Math = Math;

  // Variables para el modal de edición de fecha
  showEditModal = false;
  selectedColegioCurso: any = null;
  editFechaForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private courseServices: CourseService,
    private colegioCursosService: ColegioCursosService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private historialService: HistorialProgramasService,
    private ngZone: NgZone
  ) {
    this.initEditForm();
  }

  ngOnInit(): void {
    this.initForm();
    this.searchCourse();
  }

  initEditForm(): void {
    this.editFechaForm = this.fb.group({
      fecha_finalizacion: [null, Validators.required],
      precio_curso: [null, Validators.required],
      programa_con_inscripcion: [false],
      precio_inscripcion: [null],
      moneda: ['CLP'],
      precio_especial_lanzamiento: [false],
      precio_especial: [null],
      fecha_finalizacion_precio_especial: [null],
      programa_independiente: [false]
    });

    // Validación dinámica del precio especial
    const specialFlagCtrl = this.editFechaForm.get('precio_especial_lanzamiento');
    const specialPriceCtrl = this.editFechaForm.get('precio_especial');
    specialFlagCtrl?.valueChanges.subscribe((flag: boolean) => {
      if (flag) {
        specialPriceCtrl?.addValidators([Validators.required]);
      } else {
        specialPriceCtrl?.clearValidators();
        specialPriceCtrl?.setValue('', { emitEvent: false });
      }
      specialPriceCtrl?.updateValueAndValidity();
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

  // Toggle Historial de Programas
  toggleHistory() {
    this.showHistory = !this.showHistory;
    if (this.showHistory) {
      this.loadHistorialProgramas();
    }
  }

  loadHistorialProgramas(page: number = this.historialCurrentPage) {
    this.isLoadingHistorial = true;
    const limit = this.historialItemsPerPage;
    const search = this.historialSearchTerm?.trim() || undefined;
    this.historialService.getHistorialProgramas(search, page, limit).subscribe({
      next: (response) => {
        const allItems = response.data || [];
        // meta puede traer total_count del paginador de Directus
        const totalCount = response.meta?.total_count ?? allItems.length;
        this.historialTotalCount = totalCount;
        this.historialTotalPages = Math.max(1, Math.ceil(totalCount / this.historialItemsPerPage));
        this.historialCurrentPage = page;
        const invalidItems = allItems.filter((item: any) => {
          const rel = item?.id_colegios_cursos;
          return Array.isArray(rel) ? rel.length === 0 : !rel;
        });
        const validItems = allItems.filter((item: any) => {
          const rel = item?.id_colegios_cursos;
          return Array.isArray(rel) ? rel.length > 0 : !!rel;
        });

        if (invalidItems.length > 0) {
          // Mantener el spinner activo durante las eliminaciones
          this.isLoadingHistorial = true;
          let completed = 0;
          invalidItems.forEach((item: any) => {
            this.historialService.deleteHistorialProgramas(item.id).subscribe({
              next: () => {
                completed++;
                if (completed === invalidItems.length) {
                  this.historialItems = validItems.sort((a: any, b: any) => {
                    const nameA = (a?.curso_id?.nombre ?? a?.nombre ?? '').toString().toLowerCase();
                    const nameB = (b?.curso_id?.nombre ?? b?.nombre ?? '').toString().toLowerCase();
                    return nameA.localeCompare(nameB);
                  });
                  this.isLoadingHistorial = false;
                }
              },
              error: () => {
                completed++;
                if (completed === invalidItems.length) {
                  this.historialItems = validItems.sort((a: any, b: any) => {
                    const nameA = (a?.curso_id?.nombre ?? a?.nombre ?? '').toString().toLowerCase();
                    const nameB = (b?.curso_id?.nombre ?? b?.nombre ?? '').toString().toLowerCase();
                    return nameA.localeCompare(nameB);
                  });
                  this.isLoadingHistorial = false;
                }
              }
            });
          });
        } else {
          // Ordenar por fecha_finalizacion descendente si existe
          this.historialItems = validItems.sort((a: any, b: any) => {
            const nameA = (a?.curso_id?.nombre ?? a?.nombre ?? '').toString().toLowerCase();
            const nameB = (b?.curso_id?.nombre ?? b?.nombre ?? '').toString().toLowerCase();
            return nameA.localeCompare(nameB);
          });
          this.isLoadingHistorial = false;
        }
      },
      error: (error) => {
        console.error('Error cargando historial_programas:', error);
        this.notificationService.showError('Error', 'No se pudo cargar el historial de programas');
      },
      complete: () => {
      }
    });
  }

  onHistorialSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.historialSearchTerm = target.value;
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.historialCurrentPage = 1;
      this.loadHistorialProgramas(1);
    }, 300);
  }

  onHistorialSearch() {
    this.historialCurrentPage = 1;
    this.loadHistorialProgramas(1);
  }

  clearHistorialSearch() {
    this.historialSearchTerm = '';
    this.historialCurrentPage = 1;
    this.loadHistorialProgramas(1);
  }

  goToHistorialPage(page: number) {
    if (page >= 1 && page <= this.historialTotalPages) {
      this.historialCurrentPage = page;
      this.loadHistorialProgramas(page);
    }
  }

  previousHistorialPage() {
    this.goToHistorialPage(this.historialCurrentPage - 1);
  }

  nextHistorialPage() {
    this.goToHistorialPage(this.historialCurrentPage + 1);
  }

  onHistorialItemsPerPageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newLimit = parseInt(target.value);
    this.historialItemsPerPage = isNaN(newLimit) ? 10 : newLimit;
    this.historialCurrentPage = 1;
    this.loadHistorialProgramas(1);
  }

  getHistorialPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.historialCurrentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.historialTotalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  }

  closeCourseInfo() {
    this.selectedCourse = null;
    this.showCourseInfo = false;
  }

  onCourseUpdated() {
    this.searchCourse();
    this.toggleForm();
  }

  editCourse(course: Course) {
    this.selectedCourse = course;
    this.editMode = true;
    this.showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showColegioFormForCourse(course: Course) {
    this.selectedCourse = course;
    this.showColegioForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeColegioForm() {
    this.showColegioForm = false;
    this.selectedCourse = null;
  }

  onColegioAdded() {
    this.searchCourse();
  }

  editColegioCurso(colegioCurso: any) {
    this.selectedColegioCurso = colegioCurso;
    this.editFechaForm.patchValue({
      fecha_finalizacion: this.formatDateForInput(colegioCurso.fecha_finalizacion),
      precio_curso: (colegioCurso.precio_curso !== null && colegioCurso.precio_curso !== undefined)
        ? this.formatPrice(colegioCurso.precio_curso)
        : '',
      programa_con_inscripcion: this.isTruthyFlag(colegioCurso.programa_con_inscripcion),
      precio_inscripcion: (colegioCurso.precio_inscripcion !== null && colegioCurso.precio_inscripcion !== undefined)
        ? this.formatPrice(colegioCurso.precio_inscripcion)
        : '',
      moneda: colegioCurso.moneda || '',
      precio_especial_lanzamiento: this.isTruthyFlag(colegioCurso.tiene_precio_especial),
      precio_especial: (colegioCurso.precio_especial !== null && colegioCurso.precio_especial !== undefined)
        ? this.formatPrice(colegioCurso.precio_especial)
        : '',
      fecha_finalizacion_precio_especial: colegioCurso.fecha_finalizacion_precio_especial || null,
      programa_independiente: colegioCurso.programa_independiente || false
    });
    this.showEditModal = true;
  }

  deleteColegioCurso(colegioCurso: any) {
    this.confirmationService.showDeleteConfirmation(
      colegioCurso.colegio_id?.nombre || 'este colegio',
      'colegio del programa',
      async () => {
        if (colegioCurso.id_reunion) {
          try {
            if (typeof gapi !== 'undefined' && gapi.client && gapi.client.calendar) {
              await gapi.client.calendar.events.delete({
                calendarId: 'primary',
                eventId: colegioCurso.id_reunion
              });
            }
          } catch (error) {
            this.notificationService.showSuccess(
              'Éxito',
              'Error al eliminar evento de Google Calendar:', error
            );
          }
        }

        this.colegioCursosService.deleteColegioCurso(colegioCurso.id).subscribe({
          next: (response) => {
            this.ngZone.run(() => {
              this.notificationService.showSuccess(
                'Éxito',
                'Colegio eliminado del programa correctamente'
              );
              this.searchCourse();
            });
          },
          error: (error) => {
            this.ngZone.run(() => {
              this.notificationService.showError(
                'Error',
                'Error al eliminar el colegio del programa'
              );
            });
          }
        });
      }
    );
  }

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

      // Campo programa_con_inscripcion
      const programaConInscripcion = !!this.editFechaForm.get('programa_con_inscripcion')?.value;
      updatedData.programa_con_inscripcion = programaConInscripcion ? 'TRUE' : 'FALSE';

      // Nuevos campos: precio_inscripcion y moneda
      if (programaConInscripcion) {
        // Si el programa tiene inscripción, usar los valores del formulario
        const rawInscriptionPrice = this.editFechaForm.get('precio_inscripcion')?.value;
        const unformattedInscriptionPrice = this.unformatPrice(rawInscriptionPrice);
        if (rawInscriptionPrice !== null && rawInscriptionPrice !== undefined && String(rawInscriptionPrice).trim() !== '') {
          updatedData.precio_inscripcion = unformattedInscriptionPrice as number;
        } else {
          updatedData.precio_inscripcion = null;
        }

        const monedaValue = this.editFechaForm.get('moneda')?.value;
        if (monedaValue && monedaValue.trim() !== '') {
          updatedData.moneda = monedaValue;
        } else {
          updatedData.moneda = null;
        }
      } else {
        // Si el programa NO tiene inscripción, establecer valores por defecto
        updatedData.precio_inscripcion = 0;
        updatedData.moneda = null;
      }

      // Precio especial de lanzamiento
      const specialFlag = !!this.editFechaForm.get('precio_especial_lanzamiento')?.value;
      updatedData.tiene_precio_especial = specialFlag ? 'TRUE' : 'FALSE';
      if (specialFlag) {
        const rawSpecial = this.editFechaForm.get('precio_especial')?.value;
        const unformattedSpecial = this.unformatPrice(rawSpecial);
        if (rawSpecial !== null && rawSpecial !== undefined && String(rawSpecial).trim() !== '') {
          updatedData.precio_especial = unformattedSpecial as number;
        } else {
          updatedData.precio_especial = null;
        }
        // Agregar fecha de finalización del precio especial
        updatedData.fecha_finalizacion_precio_especial = this.editFechaForm.get('fecha_finalizacion_precio_especial')?.value;
      } else {
        updatedData.precio_especial = null;
        updatedData.fecha_finalizacion_precio_especial = null;
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

  onEditInscriptionPriceInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    // Mantener solo dígitos, luego formatear con puntos cada 3
    const numericValue = inputEl.value.replace(/\D/g, '');
    const formattedValue = this.formatPrice(numericValue);
    inputEl.value = formattedValue;
    this.editFechaForm.get('precio_inscripcion')?.setValue(formattedValue, { emitEvent: false });
  }

  onEditPriceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatPrice(input.value);
    this.editFechaForm.get('precio_curso')?.setValue(formatted, { emitEvent: false });
  }

  onEditSpecialPriceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitsOnly = String(input.value || '').replace(/\D/g, '');
    const formatted = this.formatPrice(digitsOnly);
    this.editFechaForm.get('precio_especial')?.setValue(formatted, { emitEvent: false });
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

  private isTruthyFlag(flag: any): boolean {
    return flag === true || flag === 'TRUE' || flag === 1 || flag === '1' || flag === 'true';
  }

  private formatDateForInput(value: any): string {
    if (!value) return '';
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
  // Helpers de formato para historial
  formatCurrency(value: any): string {
    const num = typeof value === 'number' ? value : Number(value);
    if (!isFinite(num)) return '';
    try {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
    } catch (_) {
      return num.toLocaleString('es-CO');
    }
  }

  formatDatePretty(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: '2-digit' });
  }

  // Método para calcular días entre dos fechas
  calculateDaysBetweenDates(startDate: string, endDate: string): number {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const timeDifference = end.getTime() - start.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

    return daysDifference > 0 ? daysDifference : 0;
  }
}
