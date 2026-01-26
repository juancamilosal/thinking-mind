import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {tap, timeout, catchError} from 'rxjs/operators';
import {of} from 'rxjs';
import {environment} from '../../../environments/environment';
import {StorageServices} from './storage.services';
import {Login} from '../models/Login';
import {ResponseAPI} from '../models/ResponseAPI';
import {Roles} from '../const/Roles';

@Injectable({
  providedIn: 'root'
})

export class LoginService {
  apiSecurity = environment;

  constructor(private http: HttpClient) {

  }

  // Helper method to decode JWT token
  private decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  }

  login(login: Login): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiSecurity.security.login, login)
      .pipe(
        tap((response: any) => {
          const accessToken = response.access_token || response.data?.access_token;
          if (accessToken) {
            StorageServices.setAccessToken(accessToken);
          }

          const refreshToken = response.refresh_token || response.data?.refresh_token;
          if (refreshToken) {
            StorageServices.setRefreshToken(refreshToken);
          } else {
          }

          const userData = response.user || response.data?.user;
          if (userData) {
            const filteredUserData: any = {
              email: userData.email,
              id: userData.id,
              first_name: userData.first_name,
              last_name: userData.last_name,
              role: userData.role
            };

            // Si el rol es rector, agregar celular y colegio_id
            if (userData.role === Roles.RECTOR) {
              filteredUserData.celular = userData.celular;
              filteredUserData.colegio_id = userData.colegio_id;
            }

            // Si el rol es AYO (Estudiante), agregar campos específicos
            if (userData.role === Roles.STUDENT) {
              filteredUserData.calificacion = userData.calificacion;
              filteredUserData.creditos = userData.creditos;
              filteredUserData.resultado_test = userData.resultado_test;
              filteredUserData.nivel_id = userData.nivel_id || userData.nivel;
              filteredUserData.tipo_documento = userData.tipo_documento;
              filteredUserData.numero_documento = userData.numero_documento;
            }

            // Si el rol es AYO (Teacher), agregar campos específicos
            if (userData.role === Roles.TEACHER) {
              filteredUserData.tipo_documento = userData.tipo_documento;
              filteredUserData.numero_documento = userData.numero_documento;
            }

            // Para estudiantes regulares (Estudiantes role), incluir resultado_test si existe
            filteredUserData.resultado_test = userData.resultado_test || null;

            StorageServices.setUserData(filteredUserData);

            // Guardar el rol en localStorage para redirecciones futuras (ej: auth guard)
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('last_user_role', userData.role);
            }
          }
        })
      );
  }

  logout(): Observable<any> {
    const refreshToken = StorageServices.getRefreshToken();

    // Si existe refresh token (modo normal), se envía en el body
    if (refreshToken) {
      const payload = { refresh_token: refreshToken };
      return this.http.post(environment.security.logout, payload).pipe(
        tap(() => {
          StorageServices.clearSession();
        }),
        catchError((error) => {
          StorageServices.clearSession();
          return of(null);
        })
      );
    } else {
      // Si no hay refresh token (modo cookie/AYO), se intenta logout con cookies
      return this.http.post(environment.security.logout, {}, { withCredentials: true }).pipe(
        tap(() => {
          StorageServices.clearSession();
        }),
        catchError((error) => {
          StorageServices.clearSession();
          return of(null);
        })
      );
    }
  }

  refreshToken(): Observable<any> {
    const refreshToken = StorageServices.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No hay refresh token disponible'));
    }

    const payload = { refresh_token: refreshToken };

    return this.http.post(environment.security.refresh, payload).pipe(
      tap((response: any) => {

        const newAccessToken = response.access_token || response.data?.access_token;
        const newRefreshToken = response.refresh_token || response.data?.refresh_token;

        if (newAccessToken) {
          StorageServices.setAccessToken(newAccessToken);
        }

        if (newRefreshToken) {
          StorageServices.setRefreshToken(newRefreshToken);
        }

        const userData = response.user || response.data?.user;
        if (userData) {
          const filteredUserData: any = {
            email: userData.email,
            id: userData.id,
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role
          };

          // Si el rol es rector, agregar celular y colegio_id
          if (userData.role === Roles.RECTOR) {
            filteredUserData.celular = userData.celular;
            filteredUserData.colegio_id = userData.colegio_id;
          }
          // Para estudiantes, incluir resultado_test si existe
          filteredUserData.resultado_test = userData.resultado_test || null;
          // Si el rol es AYO (Estudiante), agregar campos específicos
          if (userData.role === Roles.STUDENT) {
            filteredUserData.calificacion = userData.calificacion;
            filteredUserData.creditos = userData.creditos;
            filteredUserData.resultado_test = userData.resultado_test;
            filteredUserData.nivel_id = userData.nivel_id || userData.nivel;
          }
          // Si el rol es AYO (Teacher), agregar campos específicos
          if (userData.role === Roles.TEACHER) {
            filteredUserData.tipo_documento = userData.tipo_documento;
            filteredUserData.numero_documento = userData.numero_documento;
          }

          StorageServices.setUserData(filteredUserData);
        }
      }),
      catchError((error) => {
        StorageServices.clearSession();
        return throwError(() => error);
      })
    );
  }

  me(): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(this.apiSecurity.security.me).pipe(
      tap((response: any) => {
        const userData = response.data || response;

        // If the API doesn't return role, try to get it from the JWT token
        if (userData && !userData.role) {
          const accessToken = StorageServices.getAccessToken();
          if (accessToken) {
            const decodedToken = this.decodeToken(accessToken);
            if (decodedToken && decodedToken.role) {
              userData.role = decodedToken.role;
            }
          }
        }

        if (userData) {
          const filteredUserData: any = {
            email: userData.email,
            id: userData.id,
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role
          };

          // Si el rol es rector, agregar celular y colegio_id
          if (userData.role === Roles.RECTOR) {
            filteredUserData.celular = userData.celular;
            filteredUserData.colegio_id = userData.colegio_id;
          }

          // Si el rol es AYO (Estudiante), agregar campos específicos
          if (userData.role === Roles.STUDENT) {
            filteredUserData.calificacion = userData.calificacion;
            filteredUserData.creditos = userData.creditos;
            filteredUserData.resultado_test = userData.resultado_test;
            filteredUserData.nivel_id = userData.nivel_id || userData.nivel;
            filteredUserData.tipo_documento = userData.tipo_documento;
            filteredUserData.numero_documento = userData.numero_documento;
          }

          // Si el rol es AYO (Teacher), agregar campos específicos si los hay
          if (userData.role === Roles.TEACHER) {
            filteredUserData.tipo_documento = userData.tipo_documento;
            filteredUserData.numero_documento = userData.numero_documento;
          }

          StorageServices.setUserData(filteredUserData);
        }
      })
    );
  }
}
