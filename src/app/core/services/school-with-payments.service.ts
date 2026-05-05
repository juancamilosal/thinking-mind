import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ResponseAPI } from '../models/ResponseAPI';
import { AccountReceivable } from '../models/AccountReceivable';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SchoolWithPaymentsService {
  private apiUrl: string = environment.accountsReceivable;

  constructor(private http: HttpClient) {}

  getAccountsWithPayments(page: number = 1, limit: number = 1000, searchTerm?: string, yearFilter?: string, sortByInscription: boolean = false): Observable<ResponseAPI<AccountReceivable[]>> {
    const params: any = {
      fields: '*,estudiante_id.*,estudiante_id.colegio_id.*,estudiante_id.colegio_id.rector_id.*,cliente_id.*,curso_id.*,pagos.*,id_inscripcion.*,id_inscripcion.estudiante_id.*,id_inscripcion.estudiante_id.colegio_id.*,id_inscripcion.estudiante_id.colegio_id.rector_id.*,id_inscripcion.cliente_id.*,id_inscripcion.curso_id.*,id_inscripcion.pagos.*',
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count',
      // Filtrar solo cuentas de curso (no inscripción)
      'filter[es_inscripcion][_eq]': 'FALSE'
    };

    // Ordenamiento por fecha de inscripción (más reciente primero)
    if (sortByInscription) {
      params['sort'] = '-fecha_inscripcion';
    }

    // Traer cuentas si: (saldo > 0) OR (id_inscripcion.saldo > 0)
    let andIndex = 0;
    params[`filter[_and][${andIndex}][_or][0][saldo][_gt]`] = '0';
    params[`filter[_and][${andIndex}][_or][1][id_inscripcion][saldo][_gt]`] = '0';
    andIndex++;

    // Si hay filtro por año, filtrar por fecha_inscripcion (cuenta) o fecha_inscripcion (inscripción)
    if (yearFilter && yearFilter.trim()) {
      const year = yearFilter.trim();
      params[`filter[_and][${andIndex}][_or][0][fecha_inscripcion][_gte]`] = `${year}-01-01`;
      params[`filter[_and][${andIndex}][_or][0][fecha_inscripcion][_lt]`] = `${parseInt(year) + 1}-01-01`;
      params[`filter[_and][${andIndex}][_or][1][id_inscripcion][fecha_inscripcion][_gte]`] = `${year}-01-01`;
      params[`filter[_and][${andIndex}][_or][1][id_inscripcion][fecha_inscripcion][_lt]`] = `${parseInt(year) + 1}-01-01`;
      andIndex++;
    }

    // Si hay término de búsqueda, agregarlo a los parámetros
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim();
      params[`filter[_and][${andIndex}][_or][0][estudiante_id][nombre][_icontains]`] = term;
      params[`filter[_and][${andIndex}][_or][1][estudiante_id][colegio_id][nombre][_icontains]`] = term;
      params[`filter[_and][${andIndex}][_or][2][cliente_id][nombre][_icontains]`] = term;
      params[`filter[_and][${andIndex}][_or][3][curso_id][nombre][_icontains]`] = term;
    }

    return this.http.get<ResponseAPI<AccountReceivable[]>>(this.apiUrl, { params }).pipe(
      map(response => {
        // Los datos ya vienen filtrados desde Directus, solo necesitamos mapearlos
        return {
          ...response,
          data: response.data
        };
      })
    );
  }


  getAccountsWithPaymentsBySchool(schoolId: string, page: number = 1, limit: number = 1000, yearFilter?: string, sortByInscription: boolean = false): Observable<ResponseAPI<AccountReceivable[]>> {
    const params: any = {
      fields: '*,estudiante_id.*,estudiante_id.colegio_id.*,estudiante_id.colegio_id.rector_id.*,cliente_id.*,curso_id.*,pagos.*,id_inscripcion.*,id_inscripcion.estudiante_id.*,id_inscripcion.estudiante_id.colegio_id.*,id_inscripcion.estudiante_id.colegio_id.rector_id.*,id_inscripcion.cliente_id.*,id_inscripcion.curso_id.*,id_inscripcion.pagos.*',
      'filter[estudiante_id][colegio_id][_eq]': schoolId,
      'filter[es_inscripcion][_eq]': 'FALSE',
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
    };

    // Ordenamiento por fecha de inscripción (más reciente primero)
    if (sortByInscription) {
      params['sort'] = '-fecha_inscripcion';
    }

    // Traer cuentas si: (saldo > 0) OR (id_inscripcion.saldo > 0)
    let andIndex = 0;
    params[`filter[_and][${andIndex}][_or][0][saldo][_gt]`] = '0';
    params[`filter[_and][${andIndex}][_or][1][id_inscripcion][saldo][_gt]`] = '0';
    andIndex++;

    // Si hay filtro por año, filtrar por fecha_inscripcion (cuenta) o fecha_inscripcion (inscripción)
    if (yearFilter && yearFilter.trim()) {
      const year = yearFilter.trim();
      params[`filter[_and][${andIndex}][_or][0][fecha_inscripcion][_gte]`] = `${year}-01-01`;
      params[`filter[_and][${andIndex}][_or][0][fecha_inscripcion][_lt]`] = `${parseInt(year) + 1}-01-01`;
      params[`filter[_and][${andIndex}][_or][1][id_inscripcion][fecha_inscripcion][_gte]`] = `${year}-01-01`;
      params[`filter[_and][${andIndex}][_or][1][id_inscripcion][fecha_inscripcion][_lt]`] = `${parseInt(year) + 1}-01-01`;
      andIndex++;
    }

    return this.http.get<ResponseAPI<AccountReceivable[]>>(this.apiUrl, { params }).pipe(
      map(response => {
       // Los datos ya vienen filtrados desde Directus, solo necesitamos mapearlos
        return {
          ...response,
          data: response.data
        };
      })
    );
  }
}
