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

  getNiveles(idiomas?: string[]): Observable<ResponseAPI<Nivel[]>> {
    let url = this.apiUrl;
    const params: string[] = [];
    
    if (idiomas && idiomas.length > 0) {
      const filterValue = idiomas.join(',');
      params.push(`filter[idioma][_in]=${encodeURIComponent(filterValue)}`);
    }
    
    params.push('sort=subcategoria');
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    return this.http.get<ResponseAPI<Nivel[]>>(url);
  }
}
