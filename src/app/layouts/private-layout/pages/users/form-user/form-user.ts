import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { UserService } from '../../../../../core/services/user.service';
import { SchoolService } from '../../../../../core/services/school.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { User } from '../../../../../core/models/User';
import { School } from '../../../../../core/models/School';
import { Role } from '../../../../../core/services/role.service';

@Component({
  selector: 'app-form-user',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './form-user.html'
})
export class FormUser implements OnInit {
  @Input() editMode: boolean = false;
  @Input() userData: User | null = null;
  @Input() selectedRole: Role | null = null;
  @Output() userCreated = new EventEmitter<User>();
  @Output() userUpdated = new EventEmitter<User>();
  @Output() userDeleted = new EventEmitter<User>();
  @Output() cancel = new EventEmitter<void>();

  userForm!: FormGroup;
  isSubmitting = false;
  showPassword = false;
  showConfirmPassword = false;
  errorMessage = '';
  showDeleteModal = false;
  isDeleting = false;
  schools: School[] = [];
  filteredSchools: School[] = [];
  isLoadingSchools = false;
  isSchoolSelected = false;
  private searchTimeout: any;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private schoolService: SchoolService,
    private notificationService: NotificationService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadSchools();
    if (this.editMode && this.userData) {
      this.loadUserData();
    }
  }

  private initializeForm(): void {
    // Definir validadores según el modo
    const requiredValidators = this.editMode ? [] : [Validators.required];
    const emailValidators = this.editMode ? [Validators.email] : [Validators.required, Validators.email];
    const phoneValidators = this.editMode ? [Validators.pattern(/^[0-9]{10}$/)] : [Validators.required, Validators.pattern(/^[0-9]{10}$/)];
    const passwordValidators = this.editMode ? [Validators.minLength(6)] : [Validators.required, Validators.minLength(6)];

    this.userForm = this.fb.group({
      firstName: ['', requiredValidators],
      lastName: ['', requiredValidators],
      email: ['', emailValidators],
      phone: ['', phoneValidators],
      schoolId: [''],
      schoolSearchTerm: [''],
      password: ['', passwordValidators],
      confirmPassword: ['', this.editMode ? [] : [Validators.required]]
    }, { validators: this.createPasswordMatchValidator() });

    // Hacer el campo de colegio requerido solo para ciertos roles
    this.updateSchoolValidation();
  }

  private updateSchoolValidation(): void {
    const schoolControl = this.userForm.get('schoolId');
    if (this.selectedRole?.name?.toLowerCase().includes('rector') || 
        this.selectedRole?.name?.toLowerCase().includes('director')) {
      schoolControl?.setValidators([Validators.required]);
    } else {
      schoolControl?.clearValidators();
    }
    schoolControl?.updateValueAndValidity();
  }

  private loadSchools(): void {
    // Ya no necesitamos cargar todos los colegios al inicio
    // La búsqueda se hará dinámicamente cuando el usuario escriba
    this.isLoadingSchools = false;
  }

  onSchoolSearch(): void {
    const searchTerm = this.userForm.get('schoolSearchTerm')?.value || '';
    this.isSchoolSelected = false;
    // Limpiar el valor de colegio seleccionado mientras escribe
    this.userForm.get('schoolId')?.setValue('');

    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) {
      this.filteredSchools = [];
      this.isLoadingSchools = false;
      return;
    }

    // Buscar inmediatamente para evitar demoras por timers
    this.searchSchools(trimmed);
  }

  private searchSchools(searchTerm: string): void {
    this.isLoadingSchools = true;
    this.schoolService.searchSchool(searchTerm, 1, 10).subscribe({
      next: (response) => {
        this.filteredSchools = response.data || [];
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
    this.userForm.patchValue({
      schoolId: school.id,
      schoolSearchTerm: `${school.nombre} (${school.ciudad})`
    });
    this.isSchoolSelected = true;
    this.filteredSchools = [];
  }

  clearSchoolSelection(): void {
    this.userForm.patchValue({
      schoolId: '',
      schoolSearchTerm: ''
    });
    this.isSchoolSelected = false;
    this.filteredSchools = [];
  }

  private createPasswordMatchValidator() {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const password = control.get('password');
      const confirmPassword = control.get('confirmPassword');
      
      // Solo validar si ambos campos tienen valores
      if (password?.value && confirmPassword?.value && password.value !== confirmPassword.value) {
        return { passwordMismatch: true };
      }
      
      // En modo edición, si solo uno de los campos tiene valor, es un error
      if (this.editMode && ((password?.value && !confirmPassword?.value) || (!password?.value && confirmPassword?.value))) {
        return { passwordMismatch: true };
      }
      
      return null;
    };
  }

  private passwordMatchValidator(control: AbstractControl): { [key: string]: any } | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    // Solo validar si ambos campos tienen valores
    if (password?.value && confirmPassword?.value && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }
    
    return null;
  }

  private loadUserData(): void {
    if (this.userData) {
      this.userForm.patchValue({
        firstName: this.userData.first_name,
        lastName: this.userData.last_name,
        email: this.userData.email,
        phone: this.userData.celular
      });

      if (this.userData.colegio_id) {
        const school = this.schools.find(s => s.id === this.userData!.colegio_id.id);
        if (school) {
          this.selectSchool(school);
        }
      }
    }
  }

  onSubmit(): void {
    // En modo edición, permitir envío incluso si el formulario no es válido
    // En modo creación, requerir que el formulario sea válido
    if (!this.editMode && this.userForm.invalid) {
      this.errorMessage = 'Por favor, complete todos los campos requeridos.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    if (this.editMode) {
      this.updateUser();
    } else {
      this.createUser();
    }
  }

  private createUser(): void {
    const userData: any = {
      first_name: this.userForm.get('firstName')?.value,
      last_name: this.userForm.get('lastName')?.value,
      email: this.userForm.get('email')?.value,
      celular: this.userForm.get('phone')?.value,
      password: this.userForm.get('password')?.value,
      role: this.selectedRole?.id
    };

    // Solo agregar colegio_id si se seleccionó uno
    const schoolId = this.userForm.get('schoolId')?.value;
    if (schoolId) {
      userData.colegio_id = schoolId;
    }

    this.userService.createUser(userData).subscribe({
      next: (response) => {
        this.notificationService.showSuccess('Éxito', `${this.selectedRole?.name || 'Usuario'} creado exitosamente`);
        this.userCreated.emit(response.data);
        this.resetForm();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error creating user:', error);
        this.errorMessage = `Error al crear el ${this.selectedRole?.name?.toLowerCase() || 'usuario'}. Por favor, intente nuevamente.`;
        this.notificationService.showError('Error', this.errorMessage);
        this.isSubmitting = false;
      }
    });
  }

  private updateUser(): void {
    if (!this.userData?.id) return;

    const userData: any = {};

    // Solo agregar campos que tengan valores
    const firstName = this.userForm.get('firstName')?.value?.trim();
    if (firstName) {
      userData.first_name = firstName;
    }

    const lastName = this.userForm.get('lastName')?.value?.trim();
    if (lastName) {
      userData.last_name = lastName;
    }

    const email = this.userForm.get('email')?.value?.trim();
    if (email) {
      userData.email = email;
    }

    const phone = this.userForm.get('phone')?.value?.trim();
    if (phone) {
      userData.celular = phone;
    }

    // Solo agregar colegio_id si se seleccionó uno
    const schoolId = this.userForm.get('schoolId')?.value;
    if (schoolId) {
      userData.colegio_id = schoolId;
    }

    // Solo agregar password si se proporcionó
    const password = this.userForm.get('password')?.value?.trim();
    if (password) {
      userData.password = password;
    }

    // Verificar que al menos un campo tenga valor
    if (Object.keys(userData).length === 0) {
      this.errorMessage = 'Debe proporcionar al menos un campo para actualizar.';
      this.notificationService.showError('Error', this.errorMessage);
      this.isSubmitting = false;
      return;
    }

    this.userService.updateUser(this.userData.id, userData).subscribe({
      next: (response) => {
        this.notificationService.showSuccess('Éxito', `${this.selectedRole?.name || 'Usuario'} actualizado exitosamente`);
        this.userUpdated.emit(response.data);
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error updating user:', error);
        this.errorMessage = `Error al actualizar el ${this.selectedRole?.name?.toLowerCase() || 'usuario'}. Por favor, intente nuevamente.`;
        this.notificationService.showError('Error', this.errorMessage);
        this.isSubmitting = false;
      }
    });
  }

  deleteUser(): void {
    if (this.userData?.id) {
      this.showDeleteModal = true;
    }
  }

  confirmDelete(): void {
    if (this.userData?.id) {
      this.isDeleting = true;
      this.userService.deleteUser(this.userData.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Éxito', `${this.selectedRole?.name || 'Usuario'} eliminado exitosamente`);
          this.userDeleted.emit(this.userData!);
          this.isDeleting = false;
          this.showDeleteModal = false;
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          this.notificationService.showError('Error', `Error al eliminar el ${this.selectedRole?.name?.toLowerCase() || 'usuario'}`);
          this.isDeleting = false;
        }
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
  }

  onCancel(): void {
    this.cancel.emit();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onFirstNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const capitalizedValue = this.capitalizeWords(input.value);
    this.userForm.get('firstName')?.setValue(capitalizedValue, { emitEvent: false });
    input.value = capitalizedValue;
  }

  onLastNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const capitalizedValue = this.capitalizeWords(input.value);
    this.userForm.get('lastName')?.setValue(capitalizedValue, { emitEvent: false });
    input.value = capitalizedValue;
  }

  private capitalizeWords(text: string): string {
    if (!text) return text;
    
    return text
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  private resetForm(): void {
    this.userForm.reset();
    this.isSchoolSelected = false;
    this.filteredSchools = this.schools;
    this.errorMessage = '';
  }

  // Getters para validación
  get firstName() { return this.userForm.get('firstName'); }
  get lastName() { return this.userForm.get('lastName'); }
  get email() { return this.userForm.get('email'); }
  get phone() { return this.userForm.get('phone'); }
  get schoolId() { return this.userForm.get('schoolId'); }
  get password() { return this.userForm.get('password'); }
  get confirmPassword() { return this.userForm.get('confirmPassword'); }
}