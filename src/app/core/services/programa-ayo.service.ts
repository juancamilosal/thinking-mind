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

  getProgramaAyo(): Observable<ResponseAPI<ProgramaAyo[]>> {
    return this.http.get<ResponseAPI<ProgramaAyo[]>>(this.apiUrl);
  }

  getProgramaAyoById(id: string | number): Observable<ResponseAPI<ProgramaAyo>> {
    return this.http.get<ResponseAPI<ProgramaAyo>>(`${this.apiUrl}/${id}`);
  }

  updateProgramaAyo(id: string | number, programaAyo: Partial<ProgramaAyo>): Observable<ResponseAPI<ProgramaAyo>> {
    return this.http.patch<ResponseAPI<ProgramaAyo>>(`${this.apiUrl}/${id}`, programaAyo);
  }

  deleteProgramaAyo(id: string | number): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }
}
