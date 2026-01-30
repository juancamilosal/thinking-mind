import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResponseAPI } from '../models/ResponseAPI';
import {Certification} from '../models/Student';

@Injectable({
  providedIn: 'root'
})
export class CertificacionService {
  private apiUrl = environment.certificados;

  constructor(private http: HttpClient) {}

  getAllCertificados(): Observable<ResponseAPI<Certification[]>> {
    return this.http.get<ResponseAPI<Certification[]>>(this.apiUrl);
  }

  getCertificadoById(id: string): Observable<ResponseAPI<Certification>> {
    return this.http.get<ResponseAPI<Certification>>(`${this.apiUrl}/${id}`);
  }

  createCertificado(data: any): Observable<ResponseAPI<Certification>> {
    return this.http.post<ResponseAPI<Certification>>(this.apiUrl, data);
  }

  updateCertificado(id: string, data: any): Observable<ResponseAPI<Certification>> {
    return this.http.patch<ResponseAPI<Certification>>(`${this.apiUrl}/${id}`, data);
  }

  deleteCertificado(id: string): Observable<ResponseAPI<Certification>> {
    return this.http.delete<ResponseAPI<Certification>>(`${this.apiUrl}/${id}`);
  }

  getCertificatesByStudentId(studentId: string): Observable<ResponseAPI<Certification[]>> {
    const params: any = {
      'filter[estudiante_id][_eq]': studentId,
      'fields': '*, nivel_id.*'
    };
    return this.http.get<ResponseAPI<Certification[]>>(this.apiUrl, { params });
  }
}
