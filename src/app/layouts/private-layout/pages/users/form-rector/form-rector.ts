import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { UserService } from '../../../../../core/services/user.service';
import { SchoolService } from '../../../../../core/services/school.service';
import { School } from '../../../../../core/models/School';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import {User} from '../../../../../core/models/User';

@Component({
  selector: 'app-form-rector',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-rector.html',
})
export class FormRector implements OnInit, OnChanges {
  @Input() editMode: boolean = false;
  @Input() rectorData: User | null = null;
  @Output() goBack = new EventEmitter();
  @Output() searchRector = new EventEmitter();
  @Output() rectorUpdated = new EventEmitter();
  rectorForm!: FormGroup;
  isSubmitting = false;
  showPassword = false;
  showConfirmPassword = false;
  schools: School[] = [];
  isDeleting = false;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private schoolService: SchoolService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadSchools();
  }

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['editMode'] || changes['rectorData']) {

      this.initForm();

      if (this.editMode && this.rectorData) {
        setTimeout(() => {
          this.loadRectorData();
        }, 0);
      }
    }
  }

  initForm(): void {
    const passwordValidators = this.editMode ? [] : [Validators.required, Validators.minLength(6)];
    const confirmPasswordValidators = this.editMode ? [] : [Validators.required, this.passwordMatchValidator.bind(this)];

    this.rectorForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      celular: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      schoolId: ['', Validators.required],
      password: ['', passwordValidators],
      confirmPassword: ['', confirmPasswordValidators]
    });
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
      const schoolId = typeof this.rectorData.colegio_id === 'object' && this.rectorData.colegio_id !== null
        ? this.rectorData.colegio_id.id
        : this.rectorData.colegio_id;

      const patchData = {
        firstName: this.rectorData.first_name,
        lastName: this.rectorData.last_name,
        email: this.rectorData.email,
        celular: this.rectorData.celular,
        schoolId: schoolId,
        password: '',
        confirmPassword: ''
      };
      this.rectorForm.patchValue(patchData);
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
    const userData = {
      first_name: this.rectorForm.get('firstName')?.value,
      last_name: this.rectorForm.get('lastName')?.value,
      email: this.rectorForm.get('email')?.value,
      celular: this.rectorForm.get('celular')?.value,
      colegio_id: this.rectorForm.get('schoolId')?.value,
      password: this.rectorForm.get('password')?.value,
      role: 'a4ed6390-5421-46d1-b81e-5cad06115abc'
    };

    this.userService.createUser(userData).subscribe({
      next: (): void => {
        this.notificationService.showSuccess('Éxito', 'Usuario creado exitosamente');
        this.rectorUpdated.emit();
        this.isSubmitting = false;
      },
      error: (error): void => {
        if (error.error && error.error.errors) {
          const errorMessages = error.error.errors.map((err: any) => {
            const field = this.getFieldDisplayName(err.field);
            return `${field}: ${err.message}`;
          }).join('\n');
          this.notificationService.showError('Error', `Error al crear usuario:\n${errorMessages}`);
        } else {
          this.notificationService.showError('Error', 'Error al crear usuario. Por favor, inténtalo de nuevo.');
        }
        this.isSubmitting = false;
      }
    });
  }

  updateRector() {
    if (!this.rectorData?.id) return;

    const userData: any = {
      first_name: this.rectorForm.get('firstName')?.value,
      last_name: this.rectorForm.get('lastName')?.value,
      email: this.rectorForm.get('email')?.value,
      celular: this.rectorForm.get('celular')?.value,
      colegio_id: this.rectorForm.get('schoolId')?.value,
    };

    const password = this.rectorForm.get('password')?.value;
    if (password) {
      userData.password = password;
    }

    this.userService.updateUser(this.rectorData.id, userData).subscribe({
      next: (): void => {
        this.notificationService.showSuccess('Éxito', 'Usuario actualizado exitosamente');
        this.rectorUpdated.emit();
        this.isSubmitting = false;
      },
      error: (error): void => {
        if (error.error && error.error.errors) {
          const errorMessages = error.error.errors.map((err: any) => {
            const field = this.getFieldDisplayName(err.field);
            return `${field}: ${err.message}`;
          }).join('\n');
          this.notificationService.showError('Error', `Error al actualizar usuario:\n${errorMessages}`);
        } else {
          this.notificationService.showError('Error', 'Error al actualizar usuario. Por favor, inténtalo de nuevo.');
        }
        this.isSubmitting = false;
      }
    });
  }

  deleteRector(): void {
    if (this.rectorData?.id) {
      const userName = `${this.rectorData.first_name} ${this.rectorData.last_name}`;
      this.confirmationService.showDeleteConfirmation(
        userName,
        'usuario',
        () => {
          this.isDeleting = true;
          this.userService.deleteUser(this.rectorData!.id!).subscribe({
            next: () => {
              this.isDeleting = false;
              this.notificationService.showSuccess('Éxito', 'Usuario eliminado exitosamente');
              this.rectorUpdated.emit();
            },
            error: (error) => {
              this.isDeleting = false;
              this.notificationService.showError('Error', 'Error al eliminar el usuario');
            }
          });
        }
      );
    }
  }

  private getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      'first_name': 'Nombre',
      'last_name': 'Apellido',
      'email': 'Correo electrónico',
      'celular': 'Celular',
      'colegio_id': 'Colegio',
      'password': 'Contraseña'
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
    if (!control || !control.parent) {
      return null;
    }

    const password = control.parent.get('password');
    const confirmPassword = control.parent.get('confirmPassword');

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