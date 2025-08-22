import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseAPI } from '../models/ResponseAPI';
import { environment } from '../../../environments/environment';
import {AccountReceivable} from '../models/AccountReceivable';

@Injectable({
  providedIn: 'root'
})
export class AccountReceivableService {
  private apiUrl: string = environment.accountsReceivable;

  constructor(private http: HttpClient) {}

  createAccountReceivable(accountReceivable: any): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiUrl, accountReceivable);
  }

  searchAccountReceivable(searchTerm?: string): Observable<ResponseAPI<AccountReceivable[]>> {
    if (!searchTerm) {
      return this.http.get<ResponseAPI<any[]>>(this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*').pipe(
        map(response => ({
          ...response,
          data: response.data.map(item => this.mapToAccountReceivable(item))
        }))
      );
    }

    const params = {
      'filter[_or][0][descripcion][_icontains]': searchTerm,
      'filter[_or][1][numero_factura][_icontains]': searchTerm
    };
    return this.http.get<ResponseAPI<any[]>>(this.apiUrl, { params }).pipe(
      map(response => ({
        ...response,
        data: response.data.map(item => this.mapToAccountReceivable(item))
      }))
    );
  }

  private mapToAccountReceivable(item: any): AccountReceivable {
    return {
      id: item.id,
      cliente_id: typeof item.cliente_id === 'object' ? item.cliente_id.id : item.cliente_id,
      estudiante_id: typeof item.estudiante_id === 'object' ? item.estudiante_id.id : item.estudiante_id,
      monto: item.monto,
      saldo: item.saldo,
      curso: item.curso,
      fecha_limite: item.fecha_limite,
      estado: item.estado,
      // Extraer campos para la UI
      clientName: typeof item.cliente_id === 'object'
        ? `${item.cliente_id.nombre} ${item.cliente_id.apellido}`
        : item.clientName,
      clientEmail: typeof item.cliente_id === 'object'
        ? item.cliente_id.email
        : item.clientEmail,
      studentName: typeof item.estudiante_id === 'object'
        ? `${item.estudiante_id.nombre} ${item.estudiante_id.apellido}`
        : item.studentName,
      createdDate: item.createdDate
    };
  }

  updateAccountReceivable(id: string, accountReceivable: any): Observable<ResponseAPI<any>> {
    return this.http.patch<ResponseAPI<any>>(`${this.apiUrl}/${id}`, accountReceivable);
  }

  deleteAccountReceivable(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }
}
