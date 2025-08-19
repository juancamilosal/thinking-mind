import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ResponseAPI} from '../models/ResponseAPI';
import {Client} from '../models/Clients';
import {environment} from '../../../environments/envionment';

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

  createClient(client: Client): Observable<ResponseAPI<Client>> {
    return this.http.post<ResponseAPI<Client>>(this.apiCliente, client);
  }
}
