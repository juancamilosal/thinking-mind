import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface HistorialProgramaItem {
  id: string;
  colegio_id: {
    id: string;
    nombre?: string;
    ciudad?: string;
    direccion?: string;
    celular?: string;
  } | string;
  curso_id: string | { id: string; nombre?: string; sku?: string };
  fecha_finalizacion: string;
  id_colegios_cursos: string[];
  precio_curso: number;
}

interface ResponseAPI<T> {
  data: T;
  meta?: any;
}

@Injectable({ providedIn: 'root' })
export class HistorialProgramasService {
  private apiHistorial = environment.historial_programas;

  constructor(private http: HttpClient) {}

  getHistorialProgramas(): Observable<ResponseAPI<HistorialProgramaItem[]>> {
    const params = {
      fields: '*,colegio_id.*,curso_id.*'
    };
    return this.http.get<ResponseAPI<HistorialProgramaItem[]>>(this.apiHistorial, { params });
  }

  deleteHistorialProgramas(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiHistorial}/${id}`);
  }
}