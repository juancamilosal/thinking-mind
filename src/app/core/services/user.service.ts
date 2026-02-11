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
      params['search'] = searchTerm;
    }

    return this.http.get<ResponseAPI<User[]>>(this.apiUrl, { params });
  }

  createUser(user: Partial<User>): Observable<ResponseAPI<User>> {
    return this.http.post<ResponseAPI<User>>(this.apiUrl, user);
  }

  updateUser(id: string, user: Partial<User>): Observable<ResponseAPI<User>> {
    return this.http.patch<ResponseAPI<User>>(`${this.apiUrl}/${id}`, user);
  }

  updateUsers(users: Partial<User>[]): Observable<ResponseAPI<User[]>> {
    return this.http.patch<ResponseAPI<User[]>>(this.apiUrl, users);
  }

  deleteUser(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }

  getAllUsers(): Observable<ResponseAPI<User[]>> {
    const params = {
      'fields': 'id,first_name,last_name,email,role,celular,colegio_id.*'
    };
    return this.http.get<ResponseAPI<User[]>>(this.apiUrl, { params });
  }

  getUsersByDocument(tipoDocumento: string, numeroDocumento: string): Observable<ResponseAPI<User[]>> {
    const params = {
      'filter[tipo_documento][_eq]': tipoDocumento,
      'filter[numero_documento][_eq]': numeroDocumento,
      'fields': '*'
    };
    return this.http.get<ResponseAPI<User[]>>(this.apiUrl, { params });
  }

  getUsersByMultipleDocuments(documents: {tipo: string, numero: string}[]): Observable<ResponseAPI<User[]>> {
    let params: any = {
      'fields': '*,asistencia_id.*'
    };

    documents.forEach((doc, index) => {
      params[`filter[_or][${index}][_and][0][tipo_documento][_eq]`] = doc.tipo;
      params[`filter[_or][${index}][_and][1][numero_documento][_eq]`] = doc.numero;
    });

    return this.http.get<ResponseAPI<User[]>>(this.apiUrl, { params });
  }
}
