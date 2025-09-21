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

  constructor(private http: HttpClient) {}

  getPayments(searchTerm?: string, startDate?: string, endDate?: string): Observable<ResponseAPI<PaymentModel[]>> {
    let params: any = {};

    // Filtro por término de búsqueda
    if (searchTerm && searchTerm.trim()) {
      params['filter[_or][0][pagador][_icontains]'] = searchTerm;
      params['filter[_or][1][numero_transaccion][_icontains]'] = searchTerm;
      params['filter[_or][2][estado][_icontains]'] = searchTerm;
    }

    // Filtro por fecha inicial
    if (startDate) {
      params['filter[fecha_pago][_gte]'] = startDate;
    }

    // Filtro por fecha final
    if (endDate) {
      // Agregar 23:59:59 al final del día para incluir todo el día
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      params['filter[fecha_pago][_lte]'] = endDateTime.toISOString().split('T')[0] + 'T23:59:59';
    }

    // Ordenar por fecha de pago descendente (más reciente primero)
    params['sort'] = '-fecha_pago';

    return this.http.get<ResponseAPI<PaymentModel[]>>(this.apiUrl, { params });
  }

  getPaymentsByAccountId(accountId: string): Observable<ResponseAPI<PaymentModel[]>> {
    const params = {
      'filter[cuenta_cobrar_id][_eq]': accountId
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
    return 'http://directus-s0so4ogscgwg8s0g8k4s0ooo.77.37.96.16.sslip.io';
  }

  getPaymentByTransactionNumber(transactionNumber: string): Observable<ResponseAPI<PaymentModel[]>> {
    const params = {
      'filter[numero_transaccion][_eq]': transactionNumber,
      'fields': '*,cuenta_cobrar_id.*,cuenta_cobrar_id.curso_id.*'
    };
    return this.http.get<ResponseAPI<PaymentModel[]>>(this.apiUrl, { params });
  }
}
