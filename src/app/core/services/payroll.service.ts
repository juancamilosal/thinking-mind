import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ResponseAPI } from '../models/ResponseAPI';
import { TeacherPayroll, TeacherPayrollSummary, PayrollHistory } from '../models/Payroll';

@Injectable({
  providedIn: 'root'
})
export class PayrollService {
  private apiUrl: string = environment.nomina_docente;

  constructor(private http: HttpClient) {}

  createPayrollRecord(payrollData: TeacherPayroll): Observable<ResponseAPI<TeacherPayroll>> {
    return this.http.post<ResponseAPI<TeacherPayroll>>(this.apiUrl, payrollData);
  }

  getTeacherPayrollSummary(teacherId: string, month?: number, year?: number): Observable<TeacherPayrollSummary> {
    const now = new Date();
    const targetMonth = month || now.getMonth() + 1;
    const targetYear = year || now.getFullYear();

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${lastDay}`;

    const params: any = {
      'filter[teacher_id][_eq]': teacherId,
      'filter[fecha_clase][_between]': `${startDate},${endDate}`,
      fields: 'duracion_horas,valor_hora,valor_total'
    };

    return this.http.get<ResponseAPI<TeacherPayroll[]>>(this.apiUrl, { params }).pipe(
      map(response => {
        const records = response.data || [];
        // Parse numeric values that may come as strings from database
        const totalHours = records.reduce((sum, record) => {
          const hours = typeof record.duracion_horas === 'string' ? parseFloat(record.duracion_horas) : record.duracion_horas;
          return sum + (hours || 0);
        }, 0);
        const valorPorHora = records.length > 0 ?
          (typeof records[0].valor_hora === 'string' ? parseFloat(records[0].valor_hora) : records[0].valor_hora) : 0;
        const totalPayment = records.reduce((sum, record) => {
          const total = typeof record.valor_total === 'string' ? parseFloat(record.valor_total) : record.valor_total;
          return sum + (total || 0);
        }, 0);

        return {
          valorPorHora,
          horasTrabajadasMes: totalHours,
          pagoTotalMes: totalPayment
        };
      })
    );
  }

  getTeacherPayrollHistory(
    teacherId: string,
    page: number = 1,
    limit: number = 10
  ): Observable<ResponseAPI<PayrollHistory[]>> {
    const params: any = {
      'filter[teacher_id][_eq]': teacherId,
      'sort': '-fecha_clase',
      'page': page.toString(),
      'limit': limit.toString(),
      'meta': 'total_count,filter_count',
      fields: 'id,duracion_horas,valor_hora,valor_total,fecha_pago,metodo_pago,estado_pago,fecha_clase,calificado_a_tiempo'
    };

    return this.http.get<ResponseAPI<TeacherPayroll[]>>(this.apiUrl, { params }).pipe(
      map(response => {
        const records = response.data || [];
        const history: PayrollHistory[] = records.map(record => {
          // Parse numeric values that may come as strings from database
          const duracionHoras = typeof record.duracion_horas === 'string' ? parseFloat(record.duracion_horas) : record.duracion_horas;
          const valorHora = typeof record.valor_hora === 'string' ? parseFloat(record.valor_hora) : record.valor_hora;

          return {
            id: record.id || '',
            horasTrabajadas: duracionHoras || 0,
            valorPorHora: valorHora || 0,
            fechaPago: record.fecha_pago || '',
            metodoPago: record.metodo_pago || '',
            estado: record.estado_pago || 'Pendiente',
            fecha_clase: record.fecha_clase || '',
            calificado_a_tiempo: record.calificado_a_tiempo || false
          };
        });

        return {
          status: response.status || 'SUCCESS',
          message: response.message || '',
          data: history,
          meta: response.meta
        } as ResponseAPI<PayrollHistory[]>;
      })
    );
  }

  updatePayrollStatus(
    payrollId: string,
    updateData: Partial<TeacherPayroll>
  ): Observable<ResponseAPI<TeacherPayroll>> {
    return this.http.patch<ResponseAPI<TeacherPayroll>>(
      `${this.apiUrl}/${payrollId}`,
      updateData
    );
  }

  getTeacherHourlyRate(teacherId: string): Observable<number> {
    const userUrl = `${environment.users}/${teacherId}`;
    const params = { fields: 'valor_hora' };

    return this.http.get<any>(userUrl, { params }).pipe(
      map(response => {
        const valorHora = response.data?.valor_hora;

        if (valorHora === null || valorHora === undefined || valorHora === '') {
          console.warn(`Teacher ${teacherId} does not have a valor_hora configured`);
          return 0;
        }

        // Convert to number if it's a string
        const rate = typeof valorHora === 'string' ? parseFloat(valorHora) : valorHora;
        return isNaN(rate) ? 0 : rate;
      })
    );
  }

  // Admin methods for payroll management
  getAllPayrollRecords(
    page: number = 1,
    limit: number = 10,
    filters?: {
      teacherId?: string;
      startDate?: string;
      endDate?: string;
      estadoPago?: string;
    }
  ): Observable<ResponseAPI<TeacherPayroll[]>> {
    const params: any = {
      'sort': '-fecha_clase',
      'page': page.toString(),
      'limit': limit.toString(),
      'meta': 'total_count,filter_count',
      'fields': 'id,teacher_id.id,teacher_id.first_name,teacher_id.last_name,fecha_clase,duracion_horas,valor_hora,valor_total,estado_pago,metodo_pago,fecha_pago,calificado_a_tiempo'
    };

    // Apply filters if provided
    if (filters?.teacherId) {
      params['filter[teacher_id][_eq]'] = filters.teacherId;
    }

    if (filters?.startDate) {
      params['filter[fecha_clase][_gte]'] = filters.startDate;
    }

    if (filters?.endDate) {
      params['filter[fecha_clase][_lte]'] = filters.endDate;
    }

    if (filters?.estadoPago) {
      params['filter[estado_pago][_eq]'] = filters.estadoPago;
    }

    return this.http.get<ResponseAPI<TeacherPayroll[]>>(this.apiUrl, { params });
  }

  updateMultiplePayrollStatus(
    payrollIds: string[],
    updateData: Partial<TeacherPayroll>
  ): Observable<ResponseAPI<TeacherPayroll[]>> {

    const updatePromises = payrollIds.map(id =>
      this.http.patch<ResponseAPI<TeacherPayroll>>(
        `${this.apiUrl}/${id}`,
        updateData
      ).toPromise()
    );

    return new Observable(observer => {
      Promise.all(updatePromises)
        .then(results => {
          const successfulUpdates = results.filter(r => r?.status === 'SUCCESS');
          observer.next({
            status: 'SUCCESS',
            message: `${successfulUpdates.length} records updated successfully`,
            data: successfulUpdates.map(r => r!.data) as any
          } as ResponseAPI<TeacherPayroll[]>);
          observer.complete();
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }
}
