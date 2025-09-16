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
  apiStudentSchool: string = environment.list_student_school;
  constructor(private http: HttpClient) {
  }

  getAllSchools(page: number = 1, limit: number = 15): Observable<ResponseAPI<School[]>> {
    const params = {
      fields: '*,estudiante_id.*,estudiante_id.acudiente.*,estudiante_id.acudiente.cuentas_cobrar.*,rector_id.*',
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
    };
    return this.http.get<ResponseAPI<School[]>>(this.apiSchool, { params });
  }

  searchSchool(searchTerm?: string, page: number = 1, limit: number = 15): Observable<ResponseAPI<School[]>> {
    if (!searchTerm) {
      return this.getAllSchools(page, limit);
    }

    const params: any = {
      fields: '*,estudiante_id.*,estudiante_id.acudiente.*,estudiante_id.acudiente.cuentas_cobrar.*,rector_id.*',
      'filter[_or][0][nombre][_icontains]': searchTerm,
      'filter[_or][1][ciudad][_icontains]': searchTerm,
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
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
}
