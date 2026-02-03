import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {ResponseAPI} from '../models/ResponseAPI';
import { StorageServices } from './storage.services';


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
  private dashboardTeacherUrl: string = environment.dashboardTeacher;
  private dashboardUrl: string = environment.dashboard;

  constructor(private http: HttpClient) {}

  dashboardTeacher(): Observable<any> {
    const user = StorageServices.getCurrentUser();
    let userId = '';
    let role = '';

    if (user) {
        userId = user.id || '';
        role = user.role || '';
    }

    if (role === 'fe83d2f3-1b89-477d-984a-de3b56e12001') {
      const params = userId ? { userId } : {};
      return this.http.get<any>(this.dashboardTeacherUrl, { params });
    }

    return new Observable(observer => {
      observer.next(null);
      observer.complete();
    });
  }

  dashboardRector(): Observable<ResponseAPI<DashboardRectorData>> {
    // Obtener el usuario autenticado del sessionStorage
    const user = StorageServices.getCurrentUser();
    let userId = '';

    if (user) {
        userId = user.id || '';
    }

    // Enviar el userId como parámetro en la petición
    const params = userId ? { userId } : {};

    return this.http.get<ResponseAPI<DashboardRectorData>>(this.dashboardRectorUrl, { params });
  }

  dashboardSale(): Observable<any> {
    // Obtener el usuario autenticado del sessionStorage
    const user = StorageServices.getCurrentUser();
    let userId = '';

    if (user) {
        userId = user.id || '';
    }

    // Enviar el userId como parámetro en la petición
    const params = userId ? { userId } : {};

    return this.http.get<any>(this.dashboardSaleUrl, { params });
  }

  dashboard(): Observable<any> {
    return this.http.get<any>(this.dashboardUrl);
  }
}