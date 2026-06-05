import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { defer, EMPTY } from 'rxjs';
import { map } from 'rxjs/operators';
import { expand, reduce, tap } from 'rxjs/operators';
import { ResponseAPI } from '../models/ResponseAPI';
import { AccountReceivable } from '../models/AccountReceivable';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SchoolWithPaymentsService {
  private apiUrl: string = environment.accountsReceivable;

  constructor(private http: HttpClient) {}

  private buildAccountsWithPaymentsParams(
    page: number,
    limit: number,
    searchTerm?: string,
    yearFilter?: string,
    sortByInscription: boolean = false,
    schoolId?: string,
    onlyWithSaldo: boolean = false
  ): any {
    const params: any = {
      fields: '*,estudiante_id.*,estudiante_id.colegio_id.*,estudiante_id.colegio_id.rector_id.*,cliente_id.*,curso_id.*,pagos.*,id_inscripcion.*,id_inscripcion.estudiante_id.*,id_inscripcion.estudiante_id.colegio_id.*,id_inscripcion.estudiante_id.colegio_id.rector_id.*,id_inscripcion.cliente_id.*,id_inscripcion.curso_id.*,id_inscripcion.pagos.*',
      page: page.toString(),
      limit: limit.toString(),
      meta: 'total_count,filter_count',
      // Filtrar solo cuentas de curso (no inscripción)
      'filter[es_inscripcion][_eq]': 'FALSE'
    };

    if (schoolId && schoolId.trim()) {
      params['filter[estudiante_id][colegio_id][_eq]'] = schoolId.trim();
    }

    // Ordenamiento por fecha de inscripción (más reciente primero)
    if (sortByInscription) {
      params['sort'] = '-fecha_inscripcion';
    }

    let andIndex = 0;

    if (onlyWithSaldo) {
      params[`filter[_and][${andIndex}][_or][0][saldo][_gt]`] = '0';
      params[`filter[_and][${andIndex}][_or][1][id_inscripcion][saldo][_gt]`] = '0';
      andIndex++;
    }

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
      params[`filter[_and][${andIndex}][_or][4][id_inscripcion][estudiante_id][nombre][_icontains]`] = term;
      params[`filter[_and][${andIndex}][_or][5][id_inscripcion][estudiante_id][colegio_id][nombre][_icontains]`] = term;
      params[`filter[_and][${andIndex}][_or][6][id_inscripcion][cliente_id][nombre][_icontains]`] = term;
      params[`filter[_and][${andIndex}][_or][7][id_inscripcion][curso_id][nombre][_icontains]`] = term;
    }

    return params;
  }

  private fetchAccountsWithPaymentsPage(
    page: number,
    limit: number,
    searchTerm?: string,
    yearFilter?: string,
    sortByInscription: boolean = false,
    schoolId?: string,
    onlyWithSaldo: boolean = false
  ): Observable<ResponseAPI<AccountReceivable[]>> {
    const params = this.buildAccountsWithPaymentsParams(page, limit, searchTerm, yearFilter, sortByInscription, schoolId, onlyWithSaldo);
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

  getAccountsWithPayments(
    page: number = 1,
    limit: number = 1000,
    searchTerm?: string,
    yearFilter?: string,
    sortByInscription: boolean = false,
    onlyWithSaldo: boolean = false
  ): Observable<ResponseAPI<AccountReceivable[]>> {
    return this.fetchAccountsWithPaymentsPage(page, limit, searchTerm, yearFilter, sortByInscription, undefined, onlyWithSaldo);
  }

  getAccountsWithPaymentsAll(
    searchTerm?: string,
    yearFilter?: string,
    sortByInscription: boolean = false,
    onlyWithSaldo: boolean = false
  ): Observable<ResponseAPI<AccountReceivable[]>> {
    const pageSize = 500;
    let page = 1;
    let fetched = 0;
    let total: number | undefined;

    return defer(() => this.fetchAccountsWithPaymentsPage(page, pageSize, searchTerm, yearFilter, sortByInscription, undefined, onlyWithSaldo)).pipe(
      tap((resp) => {
        fetched += (resp?.data || []).length;
        const metaTotal = resp?.meta?.filter_count ?? resp?.meta?.total_count;
        if (typeof metaTotal === 'number' && Number.isFinite(metaTotal)) {
          total = metaTotal;
        }
      }),
      expand((resp) => {
        const lastLen = (resp?.data || []).length;
        const shouldContinue =
          lastLen > 0 && (typeof total !== 'number' || fetched < total);
        if (!shouldContinue) return EMPTY;
        page += 1;
        return this.fetchAccountsWithPaymentsPage(page, pageSize, searchTerm, yearFilter, sortByInscription, undefined, onlyWithSaldo).pipe(
          tap((nextResp) => {
            fetched += (nextResp?.data || []).length;
            const metaTotal = nextResp?.meta?.filter_count ?? nextResp?.meta?.total_count;
            if (typeof metaTotal === 'number' && Number.isFinite(metaTotal)) {
              total = metaTotal;
            }
          })
        );
      }),
      reduce(
        (acc, resp) => {
          acc.data.push(...(resp?.data || []));
          if (!acc.status && resp?.status) acc.status = resp.status;
          if (!acc.message && resp?.message) acc.message = resp.message;
          if (resp?.meta) acc.meta = resp.meta;
          return acc;
        },
        { data: [] as AccountReceivable[], status: undefined as any, message: '' as string, meta: undefined as any }
      ),
      map((acc) => ({
        status: acc.status || 'SUCCESS',
        message: acc.message || '',
        data: acc.data,
        meta: {
          total_count: total ?? acc.data.length,
          filter_count: total ?? acc.data.length
        }
      }))
    );
  }


  getAccountsWithPaymentsBySchool(
    schoolId: string,
    page: number = 1,
    limit: number = 1000,
    yearFilter?: string,
    sortByInscription: boolean = false,
    onlyWithSaldo: boolean = false
  ): Observable<ResponseAPI<AccountReceivable[]>> {
    return this.fetchAccountsWithPaymentsPage(page, limit, undefined, yearFilter, sortByInscription, schoolId, onlyWithSaldo);
  }

  getAccountsWithPaymentsBySchoolAll(
    schoolId: string,
    searchTerm?: string,
    yearFilter?: string,
    sortByInscription: boolean = false,
    onlyWithSaldo: boolean = false
  ): Observable<ResponseAPI<AccountReceivable[]>> {
    const pageSize = 500;
    let page = 1;
    let fetched = 0;
    let total: number | undefined;

    return defer(() => this.fetchAccountsWithPaymentsPage(page, pageSize, searchTerm, yearFilter, sortByInscription, schoolId, onlyWithSaldo)).pipe(
      tap((resp) => {
        fetched += (resp?.data || []).length;
        const metaTotal = resp?.meta?.filter_count ?? resp?.meta?.total_count;
        if (typeof metaTotal === 'number' && Number.isFinite(metaTotal)) {
          total = metaTotal;
        }
      }),
      expand((resp) => {
        const lastLen = (resp?.data || []).length;
        const shouldContinue =
          lastLen > 0 && (typeof total !== 'number' || fetched < total);
        if (!shouldContinue) return EMPTY;
        page += 1;
        return this.fetchAccountsWithPaymentsPage(page, pageSize, searchTerm, yearFilter, sortByInscription, schoolId, onlyWithSaldo).pipe(
          tap((nextResp) => {
            fetched += (nextResp?.data || []).length;
            const metaTotal = nextResp?.meta?.filter_count ?? nextResp?.meta?.total_count;
            if (typeof metaTotal === 'number' && Number.isFinite(metaTotal)) {
              total = metaTotal;
            }
          })
        );
      }),
      reduce(
        (acc, resp) => {
          acc.data.push(...(resp?.data || []));
          if (!acc.status && resp?.status) acc.status = resp.status;
          if (!acc.message && resp?.message) acc.message = resp.message;
          if (resp?.meta) acc.meta = resp.meta;
          return acc;
        },
        { data: [] as AccountReceivable[], status: undefined as any, message: '' as string, meta: undefined as any }
      ),
      map((acc) => ({
        status: acc.status || 'SUCCESS',
        message: acc.message || '',
        data: acc.data,
        meta: {
          total_count: total ?? acc.data.length,
          filter_count: total ?? acc.data.length
        }
      }))
    );
  }
}
