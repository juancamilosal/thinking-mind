import {Injectable} from '@angular/core';
import {HttpClient, HttpContext} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {environment} from '../../../environments/environment';
import {Login} from '../models/Login';
import {User} from '../models/User';
import {SKIP_AUTH_INTERCEPTOR} from '../interceptors/skip-auth-interceptor.token';

@Injectable({
  providedIn: 'root'
})

export class LoginService {
  apiSecurity = environment;

  constructor(private http: HttpClient) {
  }

  login(login: Login): Observable<ResponseAPI<any>> {
    const context = new HttpContext().set(SKIP_AUTH_INTERCEPTOR, true);
    return this.http.post<ResponseAPI<any>>(this.apiSecurity.security.login, login , {context, withCredentials: true,});
  }

  logout(): Observable<void> {
    return this.http.post<void>(this.apiSecurity.security.logout , {mode: 'session'});
  }

  me(): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(this.apiSecurity.security.me, {withCredentials: true});
  }

}
