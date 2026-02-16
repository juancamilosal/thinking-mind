import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {ReunionGeneral} from '../models/Meeting';

export interface ResponseAPI<T> {
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class ReunionGeneralService {
  constructor(private http: HttpClient) {}

  list(params?: any): Observable<ResponseAPI<ReunionGeneral[]>> {
    return this.http.get<ResponseAPI<ReunionGeneral[]>>(environment.reunion_general, { params });
  }

  getById(id: string, params?: any): Observable<ResponseAPI<ReunionGeneral>> {
    return this.http.get<ResponseAPI<ReunionGeneral>>(`${environment.reunion_general}/${id}`, { params });
  }

  create(data: Partial<ReunionGeneral>): Observable<ResponseAPI<ReunionGeneral>> {
    return this.http.post<ResponseAPI<ReunionGeneral>>(environment.reunion_general, data);
  }

  update(id: string, data: Partial<ReunionGeneral>): Observable<ResponseAPI<ReunionGeneral>> {
    return this.http.patch<ResponseAPI<ReunionGeneral>>(`${environment.reunion_general}/${id}`, data);
  }

  delete(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${environment.reunion_general}/${id}`);
  }
}

