import {Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import { CourseService } from '../../../../../core/services/course.service';
import { Course } from '../../../../../core/models/Course';
import {NotificationService} from '../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';

@Component({
  selector: 'app-form-course',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-course.html'
})
export class FormCourse implements OnInit, OnChanges {

  @Input() editMode: boolean = false;
  @Input() courseData: Course | null = null;
  @Output() goBack = new EventEmitter();
  @Output() searchCourse = new EventEmitter();
  @Output() courseUpdated = new EventEmitter();
  courseForm!: FormGroup;
  selectedFile: File | null = null;
  selectedFileName: string = '';

  constructor(
    private fb: FormBuilder,
    private courseServices: CourseService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientData'] && this.courseForm) {
      this.loadCourseData();
    }
  }

  initForm=(): void => {
    this.courseForm = this.fb.group({
      nombre: [null, Validators.required],
      precio: [null, Validators.required],
      sku: [null, [Validators.required]],
      imagen: [null],
      precio_inscripcion: [null]
    });

    if (this.editMode && this.courseData) {
      this.loadCourseData();
    }
  }

  loadCourseData(): void {
    if (this.courseData) {
      this.courseForm.patchValue({
        nombre: this.courseData.nombre,
        precio: this.courseData.precio,
        sku: this.courseData.sku,
        imagen: this.courseData.imagen,
        precio_inscripcion: this.courseData.precio_inscripcion,
      });
    }
  }

  onSubmit=(): void => {
    if (this.courseForm.valid) {
      if (this.editMode) {
        this.updateCourse();
      } else {
        this.createCourse();
      }
    } else {
      this.markFormGroupTouched(this.courseForm);
    }
  }

  private markFormGroupTouched=(formGroup:FormGroup): void => {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  createCourse=(): void => {
    const course = {
      nombre: this.courseForm.value.nombre,
      precio: this.courseForm.value.precio,
      sku: this.courseForm.value.sku,
      imagen: this.courseForm.value.imagen,
      precio_inscripcion: this.courseForm.value.precio_inscripcion,
    }

    this.courseServices.createCourse(course).subscribe({
      next: (): void => {
        this.notificationService.showCourseCreated(course.nombre);
        this.courseServices.searchCourse();
        this.goBack.emit();
        this.searchCourse.emit();
      },
      error: (error): void => {
        const errorArray = error.errors || error.error;
        if (errorArray && Array.isArray(errorArray) && errorArray.length > 0) {
          const directusError = errorArray[0];
          if (directusError.extensions && directusError.extensions.code === 'RECORD_NOT_UNIQUE') {
            const duplicateValue = directusError.extensions.value;
            this.notificationService.showError('Curso ya se encuentra creado', `Ya existe un curso registrado con el nombre ${duplicateValue}.`);
            return;
          }
        }
        if (error.status === 400) {
          this.notificationService.showError('Curso ya se encuentra creado', `Ya existe un curso registrado con el nombre ${course.nombre}.`);
        } else if (error.status === 409) {
          this.notificationService.showError('Curso ya se encuentra creado', `Ya existe un curso registrado con el código ${course.sku}.`);
        } else if (error.status >= 500) {
          this.notificationService.showServerError();
        } else {
          this.notificationService.showError('Error', 'No se pudo crear el curso. Inténtalo nuevamente.');
        }
      }
    });
  }

  updateCourse() {
    if (this.courseForm.valid && this.courseData?.id) {
      const courseToUpdate = this.courseForm.value;
      this.courseServices.updateCourse(Number(this.courseData.id), courseToUpdate).subscribe({
        next: (response) => {
          this.courseUpdated.emit();
        },
        error: (error) => {
          console.error('Error al actualizar curso:', error);
        }
      });
    }
  }

  deleteCourse() {
    if (this.courseData?.id) {
      this.confirmationService.showDeleteConfirmation(
        this.courseData.nombre,
        'curso',
        () => {
          // Callback de confirmación
          this.courseServices.deleteCourse(Number(this.courseData!.id)).subscribe({
            next: (response) => {
              this.notificationService.showSuccess(
                'Curso eliminado',
                `${this.courseData?.nombre} ha sido eliminado exitosamente.`
              );
              this.courseUpdated.emit();
            },
            error: (error) => {
              this.notificationService.showError(
                'Error al eliminar',
                'No se pudo eliminar el curso. Inténtalo nuevamente.'
              );
            }
          });
        }
      );
    }
  }

  //Para subir archivos
  onFileSelected(event: any): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFileName = input.files[0].name;
      this.selectedFile = event.target.files[0];
    }
  }

  onUpload(): void {
    this.courseServices.uploadFile(this.selectedFile).subscribe({
      next: (response) => {
        console.log('File uploaded successfully', response);
      },
      error: (error) => {
        console.error('Error uploading file', error);
      }
    });
  }
}
