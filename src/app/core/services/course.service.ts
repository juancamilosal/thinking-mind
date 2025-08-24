import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {Course} from '../models/Course';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class CourseService {
  apiCourse: string = environment.courses;
  apiFile: string = environment.files;

  constructor(private http: HttpClient) {
  }

  searchCourse(searchTerm?: string): Observable<ResponseAPI<Course[]>> {
    if (!searchTerm) {
      return this.http.get<ResponseAPI<Course[]>>(this.apiCourse);
    }

    const params = {
      'filter[_or][0][nombre][_icontains]': searchTerm,
      'filter[_or][1][codigo][_icontains]': searchTerm
    };
    return this.http.get<ResponseAPI<Course[]>>(this.apiCourse, { params });
  }

  createCourse(course: Course): Observable<ResponseAPI<Course>> {
    return this.http.post<ResponseAPI<Course>>(this.apiCourse, course);
  }

  updateCourse(id: number, course: Course): Observable<ResponseAPI<Course>> {
    return this.http.patch<ResponseAPI<Course>>(`${this.apiCourse}/${id}`, course);
  }

  deleteCourse(id: number | undefined): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiCourse}/${id}`);
  }

  uploadFile(file: File): Observable<ResponseAPI<any>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ResponseAPI<any>>(`${this.apiFile}`, formData);
  }
}
