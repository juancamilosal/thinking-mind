import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResponseAPI } from '../models/ResponseAPI';

@Injectable({
  providedIn: 'root'
})
export class CertificacionService {
  private apiUrl = environment.certificados;

  constructor(private http: HttpClient) {}

  getAllCertificados(): Observable<ResponseAPI<any[]>> {
    return this.http.get<ResponseAPI<any[]>>(this.apiUrl);
  }

  getCertificadoById(id: string): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }

  createCertificado(data: any): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.apiUrl, data);
  }

  updateCertificado(id: string, data: any): Observable<ResponseAPI<any>> {
    return this.http.patch<ResponseAPI<any>>(`${this.apiUrl}/${id}`, data);
  }

  deleteCertificado(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }
}
