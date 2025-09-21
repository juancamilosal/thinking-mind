import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {ResponseAPI} from '../models/ResponseAPI';
import {environment} from '../../../environments/environment';
import {
  AccountReceivable,
  PaymentReceivable,
  PaymentModel,
  TotalAccounts,
   ReturnAccount
} from '../models/AccountReceivable';

@Injectable({
  providedIn: 'root'
})
export class AccountReceivableService {
  private apiUrl: string = environment.accountsReceivable;
  private apiUrlTotalAccounts = environment.total_accounts
  private apiUrlPaymentReceivable = environment.payment_record;
  private apiUrlReturn = environment.return;
  private apiUrlListSchool = environment.list_student_school;

  constructor(private http: HttpClient) {
  }


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

    // Filtro para fecha_finalizacion mayor a la fecha actual
    const currentDate = new Date().toISOString();
    params['filter[fecha_finalizacion][_gt]'] = currentDate;

    const queryString = Object.keys(params).length > 0 ? '&' + new URLSearchParams(params).toString() : '';
    const url = this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*, estudiante_id.colegio_id.rector_id.*,curso_id.*,pagos.*, comprobante.*' + queryString;

    return this.http.get<ResponseAPI<AccountReceivable[]>>(url).pipe(
      map(response => ({
        ...response,
        data: response.data.map(item => this.mapToAccountReceivable(item))
      }))
    );
  }

  // Método para obtener todas las cuentas sin filtro de fecha (para accounts-receivable)
  getAllAccountsReceivable(searchTerm?: string): Observable<ResponseAPI<AccountReceivable[]>> {
    let params: any = {};

    // Filtro por término de búsqueda si se proporciona
    if (searchTerm) {
      params['filter[_or][0][descripcion][_icontains]'] = searchTerm;
      params['filter[_or][1][numero_factura][_icontains]'] = searchTerm;
    }

    const queryString = Object.keys(params).length > 0 ? '&' + new URLSearchParams(params).toString() : '';
    const url = this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*, estudiante_id.colegio_id.rector_id.*,curso_id.*,pagos.*, comprobante.*' + queryString;

    return this.http.get<ResponseAPI<AccountReceivable[]>>(url).pipe(
      map(response => ({
        ...response,
        data: response.data.map(item => this.mapToAccountReceivable(item))
      }))
    );
  }

  searchAccountReceivableByStatus(status: string): Observable<ResponseAPI<AccountReceivable[]>> {
    const params = {
      'filter[estado][_eq]': status
    };

    const queryString = new URLSearchParams(params).toString();
    const url = this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*,curso_id.*,pagos.*, comprobante.*&' + queryString;

    return this.http.get<ResponseAPI<AccountReceivable[]>>(url).pipe(
      map(response => ({
        ...response,
        data: response.data.map(item => this.mapToAccountReceivable(item))
      }))
    );
  }

  searchAccountReceivableByBalance(balance: number): Observable<ResponseAPI<AccountReceivable[]>> {
    const params = {
      'filter[saldo][_eq]': balance.toString()
    };

    const queryString = new URLSearchParams(params).toString();
    const url = this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*,curso_id.*,pagos.*, comprobante.*&' + queryString;

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
      cliente_id: item.cliente_id, // Preservar el objeto completo
      estudiante_id: item.estudiante_id, // Preservar el objeto completo
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
      createdDate: item.createdDate,
      fecha_inscripcion: item.fecha_inscripcion
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

    return this.http.post<ResponseAPI<any>>(this.apiUrlPaymentReceivable, paymentReceivable);
  }

  //Para el reporte de inscripciones
  getAccountsForReport(startDate?: string, endDate?: string): Observable<ResponseAPI<AccountReceivable[]>> {
    let params: any = {};

    if (startDate && endDate) {
      params['fecha_inicio'] = startDate;
      params['fecha_final'] = endDate;
    }

    return this.http.get<ResponseAPI<any>>(
      this.apiUrlListSchool,
      { params }
    );
  }

  returnAccount(returnAccount: ReturnAccount): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiUrlReturn, returnAccount);
  }
}
