import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { environment } from '../../../environments/environment';
import { ProgramaAyo, PrecioProgramaAyo } from '../models/Course';

@Injectable({
  providedIn: 'root'
})
export class ProgramaAyoService {
  private apiUrl: string = environment.programa_ayo;
  private precioUrl: string = environment.precio_programa_ayo;

  constructor(private http: HttpClient) {}

  createProgramaAyo(programaAyo: ProgramaAyo): Observable<ResponseAPI<ProgramaAyo>> {
    return this.http.post<ResponseAPI<ProgramaAyo>>(this.apiUrl, programaAyo);
  }

  getProgramaAyo(idioma?: string, search?: string, userId?: string, teacherId?: string): Observable<ResponseAPI<ProgramaAyo[]>> {
    let params: any = {
      'fields': '*,cuentas_cobrar_id.*,id_nivel.*,id_nivel.estudiantes_id.*,id_reuniones_meet.*,id_reuniones_meet.id_docente.*,id_reuniones_meet.id_cuentas_cobrar.*,img.*'
    };
    if (idioma) {
      params['filter[idioma][_eq]'] = idioma;
    }

    if (search) {
      params['filter[_or][0][id_nivel][tematica][_icontains]'] = search;
      params['filter[_or][1][id_nivel][nivel][_icontains]'] = search;
      params['filter[_or][2][id_nivel][subcategoria][_icontains]'] = search;
    }

    if (teacherId) {
      params['deep[id_reuniones_meet][_filter][id_docente][id][_eq]'] = teacherId;
    if (userId) {
        params['filter[id_nivel][estudiantes_id][id][_eq]'] = userId;
    }

    // Filter active accounts only (deep filtering)
    params['deep[cuentas_cobrar_id][_filter][programa_finalizado][_eq]'] = false;

    return this.http.get<ResponseAPI<ProgramaAyo[]>>(this.apiUrl, { params });
  }

  getProgramaAyoById(id: string | number): Observable<ResponseAPI<ProgramaAyo>> {
    const params = {
      'fields': '*,id_nivel.*,id_reuniones_meet.*,id_reuniones_meet.id_docente.*,id_reuniones_meet.id_cuentas_cobrar.*,img.*'
    };
    return this.http.get<ResponseAPI<ProgramaAyo>>(`${this.apiUrl}/${id}`, { params });
  }

  updateProgramaAyo(id: string | number, programaAyo: Partial<ProgramaAyo>): Observable<ResponseAPI<ProgramaAyo>> {
    return this.http.patch<ResponseAPI<ProgramaAyo>>(`${this.apiUrl}/${id}`, programaAyo);
  }

  deleteProgramaAyo(id: string | number): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }

  // Precio Programa AYO
  getPrecioProgramaAyo(): Observable<ResponseAPI<PrecioProgramaAyo[]>> {
    return this.http.get<ResponseAPI<PrecioProgramaAyo[]>>(this.precioUrl);
  }

  updatePrecioProgramaAyo(id: string, data: Partial<PrecioProgramaAyo>): Observable<ResponseAPI<PrecioProgramaAyo>> {
    return this.http.patch<ResponseAPI<PrecioProgramaAyo>>(`${this.precioUrl}/${id}`, data);
  }
}
