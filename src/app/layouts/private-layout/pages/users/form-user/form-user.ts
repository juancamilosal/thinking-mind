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
    this.userForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      celular: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      schoolId: [''],
      schoolSearchTerm: [''],
      password: ['', this.editMode ? [] : [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', this.editMode ? [] : [Validators.required]]
    }, { validators: this.passwordMatchValidator });

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
    this.isLoadingSchools = true;
    this.schoolService.getAllSchools().subscribe({
      next: (response) => {
        this.schools = response.data || [];
        this.filteredSchools = this.schools;
        this.isLoadingSchools = false;
      },
      error: (error) => {
        console.error('Error loading schools:', error);
        this.isLoadingSchools = false;
      }
    });
  }

  onSchoolSearch(): void {
    const searchTerm = this.userForm.get('schoolSearchTerm')?.value?.toLowerCase() || '';
    
    if (searchTerm.trim() === '') {
      this.filteredSchools = this.schools;
      return;
    }

    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.filteredSchools = this.schools.filter(school =>
        school.nombre.toLowerCase().includes(searchTerm) ||
        school.ciudad.toLowerCase().includes(searchTerm)
      );
    }, 300);
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
    this.filteredSchools = this.schools;
  }

  private passwordMatchValidator(control: AbstractControl): { [key: string]: any } | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
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
        celular: this.userData.celular
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
    if (this.userForm.valid) {
      this.isSubmitting = true;
      this.errorMessage = '';

      if (this.editMode) {
        this.updateUser();
      } else {
        this.createUser();
      }
    }
  }

  private createUser(): void {
    const userData: any = {
      first_name: this.userForm.get('firstName')?.value,
      last_name: this.userForm.get('lastName')?.value,
      email: this.userForm.get('email')?.value,
      celular: this.userForm.get('celular')?.value,
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

    const userData: any = {
      first_name: this.userForm.get('firstName')?.value,
      last_name: this.userForm.get('lastName')?.value,
      email: this.userForm.get('email')?.value,
      celular: this.userForm.get('celular')?.value
    };

    // Solo agregar colegio_id si se seleccionó uno
    const schoolId = this.userForm.get('schoolId')?.value;
    if (schoolId) {
      userData.colegio_id = schoolId;
    }

    // Solo agregar password si se proporcionó
    const password = this.userForm.get('password')?.value;
    if (password) {
      userData.password = password;
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
  get celular() { return this.userForm.get('celular'); }
  get schoolId() { return this.userForm.get('schoolId'); }
  get password() { return this.userForm.get('password'); }
  get confirmPassword() { return this.userForm.get('confirmPassword'); }
}