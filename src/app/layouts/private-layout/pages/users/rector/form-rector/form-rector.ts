import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { UserService } from '../../../../../../core/services/user.service';
import { SchoolService } from '../../../../../../core/services/school.service';
import { School } from '../../../../../../core/models/School';
import { NotificationService } from '../../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../../core/services/confirmation.service';
import {User} from '../../../../../../core/models/User';
import { AppButtonComponent } from '../../../../../../components/app-button/app-button.component';

@Component({
  selector: 'app-form-rector',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AppButtonComponent
  ],
  templateUrl: './form-rector.html',
})
export class FormRector implements OnInit, OnChanges {
  @Input() editMode: boolean = false;
  @Input() rectorData: User | null = null;
  @Output() goBack = new EventEmitter();
  @Output() searchRector = new EventEmitter();
  @Output() rectorCreated = new EventEmitter<User>();
  @Output() rectorUpdated = new EventEmitter();
  rectorForm!: FormGroup;
  isSubmitting = false;
  showPassword = false;
  showConfirmPassword = false;
  schools: School[] = [];
  filteredSchools: School[] = [];
  isLoadingSchools = false;
  isSchoolSelected = false;
  isDeleting = false;
  private searchTimeout: any;

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
      schoolSearchTerm: [''],
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
      // Obtener el ID y nombre del colegio
      let schoolId = '';
      let schoolName = '';
      
      if (this.rectorData.colegio_id) {
        if (typeof this.rectorData.colegio_id === 'object') {
          schoolId = this.rectorData.colegio_id.id || '';
          schoolName = this.rectorData.colegio_id.nombre || '';
        } else {
          schoolId = this.rectorData.colegio_id;
          // Si es solo un ID, buscar el nombre en la lista de colegios
          const school = this.schools.find(s => s.id === schoolId);
          schoolName = school?.nombre || '';
        }
      }

      const patchData = {
        firstName: this.rectorData.first_name,
        lastName: this.rectorData.last_name,
        email: this.rectorData.email,
        celular: this.rectorData.celular,
        schoolId: schoolId,
        schoolSearchTerm: schoolName,
        password: '',
        confirmPassword: ''
      };
      this.rectorForm.patchValue(patchData);

      // Marcar como seleccionado si hay un colegio
      if (schoolName) {
        this.isSchoolSelected = true;
      }

      // Marcar como válido si estamos en modo edición
      if (this.editMode) {
        this.rectorForm.get('password')?.clearValidators();
        this.rectorForm.get('confirmPassword')?.clearValidators();
        this.rectorForm.get('password')?.updateValueAndValidity();
        this.rectorForm.get('confirmPassword')?.updateValueAndValidity();
      }
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
      next: (response): void => {
        this.notificationService.showSuccess('Éxito', 'Usuario creado exitosamente');
        this.rectorCreated.emit(response.data);
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

  onGoBack(): void {
    this.goBack.emit();
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

  onSchoolSearch(event: any): void {
    const searchTerm = event.target.value;
    this.rectorForm.get('schoolSearchTerm')?.setValue(searchTerm);
    this.isSchoolSelected = false; // Reset cuando el usuario empieza a escribir

    // Limpiar el timeout anterior
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Si el término está vacío, limpiar los resultados
    if (searchTerm.trim() === '') {
      this.filteredSchools = [];
      return;
    }

    // Debounce de 300ms para evitar demasiadas llamadas
    this.searchTimeout = setTimeout(() => {
      this.searchSchools(searchTerm);
    }, 300);
  }

  searchSchools(searchTerm: string): void {
    this.isLoadingSchools = true;
    this.schoolService.searchSchool(searchTerm, 1, 10).subscribe({
      next: (response) => {
        this.filteredSchools = response.data;
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
    this.rectorForm.get('schoolId')?.setValue(school.id);
    this.rectorForm.get('schoolSearchTerm')?.setValue(school.nombre);
    this.filteredSchools = [];
    this.isSchoolSelected = true;
  }

  clearSchoolSearch(): void {
    this.rectorForm.get('schoolSearchTerm')?.setValue('');
    this.filteredSchools = [];
    this.isSchoolSelected = false;
    this.rectorForm.get('schoolId')?.setValue('');
  }
}
