import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {School} from '../models/Schools';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class SchoolService {
  apiSchool: string = environment.schools;

  constructor(private http: HttpClient) {
  }

  searchSchool(): Observable<ResponseAPI<School[]>> {
    return this.http.get<ResponseAPI<School[]>>(this.apiSchool);
  }

  createSchool(school: School): Observable<ResponseAPI<School>> {
    return this.http.post<ResponseAPI<School>>(this.apiSchool, school);
  }
}
