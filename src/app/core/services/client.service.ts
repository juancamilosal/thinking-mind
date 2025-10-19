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

  apiCliente: string = environment.clients;
  apiSearchClientPayment: string = environment.search_cliente;

  constructor(private http: HttpClient) {
  }

  getAllClients(page: number = 1, limit: number = 15): Observable<ResponseAPI<Client[]>> {
    const params = {
      fields: '*,estudiantes.*,estudiantes.colegio_id.*',
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
    };
    return this.http.get<ResponseAPI<Client[]>>(this.apiCliente, { params });
  }

  searchClient(searchTerm?: string, page: number = 1, limit: number = 15): Observable<ResponseAPI<Client[]>> {
    if (!searchTerm) {
      return this.getAllClients(page, limit);
    }

    const params: any = {
      fields: '*,estudiantes.*,estudiantes.colegio_id.*',
      'filter[_or][0][nombre][_icontains]': searchTerm,
      'filter[_or][1][apellido][_icontains]': searchTerm,
      'filter[_or][2][numero_documento][_icontains]': searchTerm,
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
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

  deleteClient(id: number | undefined): Observable<ResponseAPI<Client>> {
    return this.http.delete<ResponseAPI<Client>>(`${this.apiCliente}/${id}`);
  }

  searchClientPayment(documentType: string, documentNumber: string): Observable<ResponseAPI<Client[]>>{
    const params = {
      'tipo_documento': documentType,
      'numero_documento': documentNumber,
    };
    return this.http.get<ResponseAPI<Client[]>>(this.apiSearchClientPayment , { params });
  }
}
