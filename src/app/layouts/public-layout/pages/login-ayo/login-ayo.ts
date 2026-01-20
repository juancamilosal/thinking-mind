import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StudentService } from '../../../../core/services/student.service';

@Component({
    selector: 'app-login-ayo',
    standalone: true,
    imports: [ReactiveFormsModule, RouterModule],
    templateUrl: './login-ayo.html',
    styleUrls: ['./login-ayo.css']
})
export class LoginAyo implements OnInit {
    registerForm!: FormGroup;
    loginForm!: FormGroup;

    isLoginMode: boolean = true; // Default to Login view
    isLoading: boolean = false;
    showRegisterPassword = false;
    showRegisterConfirmPassword = false;

    constructor(private formBuilder: FormBuilder, private studentService: StudentService) { }

    ngOnInit(): void {
        // Form for Registration (Existing)
        this.registerForm = this.formBuilder.group({
            tipoDocumento: ['', Validators.required],
            numeroDocumento: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            codigoAcceso: ['', Validators.required],
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', Validators.required]
        }, { validators: this.passwordMatchValidator });

        // Form for Login (New)
        this.loginForm = this.formBuilder.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });
    }

    passwordMatchValidator(form: FormGroup) {
        const password = form.get('password');
        const confirmPassword = form.get('confirmPassword');

        return password && confirmPassword && password.value === confirmPassword.value
            ? null
            : { mismatch: true };
    }

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
    }

    onLoginSubmit() {
        if (this.loginForm.invalid) return;
        this.isLoading = true;
        setTimeout(() => {
            this.isLoading = false;
            alert('Login simulado exitoso');
        }, 1500);
    }

    onRegisterSubmit() {
        if (this.registerForm.invalid) {
            this.registerForm.markAllAsTouched();
            return;
        }
        this.isLoading = true;

        const { tipoDocumento, numeroDocumento, email, codigoAcceso, password } = this.registerForm.value;

        this.studentService.verifyStudentRegistration(tipoDocumento, numeroDocumento, email, codigoAcceso)
            .subscribe({
                next: (response) => {
                    if (response.data && response.data.length > 0) {
                        const studentData = { ...response.data[0], password };
                        this.studentService.registerStudentFlow(studentData).subscribe({
                            next: (flowResponse) => {
                                this.isLoading = false;
                                setTimeout(() => {
                                    alert('Estudiante validado y registrado exitosamente');
                                }, 100);
                            },
                            error: (flowErr) => {
                                this.isLoading = false;
                                setTimeout(() => {
                                    alert('Estudiante validado, pero hubo un error en el proceso de registro');
                                }, 100);
                            }
                        });
                    } else {
                        this.isLoading = false;
                        setTimeout(() => {
                            alert('No se encontró estudiante con estos datos o los datos no coinciden');
                        }, 100);
                    }
                },
                error: (err) => {
                    this.isLoading = false;
                    console.error('Error al verificar estudiante:', err);
                    setTimeout(() => {
                        alert('Error al verificar la información del estudiante');
                    }, 100);
                }
            });
    }
}
