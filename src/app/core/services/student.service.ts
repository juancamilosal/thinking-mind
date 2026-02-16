import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, shareReplay} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {Student} from '../models/Student';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StudentService {

  apiStudent: string = environment.students;
  apiSearchStudentPayment: string = environment.search_student;
  apiRegisterStudentFlow: string = environment.register_student;
  apiDashboardStudent: string = environment.dashboardStudent;
  private dashboardStudentCache$: Observable<any> | null = null;

  constructor(private http: HttpClient) {
  }

  getAllStudents(page: number = 1, limit: number = 15): Observable<ResponseAPI<Student[]>> {
    const params = {
      fields: '*,acudiente.*,colegio_id.*',
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
    };
    return this.http.get<ResponseAPI<Student[]>>(this.apiStudent, { params });
  }

  searchStudent(searchTerm?: string, page: number = 1, limit: number = 15): Observable<ResponseAPI<Student[]>> {
    if (!searchTerm) {
      return this.getAllStudents(page, limit);
    }

    const params: any = {
      fields: '*,acudiente.*,colegio_id.*',
      'filter[_or][0][nombre][_icontains]': searchTerm,
      'filter[_or][1][apellido][_icontains]': searchTerm,
      'filter[_or][2][numero_documento][_icontains]': searchTerm,
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
    };
    return this.http.get<ResponseAPI<Student[]>>(this.apiStudent, { params });
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

  getStudentByEmail(email: string): Observable<ResponseAPI<Student[]>> {
    const params = {
      'filter[email][_eq]': email,
      'fields': '*,acudiente.*,curso_id.*'
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

  verifyStudentRegistration(tipoDocumento: string, numeroDocumento: string, email: string, codigoRegistro: string): Observable<ResponseAPI<Student[]>> {
    const params = {
      'filter[tipo_documento][_eq]': tipoDocumento,
      'filter[numero_documento][_eq]': numeroDocumento,
      'filter[email][_eq]': email,
      'filter[codigo_registro][_eq]': codigoRegistro,
    };
    return this.http.get<ResponseAPI<Student[]>>(this.apiStudent, { params });
  }

  registerStudentFlow(payload: any): Observable<any> {
    return this.http.post<any>(this.apiRegisterStudentFlow, payload);
  }

  dashboardStudent(payload: any): Observable<any> {
    if (this.dashboardStudentCache$) {
      return this.dashboardStudentCache$;
    }
    this.dashboardStudentCache$ = this.http.get<any>(this.apiDashboardStudent, payload).pipe(
      shareReplay(1)
    );
    return this.dashboardStudentCache$;
  }
}
