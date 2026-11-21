import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LoginService } from '../../core/services/login.service';
import { TokenRefreshService } from '../../core/services/token-refresh.service';
import { NOMBRE_ROL, PerfilWillGo, WillGoService } from '../../core/services/will-go.service';
import { MENU_POR_ROL, OpcionMenu } from './menu-will-go';

@Component({
  selector: 'app-private-layout-will-go',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
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
    private tokenRefresh: TokenRefreshService
  ) {}

  ngOnInit(): void {
    this.perfil = WillGoService.perfilGuardado();
    this.menu = this.perfil?.rol ? MENU_POR_ROL[this.perfil.rol] : [];
  }

  get nombreRol(): string {
    return this.perfil?.rol ? NOMBRE_ROL[this.perfil.rol] : '';
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
