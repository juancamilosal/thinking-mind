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

  getHistorialProgramas(searchTerm?: string, page: number = 1, limit: number = 15): Observable<ResponseAPI<HistorialProgramaItem[]>> {
    const params: any = {
      fields: '*,colegio_id.*,curso_id.*',
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count',
      sort: 'curso_id.nombre'
    };

    if (searchTerm && searchTerm.trim()) {
      params['filter[_or][0][curso_id][nombre][_icontains]'] = searchTerm;
      params['filter[_or][1][colegio_id][nombre][_icontains]'] = searchTerm;
    }

    return this.http.get<ResponseAPI<HistorialProgramaItem[]>>(this.apiHistorial, { params });
  }

  deleteHistorialProgramas(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiHistorial}/${id}`);
  }
}