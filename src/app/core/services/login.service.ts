import {Injectable} from '@angular/core';
import {HttpClient, HttpContext} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {environment} from '../../../environments/environment';
import {Login} from '../models/Login';
import {User} from '../models/User';

@Injectable({
  providedIn: 'root'
})

export class LoginService {
  apiLogin: string = environment.login;
  apiLogout: string = environment.logout;
  apiMe: string= environment.me;

  constructor(private http: HttpClient) {
  }

  login(login: Login): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiLogin, login);
  }

  logout(): Observable<ResponseAPI<any>> {
    const refreshToken = localStorage.getItem('refresh_token');
    const payload = refreshToken ? { refresh_token: refreshToken } : {};
    return this.http.post<ResponseAPI<any>>(this.apiLogout, payload);
  }

  me(): Observable<ResponseAPI<User>> {
    // Obtener todos los campos del usuario
    const params = {
      'fields': '*'
    };
    return this.http.get<ResponseAPI<User>>(this.apiMe, { params });
  }

  // Función utilitaria para filtrar campos nulos
  filterNullFields(obj: any): any {
    const filtered: any = {};
    for (const key in obj) {
      if (obj[key] !== null && obj[key] !== undefined) {
        filtered[key] = obj[key];
      }
    }
    return filtered;
  }


}
