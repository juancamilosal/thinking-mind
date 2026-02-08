import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { LoginService } from '../services/login.service';
import { StorageServices } from '../services/storage.services';
import { TokenRefreshService } from '../services/token-refresh.service';
import { Roles } from '../const/Roles';


let isRefreshing = false;
let refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

export const AuthInterceptor: HttpInterceptorFn = (request: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  const router = inject(Router);
  const loginService = inject(LoginService);
  const tokenRefreshService = inject(TokenRefreshService);


  if (shouldSkipInterceptor(request)) {
    return next(request);
  }

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

    return loginService.refreshToken().pipe(
      switchMap((response: any) => {
        const newAccessToken = response?.access_token || response?.data?.access_token;
        if (newAccessToken) {
          StorageServices.setAccessToken(newAccessToken);
          refreshTokenSubject.next(newAccessToken);
          tokenRefreshService.startTokenRefreshService();
          const retryRequest = addTokenToRequest(request, newAccessToken);
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
  
  const currentUser = StorageServices.getCurrentUser();
  const ayoRoles = ['fe83d2f3-1b89-477d-984a-de3b56e12001', 'ca8ffc29-c040-439f-8017-0dcb141f0fd3'];
  const shouldRedirectToAyo = currentUser && currentUser.role && ayoRoles.includes(currentUser.role);

  tokenRefreshService.stopTokenRefreshService();

  // If session still exists (tokenRefreshService didn't clear it), we handle it
  if (StorageServices.getCurrentUser()) {
    StorageServices.clearSession();
    
    if (shouldRedirectToAyo) {
      router.navigate(['/login-ayo']);
    } else {
      router.navigate(['/session-expired']);
    }
  }

  return throwError(() => 'Token refresh failed');
}
