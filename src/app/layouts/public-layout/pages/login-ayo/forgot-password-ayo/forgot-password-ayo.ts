import { Component, EventEmitter, Output, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DOCUMENT_TYPE } from '../../../../../core/const/DocumentTypeConst';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { NotificationService } from '../../../../../core/services/notification.service';

@Component({
  selector: 'app-forgot-password-ayo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password-ayo.html',
  styleUrls: ['./forgot-password-ayo.css']
})
export class ForgotPasswordAyoComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  
  forgotPasswordForm!: FormGroup;
  resetPasswordForm!: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;
  isLoading = false;
  
  students: any[] = [];
  selectedStudent: any = null;
  showStudentsList = false;
  showRegistrationCode = false;
  showResetPassword = false;

  currentStep = 1; // 1: Search, 2: Select/Validate, 3: Reset
  rawResponse: any = null; // For debugging

  constructor(
    private fb: FormBuilder,
    private programaAyoService: ProgramaAyoService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.forgotPasswordForm = this.fb.group({
      tipoDocumento: ['', Validators.required],
      numeroDocumento: ['', Validators.required]
    });

    this.resetPasswordForm = this.fb.group({
      registrationCode: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    return password && confirmPassword && password.value === confirmPassword.value ? null : { mismatch: true };
  }

  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }
    
    this.isLoading = true;
    this.students = [];
    this.selectedStudent = null;
    this.showRegistrationCode = false;

    const { tipoDocumento, numeroDocumento } = this.forgotPasswordForm.value;

    this.programaAyoService.consultarAcudiente(tipoDocumento, numeroDocumento).subscribe({
      next: (response) => {
        console.log('Respuesta del servicio RAW:', response);
        this.rawResponse = response;
        this.isLoading = false;
        
        let allStudents: any[] = [];

        // Estrategia 1: Respuesta es un array de Acudientes (como indicó el usuario)
        if (Array.isArray(response)) {
            response.forEach((item: any) => {
                if (item.estudiantes && Array.isArray(item.estudiantes)) {
                    allStudents.push(...item.estudiantes);
                }
            });
        } 
        // Estrategia 2: Respuesta tiene propiedad 'data' que es array
        else if (response && response.data && Array.isArray(response.data)) {
            response.data.forEach((item: any) => {
                if (item.estudiantes && Array.isArray(item.estudiantes)) {
                    allStudents.push(...item.estudiantes);
                }
            });
        }
        // Estrategia 3: Respuesta es un objeto único con estudiantes
        else if (response && response.estudiantes && Array.isArray(response.estudiantes)) {
            allStudents.push(...response.estudiantes);
        }

        console.log('Todos los estudiantes encontrados (sin filtro):', allStudents);
        
        // Aplicar filtro de estudiante_ayo (manejo robusto de true/string/1)
        this.students = allStudents.filter((student: any) => {
            // Log for debugging
            console.log('Checking student:', student);
            const esAyo = student.estudiante_ayo;
            // Check for string "true", boolean true, number 1, or even string "1"
            return String(esAyo).toLowerCase() === 'true' || esAyo === 1 || esAyo === true;
        });

        console.log('Estudiantes AYO filtrados:', this.students);
        
        if (this.students.length > 0) {
            console.log('Cambiando a paso 2...');
            this.currentStep = 2; // Move to Step 2
            this.ngZone.run(() => {
                this.notificationService.showSuccess('Éxito', 'Estudiantes encontrados. Por favor seleccione uno.');
            });
            this.cdr.detectChanges(); // Force change detection
        } else {
            // DEBUG: Show raw students if none match filter, just to verify data presence
            if (allStudents.length > 0) {
                this.ngZone.run(() => {
                    this.notificationService.showWarning('Atención', 'Se encontraron estudiantes pero ninguno pertenece al programa AYO (estudiante_ayo != true).');
                });
                // OPTIONAL: Force show all students for debugging if desired, uncomment next line
                // this.students = allStudents; this.currentStep = 2; 
            } else {
                this.ngZone.run(() => {
                    this.notificationService.showWarning('Atención', 'No se encontraron estudiantes asociados a este documento.');
                });
            }
            this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error al consultar acudiente:', error);
        this.isLoading = false;
        this.ngZone.run(() => {
            this.notificationService.showError('Error', 'Hubo un error al consultar la información del acudiente');
        });
        this.cdr.detectChanges();
      }
    });
  }

  onSelectStudent(student: any): void {
    console.log('Selected student:', student);
    this.selectedStudent = student;
    this.showRegistrationCode = true;
    
    // Explicitly update the resetPasswordForm if needed, though formControlName handles binding
    // Reset code field when changing student
    this.resetPasswordForm.patchValue({ registrationCode: '' });
    
    // Force change detection to ensure the registration code input appears
    this.cdr.detectChanges();
  }

  onValidateStudent(): void {
    if (!this.selectedStudent) {
      this.ngZone.run(() => {
          this.notificationService.showWarning('Atención', 'Debe seleccionar un estudiante.');
      });
      return;
    }

    const code = this.resetPasswordForm.get('registrationCode')?.value;
    if (!code) {
      this.ngZone.run(() => {
          this.notificationService.showWarning('Atención', 'Debe ingresar el código de registro.');
      });
      return;
    }
    
    this.isLoading = true;
    const { tipo_documento, numero_documento } = this.selectedStudent;

    this.programaAyoService.verificacionCodigo(tipo_documento, numero_documento, code).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('Respuesta verificación:', response);

        if (!response || (Array.isArray(response) && response.length === 0)) {
            this.ngZone.run(() => {
                this.notificationService.showError('Error', 'Código de Registro Incorrecto');
            });
            this.cdr.detectChanges();
            return;
        }
        
        let serverCode = null;
        if (response && response.codigo_registro) {
            serverCode = response.codigo_registro;
        } else if (Array.isArray(response) && response.length > 0 && response[0].codigo_registro) {
            serverCode = response[0].codigo_registro;
        } else if (response && response.data && response.data.codigo_registro) {
            serverCode = response.data.codigo_registro;
        }
        
        // If we found a code from the server, let's compare it with the input
        if (serverCode) {
             if (String(serverCode) === String(code)) {
                 this.currentStep = 3;
                 this.ngZone.run(() => {
                     this.notificationService.showSuccess('Correcto', 'Código de registro verificado.');
                 });
                 this.cdr.detectChanges();
             } else {
                 this.ngZone.run(() => {
                     this.notificationService.showError('Error', 'El código de registro es incorrecto.');
                 });
                 this.cdr.detectChanges();
             }
        } else {
             // Fallback to local check
             if (this.selectedStudent.codigo_registro === code) {
                  this.currentStep = 3;
                  this.ngZone.run(() => {
                      this.notificationService.showSuccess('Correcto', 'Código de registro verificado.');
                  });
                  this.cdr.detectChanges();
             } else {
                  this.ngZone.run(() => {
                      this.notificationService.showError('Error', 'El código de registro es incorrecto.');
                  });
                  this.cdr.detectChanges();
             }
        }
      },
      error: (error) => {
        console.error('Error verificación:', error);
        this.isLoading = false;
        this.ngZone.run(() => {
            this.notificationService.showError('Error', 'No se pudo verificar la información del estudiante.');
        });
        this.cdr.detectChanges();
      }
    });
  }

  onResetPassword(): void {
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { password, email } = this.resetPasswordForm.value;
    
    this.programaAyoService.cambioContraseña(password, email).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('Respuesta cambio contraseña:', response);

        if (!response || (Array.isArray(response) && response.length === 0)) {
            this.ngZone.run(() => {
                this.notificationService.showError('Error', 'No se pudo restablecer la contraseña. Verifique el correo electrónico.');
            });
            this.cdr.detectChanges();
            return;
        }

        this.ngZone.run(() => {
          this.notificationService.showSuccess('Éxito', 'Contraseña restablecida correctamente.');
        });
        this.close.emit();
      },
      error: (error) => {
        console.error('Error cambio contraseña:', error);
        this.isLoading = false;
        this.ngZone.run(() => {
          this.notificationService.showError('Error', 'Hubo un error al restablecer la contraseña. Verifique los datos e intente nuevamente.');
        });
        this.cdr.detectChanges();
      }
    });
  }

  onBack(): void {
    this.close.emit();
  }
}
