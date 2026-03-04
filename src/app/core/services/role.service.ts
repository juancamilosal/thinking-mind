import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { environment } from '../../../environments/environment';

export interface Role {
  id: string;
  name: string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  private apiUrl = environment.roles;

  constructor(private http: HttpClient) {}

  getAllRoles(search?: string): Observable<ResponseAPI<Role[]>> {
    let params: any = {
      'fields': 'id,name,description'
    };

    if (search) {
      params['filter[name][_contains]'] = search;
    }

    return this.http.get<ResponseAPI<Role[]>>(this.apiUrl, { params });
  }
}
