import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import {User} from '../models/User';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  apiUrl = environment.users;

  constructor(private http: HttpClient) {}

  getUsersByRole(roleId: string, searchTerm?: string): Observable<ResponseAPI<User[]>> {
    let params: any = {
      'filter[role][_eq]': roleId,
      'fields': 'id,first_name,last_name,email,role,celular,colegio_id.*'
    };

    if (searchTerm) {
      params = {
        ...params,
        'filter[_or][0][first_name][_icontains]': searchTerm,
        'filter[_or][1][last_name][_icontains]': searchTerm,
        'filter[_or][2][email][_icontains]': searchTerm
      };
    }

    return this.http.get<ResponseAPI<User[]>>(this.apiUrl, { params });
  }

  createUser(user: Partial<User>): Observable<ResponseAPI<User>> {
    return this.http.post<ResponseAPI<User>>(this.apiUrl, user);
  }

  updateUser(id: string, user: Partial<User>): Observable<ResponseAPI<User>> {
    return this.http.patch<ResponseAPI<User>>(`${this.apiUrl}/${id}`, user);
  }

  deleteUser(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }
}
