import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {Student} from '../models/Student';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StudentService {

  apiStudent: string = environment.students;

  constructor(private http: HttpClient) {
  }

  searchStudent(): Observable<ResponseAPI<Student[]>> {

    return this.http.get<ResponseAPI<Student[]>>(this.apiStudent + '?fields=*,acudiente.*');
  }

  searchStudentByDocument(documentType: string, documentNumber: string): Observable<ResponseAPI<Student[]>> {
    const params = {
      'filter[tipo_documento][_eq]': documentType,
      'filter[numero_documento][_eq]': documentNumber
    };
    return this.http.get<ResponseAPI<Student[]>>(this.apiStudent, { params });
  }

  createStudent(student: Student): Observable<ResponseAPI<Student>> {
    return this.http.post<ResponseAPI<Student>>(this.apiStudent, student);
  }

  updateStudent(id: number, student: Student): Observable<ResponseAPI<Student>> {
    return this.http.patch<ResponseAPI<Student>>(`${this.apiStudent}/${id}`, student);
  }
}
