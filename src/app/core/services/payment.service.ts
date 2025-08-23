import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { PaymentRecord } from '../models/AccountReceivable';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl: string = environment.payment; // Asumiendo que el endpoint es 'pagos'

  constructor(private http: HttpClient) {}

  getPayments(): Observable<ResponseAPI<PaymentRecord[]>> {
    return this.http.get<ResponseAPI<PaymentRecord[]>>(this.apiUrl);
  }

  getPaymentsByAccountId(accountId: string): Observable<ResponseAPI<PaymentRecord[]>> {
    const params = {
      'filter[cuanta_cobrar_id][_eq]': accountId
    };
    return this.http.get<ResponseAPI<PaymentRecord[]>>(this.apiUrl, { params });
  }

  createPayment(payment: PaymentRecord): Observable<ResponseAPI<PaymentRecord>> {
    return this.http.post<ResponseAPI<PaymentRecord>>(this.apiUrl, payment);
  }

  updatePayment(id: string, payment: Partial<PaymentRecord>): Observable<ResponseAPI<PaymentRecord>> {
    return this.http.patch<ResponseAPI<PaymentRecord>>(`${this.apiUrl}/${id}`, payment);
  }

  deletePayment(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }
}
