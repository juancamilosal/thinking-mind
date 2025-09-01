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

  constructor(private http: HttpClient) {

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
            StorageServices.setUserData(userData);
          }
        })
      );
  }

  logout(): Observable<any> {
    const refreshToken = StorageServices.getRefreshToken();
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
      StorageServices.clearSession();
      return of(null);
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
          StorageServices.setUserData(userData);
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
        if (userData) {
          const filteredUserData = {
            email: userData.email,
            id: userData.id,
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role
          };
          StorageServices.setUserData(filteredUserData);
        }
      })
    );
  }
}
