import { InstalarAppComponent } from './instalar-app.component';
import { SelectorIdiomaComponent } from './selector-idioma.component';
import { TranslatePipe } from '@ngx-translate/core';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LoginService } from '../../core/services/login.service';
import { TokenRefreshService } from '../../core/services/token-refresh.service';
import { PerfilWillGo, WillGoService } from '../../core/services/will-go.service';
import { OpcionMenu, menuPara } from './menu-will-go';

@Component({
  selector: 'app-private-layout-will-go',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, InstalarAppComponent, SelectorIdiomaComponent, TranslatePipe],
  templateUrl: './private-layout-will-go.html',
})
export class PrivateLayoutWillGo implements OnInit {
  perfil: PerfilWillGo | null = null;
  menu: OpcionMenu[] = [];
  menuAbierto = false;
  saliendo = false;

  constructor(
    private router: Router,
    private loginService: LoginService,
    private tokenRefresh: TokenRefreshService,
    private willGo: WillGoService,
  ) {}

  ngOnInit(): void {
    this.perfil = WillGoService.perfilGuardado();
    // Primero lo que no depende de una edición; luego, solo las secciones que la persona puede usar hoy
    this.menu = menuPara(this.perfil?.rol, null);
    if (this.perfil?.rol) this.willGo.miMenu().subscribe((acceso) => (this.menu = menuPara(this.perfil?.rol, acceso)));
  }

  /** Clave de traducción del nombre del rol (wg.nucleo.rol.*). */
  get claveRol(): string {
    return this.perfil?.rol ? `wg.nucleo.rol.${this.perfil.rol}` : '';
  }

  get iniciales(): string {
    return `${this.perfil?.nombre?.[0] ?? ''}${this.perfil?.apellido?.[0] ?? ''}`.toUpperCase();
  }

  get bloqueado(): boolean {
    // Se lee del almacenamiento: cambia apenas el usuario crea su clave definitiva
    return !!WillGoService.perfilGuardado()?.debe_cambiar_clave;
  }

  salir(): void {
    if (this.saliendo) return;
    this.saliendo = true;
    this.tokenRefresh.stopTokenRefreshService();
    this.loginService.logout().subscribe(() => {
      WillGoService.olvidarPerfil();
      this.router.navigateByUrl('/login-will-go');
    });
  }
}
