import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {Client} from '../models/Clients';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClientService {

  apiCliente: string = environment.clients

  constructor(private http: HttpClient) {
  }

  searchClient(): Observable<ResponseAPI<Client[]>> {
    return this.http.get<ResponseAPI<Client[]>>(this.apiCliente);
  }

  searchClientByDocument(documentType: string, documentNumber: string): Observable<ResponseAPI<Client[]>> {
    const params = {
      'filter[tipo_documento][_eq]': documentType,
      'filter[numero_documento][_eq]': documentNumber
    };
    return this.http.get<ResponseAPI<Client[]>>(this.apiCliente, { params });
  }

  createClient(client: Client): Observable<ResponseAPI<Client>> {
    return this.http.post<ResponseAPI<Client>>(this.apiCliente, client);
  }

  updateClient(id: number, client: Client): Observable<ResponseAPI<Client>> {
    return this.http.patch<ResponseAPI<Client>>(`${this.apiCliente}/${id}`, client);
  }
}
