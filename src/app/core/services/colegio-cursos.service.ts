import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { environment } from '../../../environments/environment';

export class ColegioCurso {
  id?: number;
  fecha_finalizacion: string;
  curso_id: number;
  colegio_id: number;
  precio_curso?: number;
  tiene_precio_especial?: string; // "TRUE" | "FALSE"
  precio_especial?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class ColegioCursosService {
  private apiUrl: string = environment.colegio_cursos;

  constructor(private http: HttpClient) {}

  createColegioCurso(colegioCurso: ColegioCurso): Observable<ResponseAPI<ColegioCurso>> {
    return this.http.post<ResponseAPI<ColegioCurso>>(this.apiUrl, colegioCurso);
  }

  getColegioCursos(): Observable<ResponseAPI<ColegioCurso[]>> {
    return this.http.get<ResponseAPI<ColegioCurso[]>>(this.apiUrl);
  }

  getColegioCursoById(id: number): Observable<ResponseAPI<ColegioCurso>> {
    return this.http.get<ResponseAPI<ColegioCurso>>(`${this.apiUrl}/${id}`);
  }

  updateColegioCurso(id: number, colegioCurso: Partial<ColegioCurso>): Observable<ResponseAPI<ColegioCurso>> {
    return this.http.patch<ResponseAPI<ColegioCurso>>(`${this.apiUrl}/${id}`, colegioCurso);
  }

  deleteColegioCurso(id: number): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }
}
