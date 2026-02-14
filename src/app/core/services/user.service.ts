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

  getStudentsWithoutProgramaAyo(): Observable<ResponseAPI<User[]>> {
    const roleId = 'ca8ffc29-c040-439f-8017-0dcb141f0fd3';
    const params: any = {
      'filter[role][_eq]': roleId,
      'filter[programa_ayo_id][_null]': true,
      'fields': 'id,first_name,last_name,email,role,celular,colegio_id.*,nivel_id.*,asistencia_id.*,programa_ayo_id'
    };
    return this.http.get<ResponseAPI<User[]>>(this.apiUrl, { params });
  }

  getStudentsWithoutProgramaAyoCount(): Observable<ResponseAPI<User[]>> {
    const roleId = 'ca8ffc29-c040-439f-8017-0dcb141f0fd3';
    const params: any = {
      'filter[role][_eq]': roleId,
      'filter[programa_ayo_id][_null]': true,
      'fields': 'id',
      'limit': '1',
      'meta': 'total_count'
    };
    return this.http.get<ResponseAPI<User[]>>(this.apiUrl, { params });
  }

  getStudentsWithAttendance(filters: { search?: string, level?: string, subcategory?: string } = {}): Observable<ResponseAPI<User[]>> {
    let params: any = {
      'filter[role][_eq]': 'ca8ffc29-c040-439f-8017-0dcb141f0fd3', // Roles.STUDENT
      'fields': '*,asistencia_id.*,nivel_id.*'
    };

    if (filters.search) {
      params['search'] = filters.search;
    }

    if (filters.level) {
      params['filter[nivel_id][nivel][_eq]'] = filters.level;
    }

    if (filters.subcategory) {
      params['filter[nivel_id][subcategoria][_eq]'] = filters.subcategory;
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
