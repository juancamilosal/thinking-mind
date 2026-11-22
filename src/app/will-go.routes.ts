import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { RolWillGo, WillGoService } from './core/services/will-go.service';
import { LoginWillGo } from './layouts/public-layout/pages/login-will-go/login-will-go';
import { PrivateLayoutWillGo } from './layouts/private-layout-will-go/private-layout-will-go';
import { InicioWillGo } from './layouts/private-layout-will-go/pages/inicio/inicio-will-go';
import { CambiarClaveWillGo } from './layouts/private-layout-will-go/pages/cambiar-clave/cambiar-clave-will-go';
import { FuncionariosWillGo } from './layouts/private-layout-will-go/pages/funcionarios/funcionarios-will-go';
import { EdicionesWillGo } from './layouts/private-layout-will-go/pages/ediciones/ediciones-will-go';
import { EdicionWillGo } from './layouts/private-layout-will-go/pages/ediciones/edicion-will-go';
import { ArqueoWillGo } from './layouts/private-layout-will-go/pages/arqueo/arqueo-will-go';
import { RepartirWillGo } from './layouts/private-layout-will-go/pages/repartir/repartir-will-go';
import { EntregarWillGo } from './layouts/private-layout-will-go/pages/entregar/entregar-will-go';
import { WfundsWillGo } from './layouts/private-layout-will-go/pages/wfunds/wfunds-will-go';
import { RubricaWillGo } from './layouts/private-layout-will-go/pages/rubrica/rubrica-will-go';
import { TipoCambioWillGo } from './layouts/private-layout-will-go/pages/tipo-cambio/tipo-cambio-will-go';
import { IngresoAcudiente } from './layouts/public-layout/pages/acudiente-will-go/ingreso-acudiente';
import { PanelAcudiente } from './layouts/public-layout/pages/acudiente-will-go/panel-acudiente';

/** Solo entran colaboradores de Will Go, y quien tiene clave temporal solo puede ir a cambiarla. */
export const willGoGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const perfil = WillGoService.perfilGuardado();
  if (!perfil?.es_will_go) return router.parseUrl('/login-will-go');
  if (perfil.debe_cambiar_clave && !state.url.startsWith('/private-will-go/cambiar-clave')) {
    return router.parseUrl('/private-will-go/cambiar-clave');
  }
  const roles = route.data?.['roles'] as RolWillGo[] | undefined;
  if (roles && !roles.includes(perfil.rol!)) return router.parseUrl('/private-will-go/inicio');
  return true;
};

export const willGoRoutes: Routes = [
  {
    path: 'login-will-go',
    title: 'Will-Go Economy | Ingreso',
    component: LoginWillGo,
  },
  // Portal de acudientes (sin usuario de Directus: entran con documento + código al correo)
  { path: 'acudiente-will-go', title: 'Will-Go Economy | Acudientes', component: IngresoAcudiente },
  { path: 'acudiente-will-go/panel', title: 'Will-Go Economy | Mi familia', component: PanelAcudiente },
  {
    path: 'private-will-go',
    component: PrivateLayoutWillGo,
    canActivate: [authGuard, willGoGuard],
    canActivateChild: [willGoGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', title: 'Will-Go Economy | Inicio', component: InicioWillGo },
      { path: 'cambiar-clave', title: 'Will-Go Economy | Cambiar contraseña', component: CambiarClaveWillGo },
      {
        path: 'colaboradores',
        title: 'Will-Go Economy | Colaboradores',
        component: FuncionariosWillGo,
        data: { roles: ['administrativo', 'administrador'] },
      },
      {
        path: 'ediciones',
        title: 'Will-Go Economy | Ediciones',
        component: EdicionesWillGo,
        data: { roles: ['administrativo', 'administrador'] },
      },
      {
        path: 'ediciones/:id',
        title: 'Will-Go Economy | Edición',
        component: EdicionWillGo,
        data: { roles: ['administrativo', 'administrador'] },
      },
      {
        path: 'banco',
        title: 'Will-Go Economy | Banco',
        component: ArqueoWillGo,
        data: { roles: ['banco', 'administrativo', 'administrador'] },
      },
      {
        path: 'repartir',
        title: 'Will-Go Economy | Repartir a docentes',
        component: RepartirWillGo,
        data: { roles: ['banco', 'administrativo', 'administrador'] },
      },
      {
        path: 'entregar',
        title: 'Will-Go Economy | Entregar billetes',
        component: EntregarWillGo,
        data: { roles: ['docente', 'administrativo', 'administrador'] },
      },
      {
        path: 'wfunds',
        title: 'Will-Go Economy | W-Funds',
        component: WfundsWillGo,
        data: { roles: ['banco', 'administrativo', 'administrador'] },
      },
      {
        path: 'rubrica',
        title: 'Will-Go Economy | Rúbrica',
        component: RubricaWillGo,
        data: { roles: ['docente', 'administrativo', 'administrador'] },
      },
      {
        path: 'tipo-cambio',
        title: 'Will-Go Economy | Tipo de cambio',
        component: TipoCambioWillGo,
        data: { roles: ['administrativo', 'administrador', 'banco', 'docente', 'cajero'] },
      },
      { path: 'arqueo', pathMatch: 'full', redirectTo: 'banco' },
      { path: '**', redirectTo: 'inicio' },
    ],
  },
];
