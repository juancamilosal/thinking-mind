import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { environment } from '../../../environments/environment';
import { ProgramaAyo } from '../models/Course';

@Injectable({
  providedIn: 'root'
})
export class ProgramaAyoService {
  private apiUrl: string = environment.programa_ayo;

  constructor(private http: HttpClient) {}

  createProgramaAyo(programaAyo: ProgramaAyo): Observable<ResponseAPI<ProgramaAyo>> {
    return this.http.post<ResponseAPI<ProgramaAyo>>(this.apiUrl, programaAyo);
  }

  getProgramaAyo(idioma?: string): Observable<ResponseAPI<ProgramaAyo[]>> {
    let params: any = {
      'fields': '*,id_nivel.*,id_reuniones_meet.*,id_reuniones_meet.id_docente.*,id_reuniones_meet.id_cuentas_cobrar.*,img.*'
    };
    if (idioma) {
      params['filter[idioma][_eq]'] = idioma;
    }
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
}
