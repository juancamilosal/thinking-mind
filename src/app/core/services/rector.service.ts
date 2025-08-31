import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { Rector } from '../models/Rector';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RectorService {

  apiRector: string = environment.rectores;
  prueba = 'http://directus-s0so4ogscgwg8s0g8k4s0ooo.77.37.96.16.sslip.io/flows/trigger/14eb8a35-324d-4017-a886-cc9263fc69e2'
  constructor(private http: HttpClient) {
  }

  getAllRectores(): Observable<ResponseAPI<Rector[]>> {
    return this.http.get<ResponseAPI<Rector[]>>(this.apiRector + '?fields=*,colegio_id.*');
  }

  searchRector(searchTerm?: string): Observable<ResponseAPI<Rector[]>> {
    if (!searchTerm) {
      return this.http.get<ResponseAPI<Rector[]>>(this.apiRector);
    }

    const params = {
      'filter[_or][0][nombre][_icontains]': searchTerm,
      'filter[_or][1][apellido][_icontains]': searchTerm,
      'filter[_or][2][email][_icontains]': searchTerm
    };

    return this.http.get<ResponseAPI<Rector[]>>(this.apiRector + '?fields=*,colegio_id.*', { params });
  }

  createRector(rector: Rector): Observable<ResponseAPI<Rector>> {
    return this.http.post<ResponseAPI<Rector>>(this.apiRector, rector);
  }

  updateRector(id: number, rector: Rector): Observable<ResponseAPI<Rector>> {
    return this.http.patch<ResponseAPI<Rector>>(`${this.apiRector}/${id}`, rector);
  }

  deleteRector(id: number): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiRector}/${id}`);
  }

  crearRector(rector: Rector): Observable<ResponseAPI<Rector>> {
    return this.http.post<ResponseAPI<Rector>>(this.prueba, rector);
  }
}
