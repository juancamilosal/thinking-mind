import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {School} from '../models/School';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class SchoolService {
  apiSchool: string = environment.schools;

  constructor(private http: HttpClient) {
  }

  getAllSchools(): Observable<ResponseAPI<School[]>> {
    return this.http.get<ResponseAPI<School[]>>(this.apiSchool + '?fields=*,estudiante_id.*,estudiante_id.acudiente.*,estudiante_id.acudiente.cuentas_cobrar.*,rector_id.*');
  }

  searchSchool(searchTerm?: string): Observable<ResponseAPI<School[]>> {
    if (!searchTerm) {
      return this.getAllSchools();
    }

    const params = {
      'filter[_or][0][nombre][_icontains]': searchTerm,
      'filter[_or][1][ciudad][_icontains]': searchTerm,
      'filter[_or][2][nombre_rector][_icontains]': searchTerm
    };
    return this.http.get<ResponseAPI<School[]>>(this.apiSchool, { params });
  }

  createSchool(school: School): Observable<ResponseAPI<School>> {
    return this.http.post<ResponseAPI<School>>(this.apiSchool, school);
  }

  updateSchool(id: string, school: any): Observable<ResponseAPI<School>> {
    return this.http.patch<ResponseAPI<School>>(`${this.apiSchool}/${id}`, school);
  }

  deleteSchool(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiSchool}/${id}`);
  }

  getSchoolById(id: string): Observable<ResponseAPI<School>> {
    return this.http.get<ResponseAPI<School>>(`${this.apiSchool}/${id}?fields=*,rector_id.*,estudiante_id.*,estudiante_id.acudiente.*,estudiante_id.acudiente.cuentas_cobrar.*,estudiante_id.acudiente.cuentas_cobrar.curso_id.*,estudiante_id.curso_id.*`);
  }

  getSchoolsByRectorId(rectorId: string): Observable<ResponseAPI<School[]>> {
    const params = {
      'filter[rector_id][_eq]': rectorId,
      'fields': '*,estudiante_id.*,estudiante_id.acudiente.*,estudiante_id.acudiente.cuentas_cobrar.*,rector_id.*'
    };
    return this.http.get<ResponseAPI<School[]>>(this.apiSchool, { params });
  }
}
