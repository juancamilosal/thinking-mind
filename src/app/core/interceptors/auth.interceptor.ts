import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { LoginService } from '../services/login.service';
import { StorageServices } from '../services/storage.services';
import { TokenRefreshService } from '../services/token-refresh.service';
import { isPlatformBrowser } from '@angular/common';

// Variables globales para el estado del refresh
let isRefreshing = false;
let refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

export const AuthInterceptor: HttpInterceptorFn = (request: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const router = inject(Router);
  const loginService = inject(LoginService);
  const tokenRefreshService = inject(TokenRefreshService);
  const platformId = inject(PLATFORM_ID);
  
  // No interceptar en el servidor (SSR) para evitar redirecciones prematuras
  if (!isPlatformBrowser(platformId)) {
    return next(request);
  }

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
         return handle401Error(request, next, router, loginService, tokenRefreshService);
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

function handle401Error(request: HttpRequest<any>, next: HttpHandlerFn, router: Router, loginService: LoginService, tokenRefreshService: TokenRefreshService): Observable<HttpEvent<any>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = StorageServices.getRefreshToken();
     if (refreshToken) {
       return loginService.refreshToken().pipe(
        switchMap((response: any) => {
          const newAccessToken = response?.access_token || response?.data?.access_token;
          if (newAccessToken) {
            StorageServices.setAccessToken(newAccessToken);
            // Notificar a todas las peticiones en espera que el token está listo
            refreshTokenSubject.next(newAccessToken);
            // Reprogramar la renovación automática con el nuevo token
            tokenRefreshService.startTokenRefreshService();
            // Reintentar la petición original con el nuevo token
            const retryRequest = addTokenToRequest(request, newAccessToken);
            // Resetear el estado después de un pequeño delay para permitir que otras peticiones se procesen
            setTimeout(() => {
              isRefreshing = false;
            }, 100);
            return next(retryRequest);
          }
          isRefreshing = false;
          return redirectToLogin(router, tokenRefreshService);
        }),
        catchError((error) => {
          isRefreshing = false;
          refreshTokenSubject.next(null);
          return redirectToLogin(router, tokenRefreshService);
        })
      );
    } else {
       return redirectToLogin(router, tokenRefreshService);
     }
  } else {
    // Si ya se está refrescando el token, esperar a que termine
    return refreshTokenSubject.pipe(
      filter(token => token != null),
      take(1),
      switchMap(token => {
        // Reintentar la petición original con el token refrescado
        const retryRequest = addTokenToRequest(request, token);
        return next(retryRequest);
      })
    );
  }
}

function redirectToLogin(router: Router, tokenRefreshService: TokenRefreshService): Observable<never> {
  isRefreshing = false;
  // Detener el servicio de renovación de tokens
  tokenRefreshService.stopTokenRefreshService();
  
  const user = StorageServices.getCurrentUser();
  const lastRole = typeof localStorage !== 'undefined' ? localStorage.getItem('last_user_role') : null;
  const isAyoRole = user?.role === 'ca8ffc29-c040-439f-8017-0dcb141f0fd3' || lastRole === 'ca8ffc29-c040-439f-8017-0dcb141f0fd3';

  // Limpiar tokens usando StorageServices
  StorageServices.clearTokens();
  
  if (isAyoRole) {
    router.navigate(['/login-ayo']);
  } else {
    router.navigate(['/login']);
  }

  return throwError(() => 'Token refresh failed');
}