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
    // Verificar si el último usuario fue de AYO para redirigir correctamente
    const lastRole = typeof localStorage !== 'undefined' ? localStorage.getItem('last_user_role') : null;

    // Si hay un rol guardado, asumimos que la sesión expiró
    if (lastRole) {
      router.navigate(['/session-expired']);
    } else {
      // Si no hay rol previo, redirigir según la ruta intentada
      if (state.url.includes('/private-ayo')) {
        router.navigate(['/login-ayo']);
      } else {
        router.navigate(['/session-expired']);
      }
    }
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

      if (lastRole) {
        router.navigate(['/session-expired']);
      } else {
        router.navigate(['/session-expired']);
      }
      return of(false);
    })
  );
};
