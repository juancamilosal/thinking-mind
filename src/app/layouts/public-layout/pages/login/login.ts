import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import {Router} from '@angular/router';
import {LoginService} from '../../../../core/services/login.service';
import { NotificationModalComponent, NotificationData } from '../../../../components/notification-modal/notification-modal';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, NotificationModalComponent],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login implements OnInit {
  loginForm!: FormGroup;
  showPassword: boolean = false;
  isLoading: boolean = false; // Estado de carga

  // Variables para el modal de notificaciones
  showNotification: boolean = false;
  notificationData: NotificationData | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private loginServices: LoginService,
  ) {}

  ngOnInit(): void {
    // Resetear estados al inicializar el componente
    this.showPassword = false;
    this.isLoading = false;
    this.showNotification = false;
    this.notificationData = null;
    
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.loginForm.invalid || this.isLoading)
      return;

    this.isLoading = true;

    this.loginServices.login(this.loginForm.value).subscribe({
      next: (response) => {
        // Después del login exitoso, obtener información del usuario
        this.loginServices.me().subscribe({
          next: (userResponse) => {
            this.isLoading = false;
            this.router.navigateByUrl('/private');
          },
          error: (userError) => {
            this.isLoading = false;
            this.showUserInfoErrorNotification();
          }
        });
      },
      error: (error) => {
        this.isLoading = false;
        this.showErrorNotification();
      }
    });
  }

  showErrorNotification() {
    this.notificationData = {
      type: 'error',
      title: 'Error de autenticación',
      message: 'Las credenciales ingresadas son incorrectas. Por favor, verifica tu email y contraseña.',
      duration: 5000
    };
    this.showNotification = true;
  }

  showUserInfoErrorNotification() {
    this.notificationData = {
      type: 'error',
      title: 'Error al obtener información del usuario',
      message: 'No se pudo obtener la información del usuario. Por favor, intenta iniciar sesión nuevamente.',
      duration: 5000 // 5 segundos
    };
    this.showNotification = true;
  }

  onNotificationClose() {
    this.showNotification = false;
    this.notificationData = null;
  }

  // Método para resetear el estado del componente
  resetComponentState() {
    this.showPassword = false;
    this.isLoading = false;
    this.showNotification = false;
    this.notificationData = null;
    if (this.loginForm) {
      this.loginForm.reset();
    }
  }
}
