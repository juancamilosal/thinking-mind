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

  constructor(private http: HttpClient) {
  }

  searchSchool(searchTerm?: string): Observable<ResponseAPI<School[]>> {
    if (!searchTerm) {
      return this.http.get<ResponseAPI<School[]>>(this.apiSchool);
    }
    
    const params = {
      'filter[_or][0][nombre][_icontains]': searchTerm,
      'filter[_or][1][ciudad][_icontains]': searchTerm,
      'filter[_or][2][nombre_rector][_icontains]': searchTerm
    };
    return this.http.get<ResponseAPI<School[]>>(this.apiSchool, { params });
  }

  createSchool(school: School): Observable<ResponseAPI<School>> {
    return this.http.post<ResponseAPI<School>>(this.apiSchool, school);
  }
}
