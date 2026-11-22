import { InstalarAppComponent } from '../../../private-layout-will-go/instalar-app.component';
import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { LoginService } from '../../../../core/services/login.service';
import { TokenRefreshService } from '../../../../core/services/token-refresh.service';
import { StorageServices } from '../../../../core/services/storage.services';
import { WillGoService } from '../../../../core/services/will-go.service';

@Component({
  selector: 'app-login-will-go',
  standalone: true,
  imports: [ReactiveFormsModule, InstalarAppComponent],
  templateUrl: './login-will-go.html',
  styleUrls: ['./login-will-go.css'],
})
export class LoginWillGo implements OnInit {
  form!: FormGroup;
  verClave = false;
  cargando = false;
  error = '';
  mostrarAyuda = false;
  logoFallo = false;

  /** Billetes decorativos del panel de marca (posición en %, ancho en px, giro en grados). */
  readonly billetesFondo = [
    { top: 8, left: 6, ancho: 120, giro: -14, retraso: 0, color: '#FF6B1A' },
    { top: 16, left: 74, ancho: 90, giro: 12, retraso: 1.5, color: '#FFE3C7' },
    { top: 62, left: 3, ancho: 96, giro: 8, retraso: 3, color: '#FFE3C7' },
    { top: 74, left: 70, ancho: 130, giro: -10, retraso: 2, color: '#FF6B1A' },
    { top: 40, left: 86, ancho: 70, giro: 20, retraso: 4, color: '#FF6B1A' },
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private loginService: LoginService,
    private willGo: WillGoService,
    private tokenRefresh: TokenRefreshService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    if (typeof localStorage !== 'undefined') localStorage.setItem('app_context', 'will-go');
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
    // Si ya hay una sesión de Will Go abierta, entra directo
    if (StorageServices.getAccessToken() && WillGoService.perfilGuardado()?.es_will_go) {
      this.router.navigateByUrl('/private-will-go');
    }
  }

  invalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!c && c.invalid && c.touched;
  }

  ingresar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.cargando) return;
    this.cargando = true;
    this.error = '';
    const { email, password } = this.form.value;

    this.loginService.login({ email: String(email).trim().toLowerCase(), password })
      .pipe(switchMap(() => this.willGo.yo()))
      .subscribe({
        next: (perfil) => {
          if (!perfil.es_will_go) {
            // Usuario válido de otra parte de la plataforma: no entra por aquí
            StorageServices.clearSession();
            WillGoService.olvidarPerfil();
            this.terminar('Este usuario no pertenece a Will Go Economy. Ingresa por el portal que te corresponde.');
            return;
          }
          this.tokenRefresh.startTokenRefreshService();
          this.cargando = false;
          // La respuesta puede llegar fuera de la zona de Angular: sin esto, la pantalla siguiente no se redibuja
          this.zone.run(() => this.router.navigateByUrl(perfil.debe_cambiar_clave ? '/private-will-go/cambiar-clave' : '/private-will-go'));
        },
        error: (e) => {
          StorageServices.clearSession();
          WillGoService.olvidarPerfil();
          this.terminar(e?.status === 401 || e?.status === 400
            ? 'Correo o contraseña incorrectos.'
            : WillGoService.mensajeDeError(e, 'No pudimos iniciar sesión. Intenta de nuevo.'));
        },
      });
  }

  private terminar(mensaje: string): void {
    this.cargando = false;
    this.error = mensaje;
    this.cdr.detectChanges();
  }
}
