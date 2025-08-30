import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {tap, timeout, catchError} from 'rxjs/operators';
import {of} from 'rxjs';
import {environment} from '../../../environments/environment';
import {StorageServices} from './storage.services';
import {Login} from '../models/Login';
import {ResponseAPI} from '../models/ResponseAPI';

@Injectable({
  providedIn: 'root'
})

export class LoginService {
  apiSecurity = environment;

  constructor(
    private http: HttpClient
  ) {}

  login(login: Login): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiSecurity.security.login, login)
      .pipe(
        tap((response: any) => {
          console.log('Respuesta del login:', response);
          
          // Guardar access_token
          const accessToken = response.access_token || response.data?.access_token;
          if (accessToken) {
            StorageServices.setAccessToken(accessToken);
            console.log('Access token guardado:', accessToken);
          }
          
          // Guardar refresh_token
          const refreshToken = response.refresh_token || response.data?.refresh_token;
          if (refreshToken) {
            StorageServices.setRefreshToken(refreshToken);
            console.log('Refresh token guardado:', refreshToken);
          } else {
            console.log('No se encontró refresh_token en la respuesta');
          }
          
          // Guardar datos del usuario si están disponibles
          const userData = response.user || response.data?.user;
          if (userData) {
            StorageServices.setUserData(userData);
            console.log('Datos de usuario guardados:', userData);
          }
        })
      );
  }

  logout(): Observable<any> {
    const refreshToken = StorageServices.getRefreshToken();
    console.log('Cerrando sesión con refresh token:', refreshToken);
    
    if (refreshToken) {
      const payload = { refresh_token: refreshToken };
      
      return this.http.post(environment.security.logout, payload).pipe(
        tap(() => {
          console.log('Logout exitoso en el servidor');
          StorageServices.clearSession();
        }),
        catchError((error) => {
          console.error('Error en logout del servidor:', error);
          // Limpiar sesión local aunque falle el logout del servidor
          StorageServices.clearSession();
          return of(null); // Retornar observable exitoso
        })
      );
    } else {
      console.log('No hay refresh token, limpiando sesión local');
      StorageServices.clearSession();
      return of(null);
    }
  }

  refreshToken(): Observable<any> {
    const refreshToken = StorageServices.getRefreshToken();
    console.log('Intentando renovar token con:', refreshToken);
    
    if (!refreshToken) {
      return throwError(() => new Error('No hay refresh token disponible'));
    }
    
    const payload = { refresh_token: refreshToken };
    
    return this.http.post(environment.security.refresh, payload).pipe(
      tap((response: any) => {
        console.log('Token renovado exitosamente:', response);
        
        // Actualizar ambos tokens
        const newAccessToken = response.access_token || response.data?.access_token;
        const newRefreshToken = response.refresh_token || response.data?.refresh_token;
        
        if (newAccessToken) {
          StorageServices.setAccessToken(newAccessToken);
        }
        
        if (newRefreshToken) {
          StorageServices.setRefreshToken(newRefreshToken);
        }
        
        // Actualizar datos de usuario si están disponibles
        const userData = response.user || response.data?.user;
        if (userData) {
          StorageServices.setUserData(userData);
        }
      }),
      catchError((error) => {
        console.error('Error al renovar token:', error);
        // Limpiar sesión si falla la renovación
        StorageServices.clearSession();
        return throwError(() => error);
      })
    );
  }

  me(): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(this.apiSecurity.security.me, {withCredentials: true});
  }

}
