import {Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {SchoolService} from '../../../../../core/services/school.service';
import {School} from '../../../../../core/models/School';
import {NotificationService} from '../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';

@Component({
  selector: 'app-form-school',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-school.html',
})
export class FormSchool implements OnInit, OnChanges {

  @Input() editMode: boolean = false;
  @Input() schoolData: School | null = null;
  @Output() goBack = new EventEmitter();
  @Output() searchSchool = new EventEmitter();
  @Output() schoolUpdated = new EventEmitter();
  @Output() schoolDeleted = new EventEmitter();
  schoolForm!: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private schoolServices: SchoolService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.initForm();
    // Si ya tenemos datos del colegio y estamos en modo edición, cargarlos
    if (this.schoolData && this.editMode) {
      this.loadSchoolData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editMode']) {
      if (this.schoolForm) {
        if (this.editMode && this.schoolData) {
          this.loadSchoolData();
        } else if (!this.editMode) {
          // Resetear formulario cuando no está en modo edición
          this.schoolForm.reset();
        }
      }
    }
    
    if (changes['schoolData'] && this.schoolData && this.editMode) {
      // Si el formulario no está inicializado aún, esperamos a que se inicialice
      if (this.schoolForm) {
        this.loadSchoolData();
      } else {
        // Si el formulario no está listo, lo haremos en ngOnInit
        setTimeout(() => this.loadSchoolData(), 0);
      }
    }
  }

  initForm(): void {
    this.schoolForm = this.fb.group({
      schoolName: [null, Validators.required],
      city: [null, Validators.required],
      address: [null, Validators.required],
      principalName: [null, Validators.required],
      phoneNumber: [null, [Validators.required, Validators.pattern('^[0-9]{10}$')]]
    });
  }

  loadSchoolData(): void {
    if (this.schoolData && this.schoolForm) {
      this.schoolForm.patchValue({
        schoolName: this.schoolData.nombre,
        city: this.schoolData.ciudad,
        address: this.schoolData.direccion,
        principalName: this.schoolData.nombre_rector,
        phoneNumber: this.schoolData.celular
      });
    }
  }

  onSubmit(): void {
    if (this.schoolForm.valid) {
      if (this.editMode) {
        this.updateSchool();
      } else {
        this.createSchool();
      }
    } else {
      this.markFormGroupTouched(this.schoolForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  createSchool = (): void => {
    this.isSubmitting = true;
    const school = {
      nombre: this.schoolForm.get('schoolName')?.value,
      ciudad: this.schoolForm.get('city')?.value,
      direccion: this.schoolForm.get('address')?.value,
      nombre_rector: this.schoolForm.get('principalName')?.value,
      celular: this.schoolForm.get('phoneNumber')?.value,
    }

    this.schoolServices.createSchool(school).subscribe({
      next: (): void => {
        this.isSubmitting = false;
        const schoolName = `${school.nombre}`;
        this.notificationService.showSuccess('Colegio creado', `El colegio ${schoolName} ha sido creado exitosamente.`);
        this.goBack.emit();
        this.searchSchool.emit();
      },
      error: (error): void => {
        this.isSubmitting = false;
        const errorArray = error.errors || error.error;
        if (errorArray && Array.isArray(errorArray) && errorArray.length > 0) {
          const directusError = errorArray[0];
          if (directusError.extensions && directusError.extensions.code === 'RECORD_NOT_UNIQUE') {
            const duplicateValue = directusError.extensions.value;
            this.notificationService.showError('Colegio ya se encuentra creado', `Ya existe un colegio registrado con el nombre ${duplicateValue}.`);
            return;
          }
        }
        if (error.status === 400) {
          this.notificationService.showError('Colegio ya se encuentra creado', `Ya existe un colegio registrado con el nombre ${school.nombre}.`);
        } else if (error.status === 409) {
          this.notificationService.showError('Colegio ya se encuentra creado', `Ya existe un colegio registrado con el nombre ${school.nombre}.`);
        } else if (error.status >= 500) {
          this.notificationService.showServerError();
        } else {
          this.notificationService.showError('Error', 'No se pudo crear el colegio. Inténtalo nuevamente.');
        }
      }
    });
  }

  updateSchool = (): void => {
    this.isSubmitting = true;
    const school = {
      id: this.schoolData?.id,
      nombre: this.schoolForm.get('schoolName')?.value,
      ciudad: this.schoolForm.get('city')?.value,
      direccion: this.schoolForm.get('address')?.value,
      nombre_rector: this.schoolForm.get('principalName')?.value,
      celular: this.schoolForm.get('phoneNumber')?.value,
    }

    this.schoolServices.updateSchool(school.id!, school).subscribe({
      next: (): void => {
        this.isSubmitting = false;
        const schoolName = `${school.nombre}`;
        this.notificationService.showSuccess('Colegio actualizado', `El colegio ${schoolName} ha sido actualizado exitosamente.`);
        this.schoolUpdated.emit();
      },
      error: (error): void => {
        this.isSubmitting = false;
        const errorArray = error.errors || error.error;
        if (errorArray && Array.isArray(errorArray) && errorArray.length > 0) {
          const directusError = errorArray[0];
          if (directusError.extensions && directusError.extensions.code === 'RECORD_NOT_UNIQUE') {
            const duplicateValue = directusError.extensions.value;
            this.notificationService.showError('Colegio ya se encuentra registrado', `Ya existe un colegio registrado con el nombre ${duplicateValue}.`);
            return;
          }
        }
        if (error.status === 400) {
          this.notificationService.showError('Colegio ya se encuentra registrado', `Ya existe un colegio registrado con el nombre ${school.nombre}.`);
        } else if (error.status === 409) {
          this.notificationService.showError('Colegio ya se encuentra registrado', `Ya existe un colegio registrado con el nombre ${school.nombre}.`);
        } else if (error.status >= 500) {
          this.notificationService.showServerError();
        } else {
          this.notificationService.showError('Error', 'No se pudo actualizar el colegio. Inténtalo nuevamente.');
        }
      }
    });
  }

  capitalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  onSchoolNameChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.schoolForm.get('schoolName')?.setValue(capitalizedValue, { emitEvent: false });
  }

  onCityNameChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.schoolForm.get('city')?.setValue(capitalizedValue, { emitEvent: false });
  }

  onPrincipalNameChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.schoolForm.get('principalName')?.setValue(capitalizedValue, { emitEvent: false });
  }

  onAddressChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.schoolForm.get('address')?.setValue(capitalizedValue, { emitEvent: false });
  }

  deleteSchool(): void {
    if (this.schoolData?.id) {
      const schoolName = this.schoolData.nombre;
      this.confirmationService.showDeleteConfirmation(
        schoolName,
        'colegio',
        () => {
          this.schoolServices.deleteSchool(this.schoolData!.id).subscribe({
            next: (response) => {
              this.notificationService.showSuccess(
                'Colegio eliminado',
                `${schoolName} ha sido eliminado exitosamente.`
              );
              this.schoolDeleted.emit();
            },
            error: (error) => {
              // Verificar si es un error 500 que indica relaciones activas
              if (error.status === 500) {
                this.notificationService.showError(
                  'No se puede eliminar el colegio',
                  `No se puede eliminar ${schoolName} porque tiene estudiantes asociados. Debe eliminar o transferir los estudiantes antes de eliminar el colegio.`
                );
              } else {
                this.notificationService.showError(
                  'Error al eliminar',
                  'No se pudo eliminar el colegio. Inténtalo nuevamente.'
                );
              }
            }
          });
        }
      );
    }
  }

}
