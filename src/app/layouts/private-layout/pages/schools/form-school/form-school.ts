import {Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {SchoolService} from '../../../../../core/services/school.service';
import {School} from '../../../../../core/models/School';
import {NotificationService} from '../../../../../core/services/notification.service';

@Component({
  selector: 'app-form-school',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-school.html',
  styleUrl: './form-school.css'
})
export class FormSchool implements OnInit, OnChanges {

  @Input() editMode: boolean = false;
  @Input() schoolData: School | null = null;
  @Output() goBack = new EventEmitter();
  @Output() searchSchool = new EventEmitter();
  @Output() schoolUpdated = new EventEmitter();
  @Output() schoolDeleted = new EventEmitter();
  schoolForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private schoolServices: SchoolService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['schoolData'] && this.schoolData && this.editMode) {
      this.loadSchoolData();
    }
  }

  initForm(): void {
    this.schoolForm = this.fb.group({
      schoolName: ['', Validators.required],
      city: ['', Validators.required],
      address: ['', Validators.required],
      principalName: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]]
    });
  }

  loadSchoolData(): void {
    if (this.schoolData) {
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
    const school = {
      nombre: this.schoolForm.get('schoolName')?.value,
      ciudad: this.schoolForm.get('city')?.value,
      direccion: this.schoolForm.get('address')?.value,
      nombre_rector: this.schoolForm.get('principalName')?.value,
      celular: this.schoolForm.get('phoneNumber')?.value,
    }

    this.schoolServices.createSchool(school).subscribe({
      next: (): void => {
        const schoolName = `${school.nombre}`;
        this.notificationService.showSuccess('Colegio creado', `El colegio ${schoolName} ha sido creado exitosamente.`);
        this.goBack.emit();
        this.searchSchool.emit();
      },
      error: (error): void => {
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
    const school = {
      id: this.schoolData?.id,
      nombre: this.schoolForm.get('schoolName')?.value,
      ciudad: this.schoolForm.get('city')?.value,
      direccion: this.schoolForm.get('address')?.value,
      nombre_rector: this.schoolForm.get('principalName')?.value,
      celular: this.schoolForm.get('phoneNumber')?.value,
    }
  }
}
