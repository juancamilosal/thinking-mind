import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {Student} from '../models/Student';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StudentService {

  apiStudent: string = environment.students;
  apiSearchStudentPayment: string = environment.search_student;

  constructor(private http: HttpClient) {
  }

  searchStudent(searchTerm?: string): Observable<ResponseAPI<Student[]>> {
    const baseUrl = this.apiStudent + '?fields=*,acudiente.*,colegio_id.*';

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
      'filter[numero_documento][_eq]': documentNumber,
    };
    return this.http.get<ResponseAPI<Student[]>>(this.apiStudent + '?fields=*,colegio_id.*', { params });
  }

  createStudent(student: Student): Observable<ResponseAPI<Student>> {
    return this.http.post<ResponseAPI<Student>>(this.apiStudent, student);
  }

  updateStudent(id: string | undefined, student: Student): Observable<ResponseAPI<Student>> {
    return this.http.patch<ResponseAPI<Student>>(`${this.apiStudent}/${id}`, student);
  }

  deleteStudent(id: string | undefined): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiStudent}/${id}`);
  }

  searchStudentPayment(documentType: string, documentNumber: string): Observable<ResponseAPI<Student[]>>{
    const params = {
      'tipo_documento': documentType,
      'numero_documento': documentNumber,
    };
    return this.http.get<ResponseAPI<Student[]>>(this.apiSearchStudentPayment , { params });
  }

  getStudentsBySchool(schoolId: string): Observable<ResponseAPI<Student[]>> {
    const params = {
      'filter[colegio_id][_eq]': schoolId,
      'fields': '*,acudiente.*, acudiente.cuentas_cobrar.*, acudiente.cuentas_cobrar.curso_id.*'
    };
    return this.http.get<ResponseAPI<Student[]>>(this.apiStudent, { params });
  }

  getStudentById(id: string): Observable<ResponseAPI<Student>> {
    const params = {
      'fields': '*,acudiente.*, curso_id.*'
    };
    return this.http.get<ResponseAPI<Student>>(`${this.apiStudent}/${id}`, { params });
  }

  getStudentsByCourseId(courseId: string): Observable<ResponseAPI<Student[]>> {
    const params = {
      'filter[acudiente][cuentas_cobrar][curso_id][id][_eq]': courseId,
      'fields': '*,curso_id.*,colegio_id.*,acudiente.cuentas_cobrar.*,acudiente.cuentas_cobrar.pagos.*'
    };
    return this.http.get<ResponseAPI<Student[]>>(this.apiStudent, { params });
  }

  getStudentsByCourseName(courseName: string): Observable<ResponseAPI<Student[]>> {
    const params = {
      'filter[curso_id][nombre][_icontains]': courseName,
      'fields': '*,curso_id.*,colegio_id.*,acudiente.*,acudiente.cuentas_cobrar.*,acudiente.cuentas_cobrar.curso_id.*,acudiente.cuentas_cobrar.pagos.*'
    };
    return this.http.get<ResponseAPI<Student[]>>(this.apiStudent, { params });
  }
}
