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

  list(role?: string): Observable<ResponseAPI<Menu[]>> {
    let url = this.menuListUrl;
    const ayoRoles = [
      'ca8ffc29-c040-439f-8017-0dcb141f0fd3',
      'fe83d2f3-1b89-477d-984a-de3b56e12001'
    ];

    if (role && ayoRoles.includes(role)) {
      url += '&filter[menu_ayo][_eq]=true';
    } else {
      url += '&filter[_or][0][menu_ayo][_neq]=true&filter[_or][1][nombre][_eq]=Dashboard';
    }

    return this.http.get<ResponseAPI<Menu[]>>(url);
  }
}