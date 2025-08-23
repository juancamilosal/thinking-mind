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
}
