import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {tap, timeout, catchError} from 'rxjs/operators';
import {of} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {environment} from '../../../environments/environment';
import {Login} from '../models/Login';

@Injectable({
  providedIn: 'root'
})

export class LoginService {
  apiSecurity = environment;

  constructor(private http: HttpClient) {
  }

  login(login: Login): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiSecurity.security.login, login)
      .pipe(
        tap((response: any) => {
          const refreshToken = response?.refresh_token || response?.data?.refresh_token;
          if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
          } else {
            console.warn('No se encontró refresh_token en la respuesta');
          }
        })
      );
  }

  logout(): Observable<void> {
    const refreshToken = localStorage.getItem('refresh_token');
    const payload: any = {};

    if (refreshToken) {
      payload.refresh_token = refreshToken;
    }

    return this.http.post<void>(this.apiSecurity.security.logout, payload, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .pipe(
        timeout(10000),
        tap(() => {
          localStorage.removeItem('refresh_token');
        }),
        catchError((error) => {
          localStorage.removeItem('refresh_token');
          return of(void 0);
        })
      );
  }

  refreshToken(): Observable<any> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return throwError(() => new Error('No hay refresh token disponible'));
    }

    const payload = { refresh_token: refreshToken };

    return this.http.post(environment.security.refresh, payload).pipe(
      tap((response: any) => {
        console.log('Token renovado exitosamente:', response);
        const newAccessToken = response.access_token || response.data?.access_token;
        const newRefreshToken = response.refresh_token || response.data?.refresh_token;

        if (newAccessToken) {
          localStorage.setItem('access_token', newAccessToken);
        }

        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken);
        }
      }),
      catchError((error) => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        return throwError(() => error);
      })
    );
  }

  me(): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(this.apiSecurity.security.me, {withCredentials: true});
  }

}
