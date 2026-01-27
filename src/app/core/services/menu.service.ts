import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {ResponseAPI} from '../models/ResponseAPI';
import {Menu} from '../models/Menu';
import {Roles} from '../const/Roles';

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
      Roles.STUDENT,
      Roles.TEACHER
    ];

    if (role && ayoRoles.includes(role)) {
      url += '&filter[menu_ayo][_eq]=true';
    } else {
      url += '&filter[_or][0][menu_ayo][_neq]=true&filter[_or][1][nombre][_eq]=Dashboard';
    }

    return this.http.get<ResponseAPI<Menu[]>>(url);
  }
}
