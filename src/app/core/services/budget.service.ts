import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import {environment} from '../../../environments/environment';
import {Budget} from '../models/Budget';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  getApiUrl = environment.getBudget;
  apiUrl = environment.budget

  constructor(private http: HttpClient) {}

  getBudget(anio?: number, presupuesto?: number, id?: string): Observable<ResponseAPI<Budget>> {
    let params = new HttpParams();

    if (anio) params = params.set('anio', anio);
    if (presupuesto) params = params.set('presupuesto', presupuesto);
    if (id) params = params.set('id', id);

    return this.http.get<ResponseAPI<Budget>>(this.getApiUrl, { params });
  }


  getBudgets(): Observable<ResponseAPI<Budget[]>> {
    return this.http.get<ResponseAPI<Budget[]>>(this.apiUrl);
  }

  createBudget(budget: { anio: string; monto_meta: number }): Observable<ResponseAPI<Budget>> {
    return this.http.post<ResponseAPI<Budget>>(this.apiUrl, budget);
  }

}
