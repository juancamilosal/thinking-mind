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
      fields: '*,estudiante_id.*,estudiante_id.colegio_id.*,estudiante_id.colegio_id.rector_id.*,cliente_id.*,curso_id.*,pagos.*',
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count',
      // Filtrar por saldo mayor a 0 directamente en Directus
      'filter[saldo][_gt]': '0',
      // Filtrar solo cuentas de curso (no inscripción)
      'filter[es_inscripcion][_eq]': 'FALSE'
    };

    // Ordenamiento por fecha de inscripción (más reciente primero)
    if (sortByInscription) {
      params['sort'] = '-fecha_inscripcion';
    }

    // Si hay filtro por año, usar rangos de fecha con formato ISO
    if (yearFilter && yearFilter.trim()) {
      const year = yearFilter.trim();
      params['filter[fecha_finalizacion][_gte]'] = `${year}-01-01T00:00:00`;
      params['filter[fecha_finalizacion][_lt]'] = `${parseInt(year) + 1}-01-01T00:00:00`;
    }

    // Si hay término de búsqueda, agregarlo a los parámetros
    if (searchTerm && searchTerm.trim()) {
      params['filter[_or][0][estudiante_id][nombre][_icontains]'] = searchTerm.trim();
      params['filter[_or][1][estudiante_id][colegio_id][nombre][_icontains]'] = searchTerm.trim();
      params['filter[_or][2][cliente_id][nombre][_icontains]'] = searchTerm.trim();
      params['filter[_or][3][curso_id][nombre][_icontains]'] = searchTerm.trim();
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
      fields: '*,estudiante_id.*,estudiante_id.colegio_id.*,estudiante_id.colegio_id.rector_id.*,cliente_id.*,curso_id.*,pagos.*',
      'filter[estudiante_id][colegio_id][_eq]': schoolId,
      // Filtrar por saldo mayor a 0 directamente en Directus
      'filter[saldo][_gt]': '0',
      // Filtrar solo cuentas de curso (no inscripción)
      'filter[es_inscripcion][_eq]': 'FALSE',
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count'
    };

    // Ordenamiento por fecha de inscripción (más reciente primero)
    if (sortByInscription) {
      params['sort'] = '-fecha_inscripcion';
    }

    // Si hay filtro por año, usar rangos de fecha con formato ISO
    if (yearFilter && yearFilter.trim()) {
      const year = yearFilter.trim();
      params['filter[fecha_finalizacion][_gte]'] = `${year}-01-01T00:00:00`;
      params['filter[fecha_finalizacion][_lt]'] = `${parseInt(year) + 1}-01-01T00:00:00`;
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