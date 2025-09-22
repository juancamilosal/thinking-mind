import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { UserService } from '../../../../../../core/services/user.service';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { User } from '../../../../../../core/models/User';

@Component({
  selector: 'app-form-admin',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-admin.html'
})
export class FormAdmin implements OnInit {
  @Input() editMode: boolean = false;
  @Input() adminData: User | null = null;
  @Output() adminCreated = new EventEmitter<User>();
  @Output() adminUpdated = new EventEmitter<User>();
  @Output() adminDeleted = new EventEmitter<User>();
  @Output() cancel = new EventEmitter<void>();

  adminForm!: FormGroup;
  isSubmitting = false;
  showPassword = false;
  showConfirmPassword = false;
  errorMessage = '';
  showDeleteModal = false;
  isDeleting = false;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private notificationService: NotificationService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    if (this.editMode && this.adminData) {
      this.loadAdminData();
    }
  }

  private initializeForm(): void {
    this.adminForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      celular: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      password: ['', this.editMode ? [] : [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', this.editMode ? [] : [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private loadAdminData(): void {
    if (this.adminData) {
      this.adminForm.patchValue({
        firstName: this.adminData.first_name,
        lastName: this.adminData.last_name,
        email: this.adminData.email,
        celular: this.adminData.celular
      });

      // En modo edición, hacer los campos de contraseña opcionales
      this.adminForm.get('password')?.clearValidators();
      this.adminForm.get('confirmPassword')?.clearValidators();
      this.adminForm.get('password')?.updateValueAndValidity();
      this.adminForm.get('confirmPassword')?.updateValueAndValidity();
    }
  }

  onSubmit(): void {
    if (this.adminForm.valid) {
      this.isSubmitting = true;
      this.errorMessage = '';

      if (this.editMode) {
        this.updateAdmin();
      } else {
        this.createAdmin();
      }
    }
  }

  private createAdmin(): void {
    const adminData = {
      first_name: this.adminForm.get('firstName')?.value,
      last_name: this.adminForm.get('lastName')?.value,
      email: this.adminForm.get('email')?.value,
      celular: this.adminForm.get('celular')?.value,
      password: this.adminForm.get('password')?.value,
      role: 'ca89252c-6b5c-4f51-a6e4-34ab4d0e2a02' // UUID fijo para administrador
    };

    this.userService.createUser(adminData).subscribe({
      next: (response) => {
        this.notificationService.showSuccess('Éxito', 'Administrador creado exitosamente');
        this.adminCreated.emit(response.data);
        this.resetForm();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error creating admin:', error);
        this.errorMessage = 'Error al crear el administrador. Por favor, intente nuevamente.';
        this.notificationService.showError('Error al crear el administrador');
        this.isSubmitting = false;
      }
    });
  }

  private updateAdmin(): void {
    if (!this.adminData?.id) return;

    const updateData: any = {
      first_name: this.adminForm.get('firstName')?.value,
      last_name: this.adminForm.get('lastName')?.value,
      email: this.adminForm.get('email')?.value,
      celular: this.adminForm.get('celular')?.value
    };

    // Solo incluir contraseña si se proporcionó
    const password = this.adminForm.get('password')?.value;
    if (password && password.trim() !== '') {
      updateData.password = password;
    }

    this.userService.updateUser(this.adminData.id, updateData).subscribe({
      next: (response) => {
        this.notificationService.showSuccess('Éxito', 'Administrador actualizado exitosamente');
        this.adminUpdated.emit(response.data);
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error updating admin:', error);
        this.errorMessage = 'Error al actualizar el administrador. Por favor, intente nuevamente.';
        this.notificationService.showError('Error al actualizar el administrador');
        this.isSubmitting = false;
      }
    });
  }

  deleteAdmin(): void {
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (!this.adminData?.id) return;

    this.isDeleting = true;
    this.userService.deleteUser(this.adminData.id).subscribe({
      next: () => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.notificationService.showSuccess('Éxito', 'Administrador eliminado exitosamente');
        this.adminDeleted.emit(this.adminData!);
      },
      error: (error) => {
        this.isDeleting = false;
        console.error('Error deleting admin:', error);
        this.notificationService.showError('Error al eliminar el administrador');
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
  }

  private resetForm(): void {
    this.adminForm.reset();
    this.errorMessage = '';
  }

  onCancel(): void {
    this.cancel.emit();
    this.resetForm();
  }

  // Utility methods
  getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      firstName: 'Nombre',
      lastName: 'Apellido',
      email: 'Email',
      celular: 'Celular',
      password: 'Contraseña',
      confirmPassword: 'Confirmar Contraseña'
    };
    return fieldNames[fieldName] || fieldName;
  }

  onFirstNameChange(event: any): void {
    const value = event.target.value;
    event.target.value = this.capitalizeText(value);
    this.adminForm.get('firstName')?.setValue(event.target.value);
  }

  onLastNameChange(event: any): void {
    const value = event.target.value;
    event.target.value = this.capitalizeText(value);
    this.adminForm.get('lastName')?.setValue(event.target.value);
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

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  // Custom validator for password matching
  passwordMatchValidator(control: AbstractControl): { [key: string]: any } | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    if (password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }

    return null;
  }
}
