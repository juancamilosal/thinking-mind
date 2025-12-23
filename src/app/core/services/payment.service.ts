import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { PaymentModel } from '../models/AccountReceivable';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl: string = environment.payment;
  private manualPayment: string = environment.manual_payment;
  private total: string =  environment.total_payment;

  constructor(private http: HttpClient) {}

  getPayments(page: number = 1, limit: number = 10, searchTerm?: string, startDate?: string, endDate?: string): Observable<ResponseAPI<PaymentModel[]>> {
    let params: any = {
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count',
      fields: '*,responsable.*'
    };

    // Filtro por término de búsqueda
    if (searchTerm && searchTerm.trim()) {
      params['filter[_or][0][pagador][_icontains]'] = searchTerm;
      params['filter[_or][1][numero_transaccion][_icontains]'] = searchTerm;
      params['filter[_or][2][estado][_icontains]'] = searchTerm;
    }

    // Filtro por fecha inicial - Directus maneja el filtro
    if (startDate) {
      // Formato YYYY-MM-DD para el inicio del día
      params['filter[fecha_pago][_gte]'] = startDate + 'T00:00:00';
    }

    // Filtro por fecha final - Directus maneja el filtro
    if (endDate) {
      // Formato YYYY-MM-DD para el final del día
      params['filter[fecha_pago][_lte]'] = endDate + 'T23:59:59';
    }

    // Remover filtro de estado para mostrar todos los pagos en la tabla
    // params['filter[estado][_eq]'] = 'PAGADO';

    // Log de la URL completa que se enviará a Directus
    const queryString = new URLSearchParams(params).toString();
    // Ordenar por fecha de pago descendente (más reciente primero)
    params['sort'] = '-fecha_pago';

    return this.http.get<ResponseAPI<PaymentModel[]>>(this.apiUrl, { params });
  }

  getPaymentsByAccountId(accountId: string): Observable<ResponseAPI<PaymentModel[]>> {
    const params = {
      'filter[cuenta_cobrar_id][_eq]': accountId,
      'fields': '*,responsable.*'
    };
    return this.http.get<ResponseAPI<PaymentModel[]>>(this.apiUrl, { params });
  }

  createPayment(payment: PaymentModel ): Observable<ResponseAPI<PaymentModel>> {
    return this.http.post<ResponseAPI<PaymentModel>>(this.manualPayment, payment);
  }

  updatePayment(id: string, payment: Partial<PaymentModel>): Observable<ResponseAPI<PaymentModel>> {
    return this.http.patch<ResponseAPI<PaymentModel>>(`${this.apiUrl}/${id}`, payment);
  }

  deletePayment(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }

  uploadFile(formData: FormData): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(environment.files, formData);
  }

  getDirectusUrl(): string {
    return 'https://api.appthinkingmind.com';
  }

  getPaymentByTransactionNumber(transactionNumber: string): Observable<ResponseAPI<PaymentModel[]>> {
    const params = {
      'filter[numero_transaccion][_eq]': transactionNumber,
      'fields': '*,cuenta_cobrar_id.*,cuenta_cobrar_id.curso_id.*'
    };
    return this.http.get<ResponseAPI<PaymentModel[]>>(this.apiUrl, { params });
  }

  totalPayment(): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(this.total);
  }
}
