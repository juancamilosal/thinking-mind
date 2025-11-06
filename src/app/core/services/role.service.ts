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
    const allowedRoleIds = [
      'ca89252c-6b5c-4f51-a6e4-34ab4d0e2a02', // Administrador
      'a4ed6390-5421-46d1-b81e-5cad06115abc', // Rector
      'b40cfe25-bd79-4d62-818b-6cf96674fc12',  // Ventas
      'b9cf2164-22ab-4dc8-be5a-8a9420c82f1c' //Finanzas
    ];

    const params: any = {
      'fields': 'id,name,description'
    };

    // Agregar filtros para cada rol permitido
    allowedRoleIds.forEach((roleId, index) => {
      params[`filter[_or][${index}][id][_eq]`] = roleId;
    });

    return this.http.get<ResponseAPI<Role[]>>(this.apiUrl, { params });
  }
}