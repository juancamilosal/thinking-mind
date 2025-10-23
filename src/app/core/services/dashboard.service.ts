import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardRectorData {
  id: string;
  monto: number;
  fecha_limite: string | null;
  saldo: number;
  cliente_id: string;
  estudiante_id: string;
  estado: string;
  observaciones: string | null;
  curso_id: string;
  pin_entregado: string;
  fecha_creacion: string;
  fecha_inscripcion: string | null;
  fecha_finalizacion: string | null;
  descuento: string;
  es_inscripcion: string;
  id_inscripcion: string | null;
  precio_inscripcion: number;
  pagos: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private dashboardRectorUrl: string = environment.dashboardRector;

  constructor(private http: HttpClient) {}

  dashboardRector(): Observable<DashboardRectorData[]> {
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
    
    return this.http.get<DashboardRectorData[]>(this.dashboardRectorUrl, { params });
  }
}