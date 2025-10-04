import {Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges, ChangeDetectorRef} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';

import { Router } from '@angular/router';
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
  imagePreview: string | null = null;
  uploadedImageId: string | null = null;
  isDragOver: boolean = false;
  isUploadingImage: boolean = false;
  isSubmitting: boolean = false; // Nueva variable para el estado de envío
  showImageSection: boolean = false; // Controla cuándo mostrar la sección de imagen
  courseCreated: boolean = false; // Indica si el curso ya fue creado
  createdCourseId: string | null = null; // ID del curso creado
  isDeleting = false;

  constructor(
    private fb: FormBuilder,
    private courseServices: CourseService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['courseData'] && this.courseData && this.courseForm) {
      this.loadCourseData();
    }
    // Mostrar sección de imagen en modo edición
    if (changes['editMode']) {
      this.showImageSection = this.editMode;
    }
  }

  initForm=(): void => {
    this.courseForm = this.fb.group({
      nombre: [null, Validators.required],
      precio_inscripcion: [null],
      codigo: [null, [Validators.required]],
      img: [null] // Campo para el ID de la imagen en Directus
    });

    if (this.editMode && this.courseData) {
      this.loadCourseData();
    }
  }

  loadCourseData(): void {
    if (this.courseData && this.courseForm) {
      this.courseForm.patchValue({
        nombre: this.courseData.nombre,
        precio_inscripcion: this.courseData.precio_inscripcion ?? null,
        codigo: this.courseData.codigo || this.courseData.sku || '', // Usar sku como fallback si codigo no existe
        img: this.courseData.img || null
      });

      // Si hay una imagen, configurar la vista previa
      if (this.courseData.img_url) {
        this.imagePreview = this.courseData.img_url;
        this.uploadedImageId = this.courseData.img;
      }
    }
  }

  onSubmit=(): void => {
    if (this.courseForm.valid && !this.isSubmitting) {
      this.isSubmitting = true; // Activar estado de carga
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
    this.isSubmitting = true;

    if (!this.courseCreated) {
      // Primer paso: crear el curso sin imagen
      this.createCourseOnly();
    } else {
      // Segundo paso: subir imagen y finalizar
      this.uploadImageAndFinish();
    }
  }

  private createCourseOnly(): void {
    // Crear curso sin imagen
    const course = {
      nombre: this.courseForm.value.nombre,
      precio_inscripcion: this.courseForm.value.precio_inscripcion,
      sku: this.courseForm.value.codigo,
      codigo: this.courseForm.value.codigo
    };

    this.courseServices.createCourse(course).subscribe({
      next: (response) => {
        this.createdCourseId = response.data.id;
        this.courseCreated = true;
        this.isSubmitting = false;
        this.showImageSection = true;
        this.notificationService.showSuccess('Programa creado exitosamente', 'Ahora puedes agregar una imagen al programa');
      },
      error: (error) => {
        this.isSubmitting = false;
        this.notificationService.showError('Error al crear el programa', error.error?.message || 'Error desconocido');
      }
    });
  }



  private uploadImageAndFinish(): void {
    if (!this.selectedFile) {
      this.showSuccessModal();
      return;
    }

    this.isUploadingImage = true;
    this.courseServices.uploadFile(this.selectedFile).subscribe({
      next: (response) => {
        const imageId = response.data.id;
        // Actualizar curso con la imagen
        this.courseServices.updateCourse(this.createdCourseId!, { img: imageId }).subscribe({
          next: (updatedCourse) => {
            this.isUploadingImage = false;
            this.isSubmitting = false;
            this.uploadedImageId = imageId;
            this.selectedFile = null;
            this.imagePreview = null;
            if (updatedCourse && updatedCourse.data && updatedCourse.data.img_url) {
              if (!this.courseData) {
                this.courseData = {} as Course;
              }
              this.courseData.img_url = updatedCourse.data.img_url;
            }

            this.showSuccessModal();
          },
          error: (error) => {
            this.isUploadingImage = false;
            this.isSubmitting = false;
            this.notificationService.showError('Error al asociar la imagen', error.error?.message || 'Error desconocido');
          }
        });
      },
      error: (error) => {
        this.isUploadingImage = false;
        this.isSubmitting = false;
        this.notificationService.showError('Error al subir la imagen', error.error?.message || 'Error desconocido');
      }
    });
  }

  private showSuccessModal(): void {
    this.isSubmitting = false;
    this.notificationService.showSuccess('Programa creado exitosamente', 'El programa ha sido creado correctamente.');
    this.cdr.detectChanges();
    this.courseUpdated.emit();
  }

  private submitCourse(course: any): void {
    this.courseServices.createCourse(course).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.notificationService.showSuccess('Programa creado exitosamente',"");
        this.courseUpdated.emit();
        // Remover: this.goBack.emit();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.notificationService.showError('Error al crear el programa');
      }
    });
  }

  updateCourse() {
    if (this.courseForm.valid && this.courseData?.id) {
      this.isSubmitting = true;
      this.updateCourseWithoutNewImage();
    }
  }

  private uploadImageAndUpdateCourse(): void {
    this.isUploadingImage = true;
    this.courseServices.uploadFile(this.selectedFile!).subscribe({
      next: (response) => {
        this.uploadedImageId = response.data.id;
        this.isUploadingImage = false;
        this.updateCourseWithNewImage();
      },
      error: (error) => {
        this.isUploadingImage = false;
        this.notificationService.showError('Error', 'No se pudo subir la imagen. Inténtalo nuevamente.');
      }
    });
  }

  private updateCourseWithoutNewImage(): void {
    const courseToUpdate = {
      nombre: this.courseForm.value.nombre,
      precio_inscripcion: this.courseForm.value.precio_inscripcion,
      sku: this.courseForm.value.codigo
    };

    this.courseServices.updateCourse(this.courseData!.id, courseToUpdate).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.notificationService.showSuccess('Programa actualizado exitosamente', "");
        this.courseUpdated.emit();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.notificationService.showError('Error al actualizar el programa',"");
      }
    });
  }

  private updateCourseWithNewImage(): void {
    const courseToUpdate = {
      nombre: this.courseForm.value.nombre,
      precio_inscripcion: this.courseForm.value.precio_inscripcion,
      sku: this.courseForm.value.codigo,
      img: this.uploadedImageId
    };

    const previousImageId = this.courseData?.img;

    this.courseServices.updateCourse(this.courseData!.id, courseToUpdate).subscribe({
      next: (response) => {
        if (previousImageId) {
          this.courseServices.deleteFile(previousImageId).subscribe();
        }
        this.notificationService.showSuccess('Programa actualizado exitosamente', "");
        this.courseUpdated.emit();
      },
      error: (error) => {
        console.error('Error updating course:', error);
        this.notificationService.showError('Error al actualizar el programa');
      }
    });
  }

  deleteCourse() {
    if (this.courseData?.id) {
      this.confirmationService.showDeleteConfirmation(
        this.courseData.nombre,
        'programa',
        () => {
          this.isDeleting = true;
          this.courseServices.deleteCourse(this.courseData!.id).subscribe({
            next: (response) => {
              this.isDeleting = false;
              this.notificationService.showSuccess(
                'Programa eliminado',
                `${this.courseData?.nombre} ha sido eliminado exitosamente.`
              );
              this.courseUpdated.emit();
            },
            error: (error) => {
              this.isDeleting = false;
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

  triggerFileInput(): void {
    if (this.isUploadingImage) return;
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.processSelectedFile(file);
    }
  }

  private processSelectedFile(file: File): void {

    if (!file.type.startsWith('image/')) {
      this.notificationService.showError('Error', 'Por favor selecciona un archivo de imagen válido.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.notificationService.showError('Error', 'El archivo es demasiado grande. Tamaño máximo: 5MB.');
      return;
    }

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagePreview = e.target.result;
    };
    reader.readAsDataURL(file);

    if (this.editMode && this.courseData?.id && this.courseForm.valid) {
      this.uploadImageAndUpdateCourse();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (this.isUploadingImage) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processSelectedFile(files[0]);
    }
  }

  removeSelectedFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile = null;
    this.imagePreview = null;
    this.uploadedImageId = null;


    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  changeCurrentImage(event: Event): void {
    event.stopPropagation();
    this.triggerFileInput();
  }

  removeCurrentImage(event: Event): void {
    event.stopPropagation();

    if (this.courseData) {
      this.courseData.img_url = undefined;
    }

    this.triggerFileInput();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onUpload(): void {
    if (this.selectedFile) {
      this.courseServices.uploadFile(this.selectedFile).subscribe({
        next: (response) => {
          this.notificationService.showSuccess('Imagen subida exitosamente','');
        },
        error: (error) => {
          console.error('Error uploading file', error);
          this.notificationService.showError('Error', 'No se pudo subir la imagen.');
        }
      });
    }
  }
  onNombreInput(event: any): void {
    const value = event.target.value.toUpperCase();
    this.courseForm.patchValue({
      nombre: value
    });
  }

  onCodigoInput(event: any): void {
    const value = event.target.value.toUpperCase();
    this.courseForm.patchValue({
      codigo: value
    });
  }

  resetForm(): void {
    this.courseForm.reset();
    this.selectedFile = null;
    this.imagePreview = null;
    this.uploadedImageId = null;
    this.isSubmitting = false;
    this.showImageSection = false;
    this.courseCreated = false;
    this.createdCourseId = null;
  }
}
