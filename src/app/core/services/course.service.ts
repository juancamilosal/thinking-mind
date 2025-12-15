import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { Course } from '../models/Course';
import { Meeting } from '../models/Meeting';
import { environment } from '../../../environments/environment';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})

export class CourseService {
  apiCourse: string = environment.courses;
  private apiUrlAssets = environment.assets;
  apiFile: string = environment.files;

  constructor(private http: HttpClient) {
  }

  searchCourse(searchTerm?: string): Observable<ResponseAPI<Course[]>> {
    // Agregar fields para incluir colegios_cursos con colegio_id expandido
    const baseParams = {
      'fields': '*,colegios_cursos.*,colegios_cursos.colegio_id.*,colegios_cursos.id_reuniones_meet.*'
    };

    const request = !searchTerm
      ? this.http.get<ResponseAPI<Course[]>>(this.apiCourse, { params: baseParams })
      : this.http.get<ResponseAPI<Course[]>>(this.apiCourse, {
        params: {
          ...baseParams,
          'filter[_or][0][nombre][_icontains]': searchTerm,
          'filter[_or][1][sku][_icontains]': searchTerm,
        }
      });

    return request.pipe(
      map(response => {
        if (response.data) {
          response.data = response.data.map(course => ({
            ...course,
            img_url: course.img ? `${this.apiUrlAssets}/${course.img}` : undefined
          }));
        }
        return response;
      })
    );
  }

  searchIndependentCourses(searchTerm?: string): Observable<ResponseAPI<Course[]>> {
    // Parámetros base con fields y filtro para programa_independiente = true
    const baseParams = {
      'fields': '*,colegios_cursos.*,colegios_cursos.colegio_id.*,colegios_cursos.id_reuniones_meet.*',
      'filter[programa_independiente][_eq]': 'true'
    };

    const request = !searchTerm
      ? this.http.get<ResponseAPI<Course[]>>(this.apiCourse, { params: baseParams })
      : this.http.get<ResponseAPI<Course[]>>(this.apiCourse, {
        params: {
          ...baseParams,
          'filter[_and][0][programa_independiente][_eq]': 'true',
          'filter[_and][1][_or][0][nombre][_icontains]': searchTerm,
          'filter[_and][1][_or][1][sku][_icontains]': searchTerm,
        }
      });

    return request.pipe(
      map(response => {
        if (response.data) {
          response.data = response.data.map(course => ({
            ...course,
            img_url: course.img ? `${this.apiUrlAssets}/${course.img}` : undefined
          }));
        }
        return response;
      })
    );
  }

  getCourseById(id: string): Observable<ResponseAPI<Course>> {
    return this.http.get<ResponseAPI<Course>>(`${this.apiCourse}/${id}`);
  }

  getCourseByIdFiltered(id: string): Observable<ResponseAPI<Course[]>> {
    const baseParams = {
      'fields': '*,colegios_cursos.*,colegios_cursos.colegio_id.*,colegios_cursos.id_reuniones_meet.*',
      'filter[id][_eq]': id
    };

    return this.http.get<ResponseAPI<Course[]>>(this.apiCourse, { params: baseParams }).pipe(
      map(response => {
        if (response.data) {
          response.data = response.data.map(course => ({
            ...course,
            img_url: course.img ? `${this.apiUrlAssets}/${course.img}` : undefined
          }));
        }
        return response;
      })
    );
  }

  createCourse(course: Course): Observable<ResponseAPI<Course>> {
    return this.http.post<ResponseAPI<Course>>(this.apiCourse, course);
  }

  updateCourse(id: string, course: any): Observable<ResponseAPI<Course>> {
    return this.http.patch<ResponseAPI<Course>>(`${this.apiCourse}/${id}`, course);
  }

  deleteCourse(id: string | undefined): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiCourse}/${id}`);
  }

  uploadFile(file: File): Observable<ResponseAPI<any>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ResponseAPI<any>>(`${this.apiFile}`, formData);
  }

  deleteFile(fileId: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiFile}/${fileId}`);
  }

  createReunionMeet(data: any): Observable<ResponseAPI<any>> {
    return this.http.post<ResponseAPI<any>>(environment.reuniones_meet, data);
  }

  updateReunionMeet(id: string, data: any): Observable<ResponseAPI<any>> {
    return this.http.patch<ResponseAPI<any>>(`${environment.reuniones_meet}/${id}`, data);
  }

  getReunionesMeet(): Observable<ResponseAPI<Meeting[]>> {
    const params = {
      'fields': '*,id_colegios_cursos.curso_id.nombre,id_colegios_cursos.colegio_id.nombre'
    };
    return this.http.get<ResponseAPI<Meeting[]>>(environment.reuniones_meet, { params });
  }

  deleteReunionMeet(id: string): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${environment.reuniones_meet}/${id}`);
  }
}
