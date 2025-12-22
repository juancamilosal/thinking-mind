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
  private apiUrl = 'https://api.appthinkingmind.com/roles';

  constructor(private http: HttpClient) {}

  getAllRoles(): Observable<ResponseAPI<Role[]>> {
    const params: any = {
      'fields': 'id,name,description'
    };

    return this.http.get<ResponseAPI<Role[]>>(this.apiUrl, { params });
  }
}