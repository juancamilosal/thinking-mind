import {Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';
import { CourseService } from '../../../../../core/services/course.service';
import { Course } from '../../../../../core/models/Course';
import {NotificationService} from '../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';

@Component({
  selector: 'app-form-course',
  imports: [
    ReactiveFormsModule,
    CommonModule
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
    if (changes['courseData'] && this.courseForm) {
      this.loadCourseData();
    }
  }

  initForm=(): void => {
    this.courseForm = this.fb.group({
      nombre: [null, Validators.required],
      precio: [null, Validators.required],
      codigo: [null, [Validators.required]],
      img: [null] // Campo para el ID de la imagen en Directus
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

    if (this.selectedFile) {
      this.uploadImageAndCreateCourse();
    } else {
      this.createCourseWithoutImage();
    }
  }

  private uploadImageAndCreateCourse(): void {
    this.isUploadingImage = true;
    this.courseServices.uploadFile(this.selectedFile!).subscribe({
      next: (response) => {
        console.log('Imagen subida exitosamente', response);
        this.uploadedImageId = response.data.id;
        this.isUploadingImage = false;
        this.createCourseWithImage();
      },
      error: (error) => {
        console.error('Error al subir imagen', error);
        this.isUploadingImage = false;
        this.notificationService.showError('Error', 'No se pudo subir la imagen. Inténtalo nuevamente.');
      }
    });
  }

  private createCourseWithImage(): void {
    const course = {
      nombre: this.courseForm.value.nombre,
      precio: this.courseForm.value.precio,
      sku: this.courseForm.value.codigo,
      img: this.uploadedImageId
    }

    this.submitCourse(course);
  }

  private createCourseWithoutImage(): void {
    const course = {
      nombre: this.courseForm.value.nombre,
      precio: this.courseForm.value.precio,
      sku: this.courseForm.value.codigo
    }

    this.submitCourse(course);
  }

  private submitCourse(course: any): void {
    this.courseServices.createCourse(course).subscribe({
      next: (response) => {
        this.isSubmitting = false; // Desactivar estado de carga
        this.notificationService.showSuccess('Curso creado exitosamente',"");
        this.searchCourse.emit();
        this.goBack.emit();
      },
      error: (error) => {
        this.isSubmitting = false; // Desactivar estado de carga en caso de error
        console.error('Error creating course:', error);
        this.notificationService.showError('Error al crear el curso');
      }
    });
  }

  updateCourse() {
    if (this.courseForm.valid && this.courseData?.id) {
      if (this.selectedFile) {
        this.uploadImageAndUpdateCourse();
      } else {
        this.updateCourseWithoutNewImage();
      }
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

  private updateCourseWithNewImage(): void {
    const courseToUpdate = {
      nombre: this.courseForm.value.nombre,
      precio: this.courseForm.value.precio,
      sku: this.courseForm.value.codigo,
      img: this.uploadedImageId
    };

    this.courseServices.updateCourse(this.courseData!.id, courseToUpdate).subscribe({
      next: (response) => {
        this.isSubmitting = false; // Desactivar estado de carga
        this.notificationService.showSuccess('Curso actualizado exitosamente', "");
        this.courseUpdated.emit();
        this.goBack.emit();
      },
      error: (error) => {
        this.isSubmitting = false; // Desactivar estado de carga en caso de error
        console.error('Error updating course:', error);
        this.notificationService.showError('Error al actualizar el curso');
      }
    });
  }

  private updateCourseWithoutNewImage(): void {
    const courseToUpdate = {
      nombre: this.courseForm.value.nombre,
      precio: this.courseForm.value.precio,
      sku: this.courseForm.value.codigo
    };

    this.courseServices.updateCourse(this.courseData!.id, courseToUpdate).subscribe({
      next: (response) => {
        this.isSubmitting = false; // Desactivar estado de carga
        this.notificationService.showSuccess('Curso actualizado exitosamente', "");
        this.courseUpdated.emit();
        this.goBack.emit();
      },
      error: (error) => {
        this.isSubmitting = false; // Desactivar estado de carga en caso de error
        console.error('Error updating course:', error);
        this.notificationService.showError('Error al actualizar el curso',"");
      }
    });
  }

  deleteCourse() {
    if (this.courseData?.id) {
      this.confirmationService.showDeleteConfirmation(
        this.courseData.nombre,
        'curso',
        () => {
          // Callback de confirmación
          this.courseServices.deleteCourse(this.courseData!.id).subscribe({
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
  // Métodos para manejo de archivos
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
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      this.notificationService.showError('Error', 'Por favor selecciona un archivo de imagen válido.');
      return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      this.notificationService.showError('Error', 'El archivo es demasiado grande. Tamaño máximo: 5MB.');
      return;
    }

    this.selectedFile = file;

    // Crear preview de la imagen
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagePreview = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Métodos para drag & drop
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

    // Limpiar el input file
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
    // Limpiar la imagen actual del curso
    if (this.courseData) {
      this.courseData.img_url = undefined;
    }
    // Permitir seleccionar una nueva imagen
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
          console.log('File uploaded successfully', response);
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
}
