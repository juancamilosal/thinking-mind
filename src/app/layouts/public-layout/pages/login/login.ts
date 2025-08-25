import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {Router} from '@angular/router';
import {LoginService} from '../../../../core/services/login.service';
import { NotificationModalComponent, NotificationData } from '../../../../components/notification-modal/notification-modal';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NotificationModalComponent],
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

  constructor(private formBuilder: FormBuilder, private router: Router, private loginServices: LoginService) {}

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.loginForm.invalid || this.isLoading)
      return;

    this.isLoading = true; // Activar estado de carga

    this.loginServices.login(this.loginForm.value).subscribe({
      next: (response) => {
        // Login exitoso - guardar tokens
        if (response.data && response.data.access_token) {
          localStorage.setItem('access_token', response.data.access_token);
        }
        if (response.data && response.data.refresh_token) {
          localStorage.setItem('refresh_token', response.data.refresh_token);
        }
        
        // Obtener información del usuario y guardarla en sessionStorage
        this.loginServices.me().subscribe({
          next: (userResponse) => {
            if (userResponse.data) {
              // Filtrar campos nulos antes de guardar en sessionStorage
            const filteredUserData = this.loginServices.filterNullFields(userResponse.data);
            sessionStorage.setItem('user_info', JSON.stringify(filteredUserData));
            console.log('User info stored in sessionStorage:', filteredUserData);
            }
            this.isLoading = false;
            this.router.navigateByUrl('/private');
          },
          error: (userError) => {
            console.error('Error al obtener información del usuario:', userError);
            // Continuar con la navegación aunque falle la obtención del usuario
            this.isLoading = false;
            this.router.navigateByUrl('/private');
          }
        });
      },
      error: (error) => {
        // Credenciales incorrectas o error de login
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
      duration: 5000 // 5 segundos
    };
    this.showNotification = true;
  }

  onNotificationClose() {
    this.showNotification = false;
    this.notificationData = null;
  }
}
