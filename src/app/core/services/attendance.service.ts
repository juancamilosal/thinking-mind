import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResponseAPI } from '../models/ResponseAPI';
import { Attendance } from '../models/Attendance';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private apiUrl: string = environment.attendance;

  constructor(private http: HttpClient) {}

  getAttendances(page: number = 1, limit: number = 10, search?: string): Observable<ResponseAPI<Attendance[]>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('meta', '*');

    if (search) {
        params = params.set('search', search);
    }

    return this.http.get<ResponseAPI<Attendance[]>>(this.apiUrl, { params });
  }

  getAttendanceById(id: string): Observable<ResponseAPI<Attendance>> {
    return this.http.get<ResponseAPI<Attendance>>(`${this.apiUrl}/${id}`);
  }

  createAttendance(data: Partial<Attendance>): Observable<ResponseAPI<Attendance>> {
    return this.http.post<ResponseAPI<Attendance>>(this.apiUrl, data);
  }

  updateAttendance(id: string, data: Partial<Attendance>): Observable<ResponseAPI<Attendance>> {
    return this.http.patch<ResponseAPI<Attendance>>(`${this.apiUrl}/${id}`, data);
  }

  deleteAttendance(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
