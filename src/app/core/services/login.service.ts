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
  apiMe: string= environment.me;

  constructor(private http: HttpClient) {
  }

  login(login: Login): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiLogin, login);
  }

  me(): Observable<ResponseAPI<User>> {
    return this.http.get<ResponseAPI<User>>(this.apiMe);
  }
}
