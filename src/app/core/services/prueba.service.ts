import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PruebaService {
  private apiUrl: string = environment.resultado_test;

  constructor(private http: HttpClient) {}

  triggerPrueba(ids: any[]): Observable<any> {
    return this.http.post<any>(this.apiUrl, { ids });
  }
}
