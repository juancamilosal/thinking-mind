import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {ResponseAPI} from '../models/ResponseAPI';
import {Menu} from '../models/Menu';

export interface MenuItem {
  id: string;
  nombre: string;
  ruta: string;
  icono?: string;
  alt?: string;
  orden?: number;
  menu_rol?: number[];
}

export interface MenuResponse {
  data: MenuItem[];
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private menuListUrl: string = environment.security.menu.list;

  constructor(private http: HttpClient) {}

  list(): Observable<ResponseAPI<Menu[]>> {
    return this.http.get<ResponseAPI<Menu[]>>(this.menuListUrl);
  }
}