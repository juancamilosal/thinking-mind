import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseAPI } from '../models/ResponseAPI';
import { environment } from '../../../environments/environment';
import { ProgramaAyo, PrecioProgramaAyo } from '../models/Course';

@Injectable({
  providedIn: 'root'
})
export class ProgramaAyoService {
  private apiUrl: string = environment.programa_ayo;
  private precioUrl: string = environment.precio_programa_ayo;
  private planEstudioUrl: string = environment.plan_estudio;

  constructor(private http: HttpClient) {}

  createPlanEstudio(data: any): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(this.planEstudioUrl, data);
  }

  updatePlanEstudio(id: string | number, data: any): Observable<ResponseAPI<any>> {
    return this.http.patch<ResponseAPI<any>>(`${this.planEstudioUrl}/${id}`, data);
  }

  createProgramaAyo(programaAyo: ProgramaAyo): Observable<ResponseAPI<ProgramaAyo>> {
    return this.http.post<ResponseAPI<ProgramaAyo>>(this.apiUrl, programaAyo);
  }

  getProgramaAyo(idioma?: string, search?: string, userId?: string, teacherId?: string): Observable<ResponseAPI<ProgramaAyo[]>> {
    let params: any = {
      'fields': '*,cuentas_cobrar_id.*,id_nivel.*,id_nivel.estudiantes_id.*,id_reuniones_meet.*,id_reuniones_meet.id_docente.*,id_reuniones_meet.id_cuentas_cobrar.*,img.*,plan_estudio_id.*'
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
    }
    if (userId) {
        params['filter[id_nivel][estudiantes_id][id][_eq]'] = userId;
    }

    // Filter active accounts only (deep filtering)
    params['deep[cuentas_cobrar_id][_filter][programa_finalizado][_eq]'] = false;

    return this.http.get<ResponseAPI<ProgramaAyo[]>>(this.apiUrl, { params });
  }

  getProgramaAyoDocente(teacherId: string, idioma?: string): Observable<ResponseAPI<ProgramaAyo[]>> {
    let params: any = {
      'fields': '*, id_nivel.*, id_reuniones_meet.*,id_nivel.estudiantes_id.*, plan_estudio_id.*'
    };

    if (teacherId) {
      params['deep[id_reuniones_meet][_filter][id_docente][id][_eq]'] = teacherId;
    }

    if (idioma) {
      params['filter[idioma][_eq]'] = idioma;
    }

    params['filter[id_nivel][estudiantes_id][id][_nnull]'] = true;

    return this.http.get<ResponseAPI<ProgramaAyo[]>>(this.apiUrl, {params}).pipe(
      map(response => {
        if (response.data) {
          const filteredData = response.data.filter(programa =>
            programa.id_nivel &&
            programa.id_nivel.estudiantes_id &&
            Array.isArray(programa.id_nivel.estudiantes_id) &&
            programa.id_nivel.estudiantes_id.length > 0
          );
          return { ...response, data: filteredData };
        }
        return response;
      })
    );
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


  getPrecioProgramaAyo(): Observable<ResponseAPI<PrecioProgramaAyo>> {
    const params = {
      'fields': '*'
    };
    return this.http.get<ResponseAPI<PrecioProgramaAyo>>(this.precioUrl, { params }).pipe(
      map((response: any) => {
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
              return { ...response, data: response.data[0] };
          }
          return response;
      })
    );
  }

  updatePrecioProgramaAyo(id: string | number, precioData: Partial<PrecioProgramaAyo>): Observable<ResponseAPI<PrecioProgramaAyo>> {
    return this.http.patch<ResponseAPI<PrecioProgramaAyo>>(`${this.precioUrl}/${id}`, precioData);
  }

  sendNovedad(novedad: string, emails: string[]): Observable<any> {
    return this.http.post<any>(environment.send_novedad, { novedad, emails });
  }
}
