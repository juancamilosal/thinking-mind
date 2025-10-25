import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {ResponseAPI} from '../models/ResponseAPI';


export interface DashboardRectorData {
  cuentas_pagadas: number
  cuentas_pendientes: number
  pines_entregados: number
  total_estudiantes: number
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private dashboardRectorUrl: string = environment.dashboardRector;
  private dashboardSaleUrl: string = environment.dashboardSale;
  private dashboardUrl: string = environment.dashboard;

  constructor(private http: HttpClient) {}

  dashboardRector(): Observable<ResponseAPI<DashboardRectorData>> {
    // Obtener el usuario autenticado del sessionStorage
    const currentUser = sessionStorage.getItem('current_user');
    let userId = '';

    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        userId = user.id || '';
      } catch (error) {
        console.error('Error parsing current_user from sessionStorage:', error);
      }
    }

    // Enviar el userId como parámetro en la petición
    const params = userId ? { userId } : {};

    return this.http.get<ResponseAPI<DashboardRectorData>>(this.dashboardRectorUrl, { params });
  }

  dashboardSale(): Observable<any> {
    // Obtener el usuario autenticado del sessionStorage
    const currentUser = sessionStorage.getItem('current_user');
    let userId = '';

    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        userId = user.id || '';
      } catch (error) {
        console.error('Error parsing current_user from sessionStorage:', error);
      }
    }

    // Enviar el userId como parámetro en la petición
    const params = userId ? { userId } : {};

    return this.http.get<any>(this.dashboardSaleUrl, { params });
  }

  dashboard(): Observable<any> {
    return this.http.get<any>(this.dashboardUrl);
  }
}