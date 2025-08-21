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

  searchStudent(searchTerm?: string): Observable<ResponseAPI<Student[]>> {
    const baseUrl = this.apiStudent + '?fields=*,acudiente.*';

    if (!searchTerm) {
      return this.http.get<ResponseAPI<Student[]>>(baseUrl);
    }

    const params = {
      'filter[_or][0][nombre][_icontains]': searchTerm,
      'filter[_or][1][apellido][_icontains]': searchTerm,
      'filter[_or][2][numero_documento][_icontains]': searchTerm
    };
    return this.http.get<ResponseAPI<Student[]>>(baseUrl, { params });
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

  updateStudent(id: string | undefined, student: Student): Observable<ResponseAPI<Student>> {
    return this.http.patch<ResponseAPI<Student>>(`${this.apiStudent}/${id}`, student);
  }
}
