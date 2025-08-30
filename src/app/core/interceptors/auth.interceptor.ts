import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoginService } from '../services/login.service';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

// Variables globales para el estado del refresh
let isRefreshing = false;
let refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

export const AuthInterceptor: HttpInterceptorFn = (request: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const router = inject(Router);
  const loginService = inject(LoginService);
  const platformId = inject(PLATFORM_ID);
  
  // No interceptar las peticiones de login y refresh
  if (shouldSkipInterceptor(request)) {
    return next(request);
  }

  // Solo acceder a localStorage si estamos en el navegador
  if (!isPlatformBrowser(platformId)) {
    return next(request);
  }

  // Agregar el token de acceso si está disponible
  const accessToken = localStorage.getItem('access_token');
  if (accessToken) {
    request = addTokenToRequest(request, accessToken);
  }

  return next(request).pipe(
     catchError((error: HttpErrorResponse) => {
       if (error.status === 401) {
         return handle401Error(request, next, router, loginService, platformId);
       }
       return throwError(() => error);
     })
   );
};

function shouldSkipInterceptor(request: HttpRequest<any>): boolean {
  const skipUrls = ['/auth/login', '/auth/logout', '/auth/refresh'];
  return skipUrls.some(url => request.url.includes(url));
}

function addTokenToRequest(request: HttpRequest<any>, token: string): HttpRequest<any> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}

function handle401Error(request: HttpRequest<any>, next: HttpHandlerFn, router: Router, loginService: LoginService, platformId: Object): Observable<HttpEvent<any>> {
  // Si no estamos en el navegador, no podemos manejar tokens
  if (!isPlatformBrowser(platformId)) {
    return throwError(() => new Error('No se puede manejar autenticación en el servidor'));
  }

  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = localStorage.getItem('refresh_token');
     if (refreshToken) {
       return loginService.refreshToken().pipe(
        switchMap((response: any) => {
          isRefreshing = false;
          const newAccessToken = response?.access_token || response?.data?.access_token;
          if (newAccessToken) {
            localStorage.setItem('access_token', newAccessToken);
            refreshTokenSubject.next(newAccessToken);
            return next(addTokenToRequest(request, newAccessToken));
          }
          return redirectToLogin(router);
        }),
        catchError(() => {
          return redirectToLogin(router);
        })
      );
    } else {
       return redirectToLogin(router);
     }
  } else {
    return refreshTokenSubject.pipe(
      filter(token => token != null),
      take(1),
      switchMap(token => {
        return next(addTokenToRequest(request, token));
      })
    );
  }
}

function redirectToLogin(router: Router): Observable<never> {
  isRefreshing = false;
  // Solo limpiar localStorage si estamos en el navegador
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
  router.navigate(['/login']);
  return throwError(() => 'Token refresh failed');
}