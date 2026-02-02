import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { StudentService } from '../../../../core/services/student.service';
import { LoginService } from '../../../../core/services/login.service';
import { TokenRefreshService } from '../../../../core/services/token-refresh.service';
import { NotificationModalComponent, NotificationData } from '../../../../components/notification-modal/notification-modal';
import { Roles } from '../../../../core/const/Roles';
import { StorageServices } from '../../../../core/services/storage.services';

@Component({
    selector: 'app-login-ayo',
    standalone: true,
    imports: [ReactiveFormsModule, RouterModule, NotificationModalComponent],
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

    // Notification Modal
    showNotification: boolean = false;
    notificationData: NotificationData | null = null;

    constructor(
        private formBuilder: FormBuilder,
        private studentService: StudentService,
        private loginServices: LoginService,
        private tokenRefreshService: TokenRefreshService,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private ngZone: NgZone
    ) { }

    ngOnInit(): void {
        // Set context for routing redirects
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('app_context', 'ayo');
        }

        const accessToken = StorageServices.getAccessToken();
        const currentUser = StorageServices.getCurrentUser();
        if (accessToken && currentUser) {
            this.router.navigate(['/private-ayo']);
        }

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

        const { email, password } = this.loginForm.value;
        const loginPayload = {
            email,
            password,
        };
        this.loginServices.login(loginPayload).subscribe({
            next: () => {
                this.loginServices.me().subscribe({
                    next: () => {
                        const currentUser = StorageServices.getCurrentUser();
                        this.isLoading = false;
                        this.tokenRefreshService.startTokenRefreshService();
                        const isStudent = currentUser?.role === Roles.STUDENT;
                        const isTeacher = currentUser?.role === Roles.TEACHER;
                        if (isStudent && (currentUser?.resultado_test === null || currentUser?.resultado_test === undefined)) {
                          this.router.navigateByUrl('/private-ayo/langTest');
                        } else if (isTeacher) {
                          this.router.navigateByUrl('/private-ayo');
                        } else {
                          this.router.navigateByUrl('/private-ayo');
                        }
                    },
                    error: () => {
                        this.isLoading = false;
                        this.showMessage('error', 'Error', 'Credenciales válidas, pero hubo un error al obtener la información del usuario.');
                    }
                });
            },
            error: () => {
                this.isLoading = false;
                this.showMessage('error', 'Error', 'Credenciales inválidas o error en el inicio de sesión.');
            }
        });
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
                                if (flowResponse.status === 'ERROR') {
                                    this.isLoading = false;
                                    this.showMessage('error', 'Error', flowResponse.message || 'Error desconocido en el registro');
                                    return;
                                }

                                const loginPayload = {
                                    email: email,
                                    password: password,
                                    mode: 'cookie'
                                };

                                this.loginServices.login(loginPayload).subscribe({
                                    next: (loginRes) => {
                                        this.loginServices.me().subscribe({
                                            next: (userResponse) => {
                                                this.isLoading = false;
                                                this.tokenRefreshService.startTokenRefreshService();

                                                // Check if user is a student before redirecting to langTest
                                                const currentUser = StorageServices.getCurrentUser();
                                                const isStudent = currentUser?.role === Roles.STUDENT;
                                                const isTeacher = currentUser?.role === Roles.TEACHER;

                                                if (isStudent) {
                                                  // After successful registration + login, students go to Language Test
                                                  this.router.navigateByUrl('/private-ayo/langTest');
                                                } else if (isTeacher) {
                                                  // Teachers go to dashboard
                                                  this.router.navigateByUrl('/private-ayo');
                                                } else {
                                                  // Other roles go to dashboard
                                                  this.router.navigateByUrl('/private-ayo');
                                                }
                                            },
                                            error: (userError) => {
                                                this.isLoading = false;
                                                    this.showMessage('warning', 'Atención', 'Registro exitoso, pero hubo un error al obtener la información del usuario.');
                                            }
                                        });
                                    },
                                    error: (loginErr) => {
                                        this.isLoading = false;
                                            this.showMessage('warning', 'Atención', 'Registro exitoso, pero hubo un error al iniciar sesión automáticamente.');
                                    }
                                });
                            },
                            error: (flowErr) => {
                                this.isLoading = false;
                                    this.showMessage('error', 'Error', 'Estudiante validado, pero hubo un error en el proceso de registro');
                            }
                        });
                    } else {
                        this.isLoading = false;
                            this.showMessage('error', 'Error', 'No se encontró estudiante con estos datos o los datos no coinciden');
                    }
                },
                error: (err) => {
                    this.isLoading = false;
                        this.showMessage('error', 'Error', 'Error al verificar la información del estudiante');
                }
            });
    }

    onNotificationClose() {
        this.showNotification = false;
        this.notificationData = null;
    }

    private showMessage(type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) {
        this.ngZone.run(() => {
            this.notificationData = {
                type,
                title,
                message
            };
            this.showNotification = true;
            this.cdr.detectChanges();
        });
    }
}
