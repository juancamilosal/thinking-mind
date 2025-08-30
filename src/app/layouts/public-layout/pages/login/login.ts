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

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private loginServices: LoginService,
  ) {}

  ngOnInit(): void {
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
        this.router.navigateByUrl('/private');
        this.loginServices.me().subscribe({})
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
}
