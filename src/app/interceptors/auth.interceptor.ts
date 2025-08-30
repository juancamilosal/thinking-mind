import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from "@angular/common/http";
import { Router } from "@angular/router";
import { inject } from "@angular/core";
import { catchError, EMPTY, throwError } from "rxjs";
import { NotificationService } from "../core/services/notification.service";
import { SKIP_AUTH_INTERCEPTOR } from "./SkipAuthInterceptor";

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const router = inject(Router);
  const notificationService = inject(NotificationService);

  // Si la request lleva el token SKIP, no aplicar interceptor
  if (req.context.get(SKIP_AUTH_INTERCEPTOR)) {
    return next(req);
  }

  // Clonar request para que lleve cookies de sesión
  const clonedRequest = req.clone({ withCredentials: true });

  return next(clonedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        router.navigateByUrl('/login');
        notificationService.showInfo(
          'Sesión vencida',
          'La sesión se venció, por favor vuelva a ingresar'
        );
        return EMPTY;
      }

      if (error.status === 403) {
        router.navigateByUrl('/login');
        notificationService.showInfo(
          'Acceso denegado',
          'No tienes permisos para acceder a este recurso'
        );
        return EMPTY;
      }

      return throwError(() => error);
    })
  );
};