import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResponseAPI } from '../models/ResponseAPI';
import { ProgramaAyo } from '../models/Course';
import { CriterioEvaluacion } from '../models/Evaluation';

@Injectable({
  providedIn: 'root'
})
export class ProgramaAyoService {

  constructor(private http: HttpClient) { }

  getProgramaAyo(idioma?: string, search?: string, userId?: string, teacherId?: string): Observable<ResponseAPI<ProgramaAyo[]>> {
    let params: any = {
      'fields': '*,cuentas_cobrar_id.*,id_nivel.*,id_nivel.estudiantes_id.*,id_nivel.estudiantes_id.asistencia_id.*,id_reuniones_meet.*,id_reuniones_meet.id_docente.*,id_reuniones_meet.id_cuentas_cobrar.*,img.*,plan_estudio_id.*',
      'sort': 'id_nivel.subcategoria'
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
    // Directus doesn't support deep filtering on array relations easily for nested conditions in 'fields'
    // So we'll filter on client side or use a different approach if needed.
    // For now, let's get all and filter.

    return this.http.get<ResponseAPI<ProgramaAyo[]>>(environment.programa_ayo, { params });
  }

  getProgramaAyoById(id: string): Observable<ResponseAPI<ProgramaAyo>> {
    const params = {
      'fields': '*,cuentas_cobrar_id.*,id_nivel.*,id_nivel.estudiantes_id.*,id_reuniones_meet.*,img.*,plan_estudio_id.*'
    };
    return this.http.get<ResponseAPI<ProgramaAyo>>(`${environment.programa_ayo}/${id}`, { params });
  }

  getCriteriosEvaluacion(): Observable<ResponseAPI<CriterioEvaluacion[]>> {
    return this.http.get<ResponseAPI<CriterioEvaluacion[]>>(environment.criterio_evaluacion);
  }

  saveCalificacionDocente(data: any): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(environment.calificacion_docente, data);
  }

  updateProgramaAyo(id: string, data: Partial<ProgramaAyo>): Observable<ResponseAPI<ProgramaAyo>> {
    return this.http.patch<ResponseAPI<ProgramaAyo>>(`${environment.programa_ayo}/${id}`, data);
  }

  createProgramaAyo(data: ProgramaAyo): Observable<ResponseAPI<ProgramaAyo>> {
    return this.http.post<ResponseAPI<ProgramaAyo>>(environment.programa_ayo, data);
  }

  deleteProgramaAyo(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${environment.programa_ayo}/${id}`);
  }

  getPrecioProgramaAyo(): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(environment.precio_programa_ayo);
  }

  getNiveles(): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(environment.nivel);
  }

  getGrados(): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(environment.grado);
  }

  getCertificados(): Observable<ResponseAPI<any>> {
    return this.http.get<ResponseAPI<any>>(environment.certificados);
  }

  getCalificacionesDocente(teacherId: string): Observable<ResponseAPI<any[]>> {
    const params = {
      'filter[docente_id][_eq]': teacherId,
      'fields': '*,criterio_evaluacion_id.id,criterio_evaluacion_id.nombre'
    };
    return this.http.get<ResponseAPI<any[]>>(environment.calificacion_docente, { params });
  }

  getAllCalificacionesDocente(): Observable<ResponseAPI<any[]>> {
    const params = {
      'fields': '*,criterio_evaluacion_id.id,criterio_evaluacion_id.nombre,docente_id.*'
    };
    return this.http.get<ResponseAPI<any[]>>(environment.calificacion_docente, { params });
  }

  getProgramaAyoDocente(teacherId: string, idioma?: string): Observable<ResponseAPI<ProgramaAyo[]>> {
    return this.getProgramaAyo(idioma, undefined, undefined, teacherId);
  }

  updatePlanEstudio(id: string, data: any): Observable<ResponseAPI<any>> {
    return this.http.patch<ResponseAPI<any>>(`${environment.plan_estudio}/${id}`, data);
  }

  createPlanEstudio(data: any): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(environment.plan_estudio, data);
  }

  updatePrecioProgramaAyo(id: string, data: any): Observable<ResponseAPI<any>> {
    return this.http.patch<ResponseAPI<any>>(`${environment.precio_programa_ayo}/${id}`, data);
  }

  createReunionGeneral(data: any): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(environment.reunion_general, data);
  }

  sendNovedad(novedad: string, emails: string[]): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(environment.send_novedad, { novedad, emails });
  }

  notifyAcudientesFlow(emails: string[]): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(environment.notify_acudiente_flow, { emails });
  }
}
