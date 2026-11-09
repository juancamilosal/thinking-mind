import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { StorageServices } from '../services/storage.services';
import { LoginService } from '../services/login.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Roles } from '../const/Roles';

export const authGuard: CanActivateFn = (route, state): Observable<boolean> | boolean => {
  const router = inject(Router);
  const loginService = inject(LoginService);

  // Verificar si hay un token de acceso válido
  const accessToken = StorageServices.getAccessToken();
  const currentUser = StorageServices.getCurrentUser();

  if (!accessToken) {
    // Sin sesión: volver al login que corresponde (AYO si la ruta o el último rol son de AYO)
    const lastRole = typeof localStorage !== 'undefined' ? localStorage.getItem('last_user_role') : null;
    router.navigate([state.url.includes('/private-ayo') ? '/login-ayo' : Roles.loginRoute(lastRole)]);
    return false;
  }

  if (currentUser) {
    // Token y usuario están presentes, permitir acceso
    return true;
  }

  // Si hay token pero no hay datos de usuario, verificar con el servidor
  return loginService.me().pipe(
    map(() => {
      // Si el me() fue exitoso, el usuario está autenticado
      return true;
    }),
    catchError((error) => {
      // Si hay error, limpiar tokens y redirigir al login correspondiente
      StorageServices.clearSession();

      const lastRole = typeof localStorage !== 'undefined' ? localStorage.getItem('last_user_role') : null;
      router.navigate([state.url.includes('/private-ayo') ? '/login-ayo' : Roles.loginRoute(lastRole)]);
      return of(false);
    })
  );
};
