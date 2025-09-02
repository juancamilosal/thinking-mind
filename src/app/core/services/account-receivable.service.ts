import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseAPI } from '../models/ResponseAPI';
import { environment } from '../../../environments/environment';
import {AccountReceivable, PaymentReceivable, PaymentRecord, TotalAccounts} from '../models/AccountReceivable';

@Injectable({
  providedIn: 'root'
})
export class AccountReceivableService {
  private apiUrl: string = environment.accountsReceivable;
  private apiUrlTotalAccounts = environment.total_accounts
  private apiUrlPaymentReceivable = environment.payment_record;
  constructor(private http: HttpClient) {}


  getAccountById(id: string): Observable<ResponseAPI<AccountReceivable>> {
    return this.http.get<ResponseAPI<any>>(`${this.apiUrl}/${id}?fields=*,cliente_id.*,estudiante_id.*,pagos.*,curso_id.*`).pipe(
      map(response => ({
        ...response,
        data: this.mapToAccountReceivable(response.data)
      }))
    );
  }

  createAccountReceivable(accountReceivable: any): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiUrl, accountReceivable);
  }

  searchAccountReceivable(searchTerm?: string, colegioId?: string): Observable<ResponseAPI<AccountReceivable[]>> {
    let params: any = {};

    // Filtro por colegio si se proporciona
    if (colegioId) {
      params['filter[estudiante_id][colegio_id][_eq]'] = colegioId;
    }

    // Filtro por término de búsqueda si se proporciona
    if (searchTerm) {
      params['filter[_or][0][descripcion][_icontains]'] = searchTerm;
      params['filter[_or][1][numero_factura][_icontains]'] = searchTerm;
    }

    const queryString = Object.keys(params).length > 0 ? '&' + new URLSearchParams(params).toString() : '';
    const url = this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*,curso_id.*,pagos.*, comprobante.*' + queryString;

    return this.http.get<ResponseAPI<AccountReceivable[]>>(url).pipe(
      map(response => ({
        ...response,
        data: response.data.map(item => this.mapToAccountReceivable(item))
      }))
    );
  }

  private mapToAccountReceivable(item: any): AccountReceivable {
    return {
      id: item.id,
      cliente_id: (typeof item.cliente_id === 'object' && item.cliente_id !== null) ? item.cliente_id.id : item.cliente_id,
      estudiante_id: (typeof item.estudiante_id === 'object' && item.estudiante_id !== null) ? item.estudiante_id.id : item.estudiante_id,
      monto: item.monto,
      saldo: item.saldo,
      curso_id: item.curso_id,
      fecha_limite: item.fecha_limite,
      estado: item.estado,
      pin_entregado: item.pin_entregado,
      pagos: item.pagos || [],
      clientName: (typeof item.cliente_id === 'object' && item.cliente_id !== null)
        ? `${item.cliente_id.nombre} ${item.cliente_id.apellido}`
        : item.clientName,
      clientEmail: (typeof item.cliente_id === 'object' && item.cliente_id !== null)
        ? item.cliente_id.email
        : item.clientEmail,
      clientPhone: (typeof item.cliente_id === 'object' && item.cliente_id !== null)
        ? item.cliente_id.celular
        : item.clientPhone,
      studentName: (typeof item.estudiante_id === 'object' && item.estudiante_id !== null)
        ? `${item.estudiante_id.nombre} ${item.estudiante_id.apellido}`
        : item.studentName,
      schoolName: (typeof item.estudiante_id === 'object' && item.estudiante_id !== null && item.estudiante_id.colegio_id)
        ? item.estudiante_id.colegio_id.nombre
        : item.schoolName,
      createdDate: item.createdDate
    };
  }

  totalAccounts(): Observable<ResponseAPI<TotalAccounts>> {
    return this.http.get<ResponseAPI<TotalAccounts>>(this.apiUrlTotalAccounts)
  }

  updateAccountReceivable(id: string, accountReceivable: any): Observable<ResponseAPI<any>> {
    return this.http.patch<ResponseAPI<any>>(`${this.apiUrl}/${id}`, accountReceivable);
  }

  deleteAccountReceivable(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }
  createAccountRecord(paymentReceivable: PaymentReceivable): Observable<ResponseAPI<any>> {

    return this.http.post<ResponseAPI<any>>(this.apiUrlPaymentReceivable , paymentReceivable);
  }

  //Para el reporte de inscripciones
  getAccountsForReport(): Observable<ResponseAPI<AccountReceivable[]>> {
  return this.http.get<ResponseAPI<any>>(
    this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*,curso_id.*,pagos.*'
  );
  }
}
