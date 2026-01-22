import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';
import { StorageServices } from '../services/storage.services';
import { LoginService } from '../services/login.service';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { StudentService } from '../services/student.service';

export const authGuard: CanActivateFn = (route, state): Observable<boolean> | boolean => {
  const router = inject(Router);
  const loginService = inject(LoginService);
  const studentService = inject(StudentService);

  // Verificar si hay un token de acceso válido
  const accessToken = StorageServices.getAccessToken();
  const currentUser = StorageServices.getCurrentUser();

  if (!accessToken) {
    // Verificar si el último usuario fue de AYO para redirigir correctamente
    const lastRole = typeof localStorage !== 'undefined' ? localStorage.getItem('last_user_role') : null;
    const isAyoRole = lastRole === 'ca8ffc29-c040-439f-8017-0dcb141f0fd3';

    if (isAyoRole) {
      router.navigate(['/login-ayo']);
    } else {
      router.navigate(['/login']);
    }
    return false;
  }

  if (currentUser) {
    // Si hay token y usuario, validar si el estudiante tiene pendiente el test
    const email = currentUser.email;
    if (!email) {
      return true;
    }

    return studentService.getStudentByEmail(email).pipe(
      map((res) => {
        const student = (res.data || [])[0];
        const isLangTestRoute = state.url.includes('/private/langTest');

        if (student && student.test_completado !== true && !isLangTestRoute) {
          router.navigate(['/private/langTest']);
          return false;
        }
        return true;
      }),
      catchError(() => of(true))
    );
  }

  // Si hay token pero no hay datos de usuario, verificar con el servidor
  return loginService.me().pipe(
    switchMap(() => {
      // Después de obtener datos del usuario, validar test del estudiante si aplica
      const user = StorageServices.getCurrentUser();
      const email = user?.email;
      if (!email) {
        return of(true);
      }

      return studentService.getStudentByEmail(email).pipe(
        map((res) => {
          const student = (res.data || [])[0];
          const isLangTestRoute = state.url.includes('/private/langTest');

          if (student && student.test_completado !== true && !isLangTestRoute) {
            router.navigate(['/private/langTest']);
            return false;
          }
          return true;
        }),
        catchError(() => of(true))
      );
    }),
    catchError((error) => {
      // Si hay error, limpiar tokens y redirigir al login correspondiente
      StorageServices.clearSession();

      const lastRole = typeof localStorage !== 'undefined' ? localStorage.getItem('last_user_role') : null;
      const isAyoRole = lastRole === 'ca8ffc29-c040-439f-8017-0dcb141f0fd3';

      if (isAyoRole) {
        router.navigate(['/login-ayo']);
      } else {
        router.navigate(['/login']);
      }
      return of(false);
    })
  );
};
