import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RectorService } from '../../../../../core/services/rector.service';
import { SchoolService } from '../../../../../core/services/school.service';
import { Rector } from '../../../../../core/models/Rector';
import { School } from '../../../../../core/models/School';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';

@Component({
  selector: 'app-form-rector',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-rector.html',
})
export class FormRector implements OnInit, OnChanges {
  @Input() editMode: boolean = false;
  @Input() rectorData: Rector | null = null;
  @Output() goBack = new EventEmitter();
  @Output() searchRector = new EventEmitter();
  @Output() rectorUpdated = new EventEmitter();
  rectorForm!: FormGroup;
  isSubmitting = false;
  schools: School[] = [];
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private rectorService: RectorService,
    private schoolService: SchoolService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSchools();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rectorData'] && this.rectorForm) {
      if (this.editMode && this.rectorData) {
        this.loadRectorData();
      } else {
        this.rectorForm.reset();
      }
    }
  }

  initForm(): void {
    this.rectorForm = this.fb.group({
      firstName: [null, Validators.required],
      lastName: [null, Validators.required],
      phoneNumber: [null, [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      email: [null, [Validators.required, Validators.email]],
      schoolId: [null, Validators.required],
      role:[],
      password: [null, [Validators.required, Validators.minLength(6)]],
      confirmPassword: [null, Validators.required]
    }, { validators: this.passwordMatchValidator });

    if (this.editMode && this.rectorData) {
      this.loadRectorData();
    }
  }

  loadSchools(): void {
    this.schoolService.getAllSchools().subscribe({
      next: (response) => {
        this.schools = response.data;
      },
      error: (error) => {
        this.notificationService.showError('Error', 'Error al cargar los colegios');
      }
    });
  }

  loadRectorData(): void {
    if (this.rectorData) {
      this.rectorForm.patchValue({
        firstName: this.rectorData.nombre,
        lastName: this.rectorData.apellido,
        phoneNumber: this.rectorData.celular,
        email: this.rectorData.email,
        schoolId: this.rectorData.colegio_id,
        password: '',
        confirmPassword: ''
      });
    }
  }

  onSubmit(): void {
    if (this.rectorForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      if (this.editMode) {
        this.updateRector();
      } else {
        this.createRector();
      }
    } else {
      this.markFormGroupTouched(this.rectorForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  createRector() {
    const rector = {
      nombre: this.rectorForm.get('firstName')?.value,
      apellido: this.rectorForm.get('lastName')?.value,
      celular: this.rectorForm.get('phoneNumber')?.value,
      email: this.rectorForm.get('email')?.value,
      colegio_id: this.rectorForm.get('schoolId')?.value,
      password: this.rectorForm.get('password')?.value,
    };

    this.rectorService.crearRector(rector).subscribe({
      next: (): void => {
        this.notificationService.showSuccess('Éxito', 'Rector creado exitosamente');
        this.rectorUpdated.emit();
        this.isSubmitting = false;
      },
      error: (error): void => {
        if (error.error && error.error.errors) {
          const errorMessages = error.error.errors.map((err: any) => {
            const field = this.getFieldDisplayName(err.field);
            return `${field}: ${err.message}`;
          }).join('\n');
          this.notificationService.showError('Error', `Error al crear rector:\n${errorMessages}`);
        } else {
          this.notificationService.showError('Error', 'Error al crear rector. Por favor, inténtalo de nuevo.');
        }
        this.isSubmitting = false;
      }
    });
  }

  updateRector() {
    if (!this.rectorData?.id) return;

    const rector = {
      nombre: this.rectorForm.get('firstName')?.value,
      apellido: this.rectorForm.get('lastName')?.value,
      celular: this.rectorForm.get('phoneNumber')?.value,
      email: this.rectorForm.get('email')?.value,
      colegio_id: this.rectorForm.get('schoolId')?.value,
    };

    this.rectorService.updateRector(this.rectorData.id, rector).subscribe({
      next: (): void => {
        this.notificationService.showSuccess('Éxito', 'Rector actualizado exitosamente');
        this.rectorUpdated.emit();
        this.isSubmitting = false;
      },
      error: (error): void => {
        if (error.error && error.error.errors) {
          const errorMessages = error.error.errors.map((err: any) => {
            const field = this.getFieldDisplayName(err.field);
            return `${field}: ${err.message}`;
          }).join('\n');
          this.notificationService.showError('Error', `Error al actualizar rector:\n${errorMessages}`);
        } else {
          this.notificationService.showError('Error', 'Error al actualizar rector. Por favor, inténtalo de nuevo.');
        }
        this.isSubmitting = false;
      }
    });
  }

  deleteRector(): void {
    if (this.rectorData?.id) {
      const rectorName = `${this.rectorData.nombre} ${this.rectorData.apellido}`;
      this.confirmationService.showDeleteConfirmation(
        rectorName,
        'rector',
        () => {
          this.rectorService.deleteRector(this.rectorData!.id!).subscribe({
            next: () => {
              this.notificationService.showSuccess('Éxito', 'Rector eliminado exitosamente');
              this.rectorUpdated.emit();
            },
            error: (error) => {
              this.notificationService.showError('Error', 'Error al eliminar el rector');
            }
          });
        }
      );
    }
  }

  private getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      'nombre': 'Nombre',
      'apellido': 'Apellido',
      'numero_contacto': 'Número de Contacto',
      'email': 'Email',
      'colegio_id': 'Colegio'
    };
    return fieldNames[fieldName] || fieldName;
  }

  capitalizeText(text: string): string {
    if (!text) return '';
    return text.toLowerCase().split(' ').map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  onFirstNameChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.rectorForm.get('firstName')?.setValue(value);
  }

  onLastNameChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.rectorForm.get('lastName')?.setValue(value);
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
