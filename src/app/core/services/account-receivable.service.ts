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
  private apiUrlPaymentRecordAyo = environment.payment_record_ayo;
  private apiUrlReturn = environment.return;
  private apiUrlNewAccountAyo = environment.new_account_ayo;
  private apiUrlListSchool = environment.list_student_school;

  constructor(private http: HttpClient) {
  }


  getAccountById(id: string): Observable<ResponseAPI<AccountReceivable>> {
    return this.http.get<ResponseAPI<any>>(`${this.apiUrl}/${id}?fields=*,cliente_id.*,estudiante_id.*,pagos.*,pagos.responsable.*,curso_id.*`).pipe(
      map(response => ({
        ...response,
        data: this.mapToAccountReceivable(response.data)
      }))
    );
  }

  createAccountReceivable(accountReceivable: any): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiUrl, accountReceivable);
  }

  createPaymentRecordAyo(data: any): Observable<any> {
    return this.http.post(this.apiUrlPaymentRecordAyo, data);
  }

  newAccountAyo(tipo_documento: string[], numero_documento: string[]): Observable<any> {
    return this.http.post(this.apiUrlNewAccountAyo, { tipo_documento, numero_documento });
  }

  getAllAccountsReceivable(page: number = 1, limit: number = 10, searchTerm?: string): Observable<ResponseAPI<AccountReceivable[]>> {
    let params: any = {
      page: page.toString(),
      limit: limit.toString(),
      meta: 'filter_count'
    };

    // Filtro por término de búsqueda si se proporciona
    if (searchTerm) {
      const searchTerms = searchTerm.trim().split(/\s+/);

      if (searchTerms.length === 1) {
        // Búsqueda de una sola palabra - usar OR entre campos
        const term = searchTerms[0];
        params['filter[_or][0][cliente_id][nombre][_icontains]'] = term;
        params['filter[_or][1][cliente_id][apellido][_icontains]'] = term;
        params['filter[_or][2][cliente_id][numero_documento][_icontains]'] = term;
        params['filter[_or][3][estudiante_id][nombre][_icontains]'] = term;
        params['filter[_or][4][estudiante_id][apellido][_icontains]'] = term;
      } else {
        // Búsqueda de múltiples palabras - cada palabra debe estar presente
        searchTerms.forEach((term: string, index: number) => {
          if (term.length > 0) {
            // Cada término debe aparecer en al menos uno de los campos (OR entre campos, AND entre términos)
            params[`filter[_and][${index}][_or][0][cliente_id][nombre][_icontains]`] = term;
            params[`filter[_and][${index}][_or][1][cliente_id][apellido][_icontains]`] = term;
            params[`filter[_and][${index}][_or][2][cliente_id][numero_documento][_icontains]`] = term;
            params[`filter[_and][${index}][_or][3][estudiante_id][nombre][_icontains]`] = term;
            params[`filter[_and][${index}][_or][4][estudiante_id][apellido][_icontains]`] = term;
          }
        });
      }
    }

    const queryString = new URLSearchParams(params).toString();
    const url = this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*, estudiante_id.colegio_id.rector_id.*,curso_id.*,pagos.*,pagos.responsable.*, comprobante.*&' + queryString;

    return this.http.get<ResponseAPI<AccountReceivable[]>>(url).pipe(
      map(response => ({
        ...response,
        data: response.data.map(item => this.mapToAccountReceivable(item))
      }))
    );
  }

  getAccountsByDocument(tipoDocumento: string, numeroDocumento: string): Observable<ResponseAPI<AccountReceivable[]>> {
    const params: any = {
      'filter[es_programa_ayo][_eq]': true,
      'filter[estado][_eq]': "PAGADA",
      'filter[estudiante_id][tipo_documento][_eq]': tipoDocumento,
      'filter[estudiante_id][numero_documento][_eq]': numeroDocumento,
      'filter[programa_ayo_id][_nnull]': true,
      'fields': '*,programa_ayo_id.*,programa_ayo_id.img.*,programa_ayo_id.id_nivel.*,programa_ayo_id.id_reuniones_meet.*,programa_ayo_id.id_reuniones_meet.id_docente.*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*,estudiante_id.colegio_id.rector_id.*,curso_id.*,pagos.*,pagos.responsable.*,comprobante.*'
    };
    return this.http.get<ResponseAPI<AccountReceivable[]>>(this.apiUrl, { params })
  }

  getFilteredAccountsReceivable(filterParams: any): Observable<ResponseAPI<AccountReceivable[]>> {
    let params: any = {
      page: filterParams.page?.toString() || '1',
      limit: filterParams.limit?.toString() || '10',
      meta: 'total_count,filter_count'
    };

    if (filterParams.sort) {
      params['sort'] = filterParams.sort;
    }

    // Filtro por búsqueda general (nombre, apellido, documento)
    if (filterParams.search) {
      const searchTerms = filterParams.search.trim().split(/\s+/);

      if (searchTerms.length === 1) {
        // Búsqueda de una sola palabra - usar OR entre campos
        const term = searchTerms[0];
        params['filter[_or][0][cliente_id][nombre][_icontains]'] = term;
        params['filter[_or][1][cliente_id][apellido][_icontains]'] = term;
        params['filter[_or][2][cliente_id][numero_documento][_icontains]'] = term;
        params['filter[_or][3][estudiante_id][nombre][_icontains]'] = term;
        params['filter[_or][4][estudiante_id][apellido][_icontains]'] = term;
      } else {
        // Búsqueda de múltiples palabras - cada palabra debe estar presente
        searchTerms.forEach((term: string, index: number) => {
          if (term.length > 0) {
            // Cada término debe aparecer en al menos uno de los campos (OR entre campos, AND entre términos)
            params[`filter[_and][${index}][_or][0][cliente_id][nombre][_icontains]`] = term;
            params[`filter[_and][${index}][_or][1][cliente_id][apellido][_icontains]`] = term;
            params[`filter[_and][${index}][_or][2][cliente_id][numero_documento][_icontains]`] = term;
            params[`filter[_and][${index}][_or][3][estudiante_id][nombre][_icontains]`] = term;
            params[`filter[_and][${index}][_or][4][estudiante_id][apellido][_icontains]`] = term;
          }
        });
      }
    }

    // Filtro por colegio
    if (filterParams.colegio) {
      params['filter[estudiante_id][colegio_id][nombre][_icontains]'] = filterParams.colegio;
    }

    // Filtro por fecha de finalización
    if (filterParams.fecha_finalizacion) {
      params['filter[fecha_finalizacion][_eq]'] = filterParams.fecha_finalizacion;
    }

    // Filtro por estado
    if (filterParams.estado) {
      if (filterParams.estado === 'SALDO_0') {
        params['filter[saldo][_eq]'] = '0';
      } else {
        params['filter[estado][_eq]'] = filterParams.estado;
      }
    }

    const queryString = new URLSearchParams(params).toString();
    const url = this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*, estudiante_id.colegio_id.rector_id.*,curso_id.*,pagos.*,pagos.responsable.*, comprobante.*&' + queryString;

    return this.http.get<ResponseAPI<AccountReceivable[]>>(url).pipe(
      map(response => ({
        ...response,
        data: response.data?.map(item => this.mapToAccountReceivable(item)) || []
      }))
    );
  }

  searchAccountReceivable(page: number = 1, limit: number = 10, searchTerm?: string, colegioId?: string): Observable<ResponseAPI<AccountReceivable[]>> {
    let params: any = {
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
    };

    // Filtro por colegio si se proporciona
    if (colegioId) {
      params['filter[estudiante_id][colegio_id][id][_eq]'] = colegioId;
    }

    // Filtro por término de búsqueda si se proporciona
    if (searchTerm) {
      const searchTerms = searchTerm.trim().split(/\s+/);

      if (searchTerms.length === 1) {
        // Búsqueda de una sola palabra - usar OR entre campos
        const term = searchTerms[0];
        params['filter[_or][0][cliente_id][nombre][_icontains]'] = term;
        params['filter[_or][1][cliente_id][apellido][_icontains]'] = term;
        params['filter[_or][2][cliente_id][numero_documento][_icontains]'] = term;
        params['filter[_or][3][estudiante_id][nombre][_icontains]'] = term;
        params['filter[_or][4][estudiante_id][apellido][_icontains]'] = term;
      } else {
        // Búsqueda de múltiples palabras - cada palabra debe estar presente
        searchTerms.forEach((term: string, index: number) => {
          if (term.length > 0) {
            // Cada término debe aparecer en al menos uno de los campos (OR entre campos, AND entre términos)
            params[`filter[_and][${index}][_or][0][cliente_id][nombre][_icontains]`] = term;
            params[`filter[_and][${index}][_or][1][cliente_id][apellido][_icontains]`] = term;
            params[`filter[_and][${index}][_or][2][cliente_id][numero_documento][_icontains]`] = term;
            params[`filter[_and][${index}][_or][3][estudiante_id][nombre][_icontains]`] = term;
            params[`filter[_and][${index}][_or][4][estudiante_id][apellido][_icontains]`] = term;
          }
        });
      }
    }

    // Solo cuentas de curso (no inscripción)
    params['filter[es_inscripcion][_eq]'] = 'FALSE';

    const queryString = new URLSearchParams(params).toString();
    const baseFields = '*,id,monto,saldo,estado,fecha_finalizacion,es_inscripcion,id_inscripcion.*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*,estudiante_id.colegio_id.rector_id.*,curso_id.*,pagos.*';
    const url = this.apiUrl + `?fields=${baseFields}&` + queryString;

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
    const url = this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*,curso_id.*,pagos.*,pagos.responsable.*, comprobante.*&' + queryString;

    return this.http.get<ResponseAPI<AccountReceivable[]>>(url).pipe(
      map(response => ({
        ...response,
        data: response.data.map(item => this.mapToAccountReceivable(item))
      }))
    );
  }

  searchAccountReceivableByStatusWithPagination(
    status: string,
    page: number = 1,
    limit: number = 10,
    searchTerm?: string,
    colegioId?: string
  ): Observable<ResponseAPI<AccountReceivable[]>> {
    let params: any = {
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
    };

    // Filtro por estado
    if (status === 'zero') {
      params['filter[saldo][_eq]'] = '0';
    } else {
      // Mapear los estados del frontend a los valores de la base de datos
      let dbStatus = status;
      switch (status) {
        case 'pending':
          dbStatus = 'PENDIENTE';
          break;
        case 'paid':
          dbStatus = 'PAGADA';
          break;
        case 'refund':
          dbStatus = 'DEVOLUCION';
          break;
      }
      params['filter[estado][_eq]'] = dbStatus;
    }

    // Filtro por colegio si se proporciona
    if (colegioId) {
      params['filter[estudiante_id][colegio_id][_eq]'] = colegioId;
    }

    // Filtro por término de búsqueda si se proporciona
    if (searchTerm) {
      const searchTerms = searchTerm.trim().split(/\s+/);

      if (searchTerms.length === 1) {
        // Búsqueda de una sola palabra - usar OR entre campos
        const term = searchTerms[0];
        params['filter[_or][0][cliente_id][nombre][_icontains]'] = term;
        params['filter[_or][1][cliente_id][apellido][_icontains]'] = term;
        params['filter[_or][2][cliente_id][numero_documento][_icontains]'] = term;
        params['filter[_or][3][estudiante_id][nombre][_icontains]'] = term;
        params['filter[_or][4][estudiante_id][apellido][_icontains]'] = term;
      } else {
        // Búsqueda de múltiples palabras - cada palabra debe estar presente
        searchTerms.forEach((term: string, index: number) => {
          if (term.length > 0) {
            // Cada término debe aparecer en al menos uno de los campos (OR entre campos, AND entre términos)
            params[`filter[_and][${index}][_or][0][cliente_id][nombre][_icontains]`] = term;
            params[`filter[_and][${index}][_or][1][cliente_id][apellido][_icontains]`] = term;
            params[`filter[_and][${index}][_or][2][cliente_id][numero_documento][_icontains]`] = term;
            params[`filter[_and][${index}][_or][3][estudiante_id][nombre][_icontains]`] = term;
            params[`filter[_and][${index}][_or][4][estudiante_id][apellido][_icontains]`] = term;
          }
        });
      }
    }

    const queryString = new URLSearchParams(params).toString();
    const url = this.apiUrl + '?fields=*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*, estudiante_id.colegio_id.rector_id.*,curso_id.*,pagos.*, comprobante.*&' + queryString;

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
      fecha_finalizacion: item.fecha_finalizacion, // Agregar mapeo de fecha_finalizacion
      estado: item.estado,
      pin_entregado: item.pin_entregado,
      es_inscripcion: item.es_inscripcion,
      pagos: item.pagos || [],
      descuento: item.descuento || 0, // Mapear el campo descuento
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
      fecha_inscripcion: item.fecha_inscripcion,
      id_inscripcion: item.id_inscripcion ?? null
    };
  }

  totalAccounts(colegioId?: string): Observable<ResponseAPI<TotalAccounts>> {
    let url = this.apiUrlTotalAccounts;

    if (colegioId) {
      const params = new URLSearchParams({
        'filter[estudiante_id][colegio_id][_eq]': colegioId
      });
      url += '?' + params.toString();
    }

    return this.http.get<ResponseAPI<TotalAccounts>>(url);
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
