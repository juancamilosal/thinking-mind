import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { StorageServices } from '../services/storage.services';
import { LoginService } from '../services/login.service';
import { Roles } from '../const/Roles';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export const authGuard: CanActivateFn = (route, state): Observable<boolean> | boolean => {
  const router = inject(Router);
  const loginService = inject(LoginService);
  const platformId = inject(PLATFORM_ID);

  // Si estamos en el servidor (SSR), permitimos la renderización inicial para evitar parpadeos
  // La validación real ocurrirá en el cliente cuando se hidrate la aplicación
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // Verificar si hay un token de acceso válido
  const accessToken = StorageServices.getAccessToken();
  const currentUser = StorageServices.getCurrentUser();

  if (!accessToken) {
    // Verificar si el último usuario fue de AYO para redirigir correctamente
    const lastRole = typeof localStorage !== 'undefined' ? localStorage.getItem('last_user_role') : null;
    const isAyoRole = lastRole === Roles.STUDENT || lastRole === Roles.TEACHER;

    if (isAyoRole) {
      router.navigate(['/login-ayo']);
    } else {
      router.navigate(['/login']);
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
      const isAyoRole = lastRole === Roles.STUDENT || lastRole === Roles.TEACHER;

      if (isAyoRole) {
        router.navigate(['/login-ayo']);
      } else {
        router.navigate(['/login']);
      }
      return of(false);
    })
  );
};
