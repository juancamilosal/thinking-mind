import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoginService } from '../services/login.service';
import { StorageServices } from '../services/storage.services';

// Variables globales para el estado del refresh
let isRefreshing = false;
let refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

export const AuthInterceptor: HttpInterceptorFn = (request: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const router = inject(Router);
  const loginService = inject(LoginService);
  
  // No interceptar las peticiones de login y refresh
  if (shouldSkipInterceptor(request)) {
    return next(request);
  }

  // Agregar el token de acceso si está disponible
  const accessToken = StorageServices.getAccessToken();
  if (accessToken) {
    request = addTokenToRequest(request, accessToken);
  }

  return next(request).pipe(
     catchError((error: HttpErrorResponse) => {
       if (error.status === 401) {
         return handle401Error(request, next, router, loginService);
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

function handle401Error(request: HttpRequest<any>, next: HttpHandlerFn, router: Router, loginService: LoginService): Observable<HttpEvent<any>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = StorageServices.getRefreshToken();
     if (refreshToken) {
       return loginService.refreshToken().pipe(
        switchMap((response: any) => {
          isRefreshing = false;
          const newAccessToken = response?.access_token || response?.data?.access_token;
          if (newAccessToken) {
            StorageServices.setAccessToken(newAccessToken);
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
  // Limpiar tokens usando StorageServices
  StorageServices.clearTokens();
  router.navigate(['/login']);
  return throwError(() => 'Token refresh failed');
}