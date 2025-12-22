import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResponseAPI } from '../models/ResponseAPI';
import { Nivel } from '../models/Meeting';

@Injectable({
  providedIn: 'root'
})
export class NivelService {
  private apiUrl: string = environment.nivel;

  constructor(private http: HttpClient) { }

  getNiveles(idioma: string): Observable<ResponseAPI<Nivel[]>> {
    let url = this.apiUrl;
    return this.http.get<ResponseAPI<Nivel[]>>(url + '?filter[idioma][_in]=' + idioma);
  }
}
