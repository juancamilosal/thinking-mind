import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  
  // Verificar si estamos en el navegador antes de acceder a localStorage
  let accessToken: string | null = null;
  if (isPlatformBrowser(platformId)) {
    accessToken = localStorage.getItem('access_token');
  }
  
  // Si existe el token, añadirlo a los headers
  if (accessToken) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }
  
  return next(req).pipe(
    catchError((error) => {
      // Si el token ha expirado o es inválido (401), redirigir al login
      if (error.status === 401 && isPlatformBrowser(platformId)) {
        localStorage.clear();
        sessionStorage.clear();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};