import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { StorageServices } from '../services/storage.services';
import { LoginService } from '../services/login.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state): Observable<boolean> | boolean => {
  const router = inject(Router);
  const loginService = inject(LoginService);
  
  // Verificar si hay un token de acceso válido
  const accessToken = StorageServices.getAccessToken();
  const currentUser = StorageServices.getCurrentUser();
  
  if (!accessToken) {
    // Si no hay token, redirigir al login inmediatamente
    router.navigate(['/login']);
    return false;
  }
  
  if (currentUser) {
    // Si hay token y usuario, permitir acceso
    return true;
  }
  
  // Si hay token pero no hay datos de usuario, verificar con el servidor
  return loginService.me().pipe(
    map((response) => {
      // Si la respuesta es exitosa, el usuario está autenticado
      return true;
    }),
    catchError((error) => {
      // Si hay error, limpiar tokens y redirigir al login
      StorageServices.clearSession();
      router.navigate(['/login']);
      return of(false);
    })
  );
};