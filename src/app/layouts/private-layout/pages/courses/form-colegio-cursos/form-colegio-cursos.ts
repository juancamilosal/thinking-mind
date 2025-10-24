import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

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
    ReactiveFormsModule
],
  templateUrl: './form-colegio-cursos.html',
  styleUrl: './form-colegio-cursos.css'
})
export class ColegioCursosComponent implements OnInit {
  @Input() selectedCourse: Course | null = null;
  @Output() goBack = new EventEmitter<void>();
  @Output() colegioAdded = new EventEmitter<void>(); // Nuevo evento para notificar que se agregó un colegio

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

    const specialLaunchCtrl = this.fechaFinalizacionForm.get('precio_especial_lanzamiento');
    const specialPriceCtrl = this.fechaFinalizacionForm.get('precio_especial');
    specialLaunchCtrl?.valueChanges.subscribe((checked: boolean) => {
      if (checked) {
        specialPriceCtrl?.addValidators(Validators.required);
      } else {
        specialPriceCtrl?.clearValidators();
        // Limpiar el campo cuando se desmarca
        specialPriceCtrl?.setValue('');
      }
      specialPriceCtrl?.updateValueAndValidity();
    });
  }

  initForm(): void {
    this.fechaFinalizacionForm = this.fb.group({
      fecha_finalizacion: [null, Validators.required],
      curso_id: [null, Validators.required],
      colegio_id: [null, Validators.required],
      precio_curso: [null, Validators.required],
      programa_con_inscripcion: [false], // Checkbox para mostrar/ocultar campos de inscripción
      precio_inscripcion: [null], // Campo opcional
      moneda: [''], // Campo para moneda
      precio_especial_lanzamiento: [false],
      precio_especial: [null],
      courseSearchTerm: [null],
      schoolSearchTerm: [null]
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
      const precioEspecialLanzamiento = !!this.fechaFinalizacionForm.get('precio_especial_lanzamiento')?.value;
      const precioEspecialValor = precioEspecialLanzamiento
        ? this.unformatPrice(this.fechaFinalizacionForm.get('precio_especial')?.value)
        : null;

      // Obtener la fecha actual sin hora (solo fecha)
      const fechaCreacion = new Date();
      fechaCreacion.setHours(0, 0, 0, 0); // Establecer hora a 00:00:00
      const fechaCreacionISO = fechaCreacion.toISOString().split('T')[0]; // Formato YYYY-MM-DD

      const formData = {
        fecha_finalizacion: this.fechaFinalizacionForm.get('fecha_finalizacion')?.value,
        curso_id: this.fechaFinalizacionForm.get('curso_id')?.value,
        colegio_id: this.fechaFinalizacionForm.get('colegio_id')?.value,
        // Enviar el precio desformateado (sin puntos) como número
        precio_curso: this.unformatPrice(this.fechaFinalizacionForm.get('precio_curso')?.value),
        // Campos de inscripción (solo si el checkbox está marcado)
        programa_con_inscripcion: this.fechaFinalizacionForm.get('programa_con_inscripcion')?.value || false,
        precio_inscripcion: this.fechaFinalizacionForm.get('programa_con_inscripcion')?.value && this.fechaFinalizacionForm.get('precio_inscripcion')?.value 
          ? this.unformatPrice(this.fechaFinalizacionForm.get('precio_inscripcion')?.value) 
          : null,
        moneda: this.fechaFinalizacionForm.get('programa_con_inscripcion')?.value && this.fechaFinalizacionForm.get('moneda')?.value 
          ? this.fechaFinalizacionForm.get('moneda')?.value 
          : null,
        // Nuevo: precio especial para Directus
        tiene_precio_especial: precioEspecialLanzamiento ? 'TRUE' : 'FALSE',
        precio_especial: precioEspecialValor,
        // Nueva fecha de creación
        fecha_creacion: fechaCreacionISO
      };
      // Enviar datos a Directus
      this.colegioCursosService.createColegioCurso(formData).subscribe({
        next: (response) => {
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

          // Emitir evento para notificar que se agregó un colegio
          this.colegioAdded.emit();

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
      this.markFormGroupTouched();
    }
  }

  onInscriptionPriceInput(event: any): void {
    const input = event.target;
    const value = input.value;
    
    // Remover todo lo que no sea dígito
    const numericValue = value.replace(/\D/g, '');
    
    // Formatear con puntos como separadores de miles
    const formattedValue = this.formatPrice(numericValue);
    
    // Actualizar el valor del input
    input.value = formattedValue;
    
    // Actualizar el FormControl
    this.fechaFinalizacionForm.get('precio_inscripcion')?.setValue(formattedValue, { emitEvent: false });
  }

  onPriceInput(event: any): void {
    const inputEl = event.target as HTMLInputElement;
    // Mantener solo dígitos, luego formatear con puntos cada 3
    const digitsOnly = (inputEl.value || '').replace(/\D/g, '');
    const formatted = this.formatPrice(digitsOnly);
    this.fechaFinalizacionForm.get('precio_curso')?.setValue(formatted, { emitEvent: false });
  }

  onSpecialPriceInput(event: any): void {
    const inputEl = event.target as HTMLInputElement;
    const digitsOnly = (inputEl.value || '').replace(/\D/g, '');
    const formatted = this.formatPrice(digitsOnly);
    this.fechaFinalizacionForm.get('precio_especial')?.setValue(formatted, { emitEvent: false });
  }

  private formatPrice(value: string): string {
    if (!value) return '';
    // Insertar puntos como separadores de miles
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  private unformatPrice(value: string | null | undefined): number {
    const numericStr = (value || '').replace(/\./g, '');
    return numericStr ? parseInt(numericStr, 10) : 0;
  }

  private markFormGroupTouched(): void {
    Object.values(this.fechaFinalizacionForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }
}
