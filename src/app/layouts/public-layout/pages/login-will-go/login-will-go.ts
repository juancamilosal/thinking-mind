import { AjustarTextoDirective } from '../../../private-layout-will-go/ajustar-texto.directive';
import { Roles } from '../../../../core/const/Roles';
import { InstalarAppComponent } from '../../../private-layout-will-go/instalar-app.component';
import { SelectorIdiomaComponent } from '../../../private-layout-will-go/selector-idioma.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
  imports: [AjustarTextoDirective, ReactiveFormsModule, InstalarAppComponent, SelectorIdiomaComponent, TranslatePipe],
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
  /** Fotos de Will-Go que se turnan en el panel de marca. */
  readonly fotosFondo = Array.from({ length: 8 }, (_, i) => ({
    src: `assets/images/will-go/login-${i + 1}.webp`,
    // Las fotos de billetes (1.ª y 3.ª) suben más en computador, para que el logo no tape la moneda Thinking Mind
    billetes: i === 0 || i === 2,
  }));

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private loginService: LoginService,
    private willGo: WillGoService,
    private tokenRefresh: TokenRefreshService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private t: TranslateService,
  ) {}

  ngOnInit(): void {
    Roles.recordarLogin('/login-will-go'); // al vencerse la sesión, se vuelve a este ingreso
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
            this.terminar(this.t.instant('wg.nucleo.login.noPertenece'));
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
            ? this.t.instant('wg.nucleo.login.incorrectos')
            : WillGoService.mensajeDeError(e, this.t.instant('wg.nucleo.login.errorGeneral')));
        },
      });
  }

  private terminar(mensaje: string): void {
    this.cargando = false;
    this.error = mensaje;
    this.cdr.detectChanges();
  }
}
