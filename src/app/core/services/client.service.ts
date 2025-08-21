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

  searchClient(searchTerm?: string): Observable<ResponseAPI<Client[]>> {
    if (!searchTerm) {
      return this.http.get<ResponseAPI<Client[]>>(this.apiCliente + '?fields=*,estudiantes.*');
    }

    const params = {
      'filter[_or][0][nombre][_icontains]': searchTerm,
      'filter[_or][1][apellido][_icontains]': searchTerm,
      'filter[_or][2][numero_documento][_icontains]': searchTerm,
      'fields': '*,estudiantes.*'
    };

    return this.http.get<ResponseAPI<Client[]>>(this.apiCliente, { params });
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
