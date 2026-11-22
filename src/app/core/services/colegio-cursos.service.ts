import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { ResponseAPI } from '../models/ResponseAPI';
import { environment } from '../../../environments/environment';
import { ColegioCurso } from '../models/Course';

@Injectable({
  providedIn: 'root'
})
export class ColegioCursosService {
  private apiUrl: string = environment.colegio_cursos;

  constructor(private http: HttpClient) {}

  createColegioCurso(colegioCurso: ColegioCurso): Observable<ResponseAPI<ColegioCurso>> {
    return this.http.post<ResponseAPI<ColegioCurso>>(this.apiUrl, colegioCurso);
  }

  getColegioCursos(): Observable<ResponseAPI<ColegioCurso[]>> {
    return this.http.get<ResponseAPI<ColegioCurso[]>>(this.apiUrl);
  }

  getIndependentColegioCursos(): Observable<ResponseAPI<ColegioCurso[]>> {
    const params = {
      'fields': '*,curso_id.*,colegio_id.*',
      'filter[programa_independiente][_eq]': 'true'
    };
    return this.http.get<ResponseAPI<ColegioCurso[]>>(this.apiUrl, { params });
  }

  getColegioCursoById(id: number): Observable<ResponseAPI<ColegioCurso>> {
    return this.http.get<ResponseAPI<ColegioCurso>>(`${this.apiUrl}/${id}`);
  }

  updateColegioCurso(id: number, colegioCurso: Partial<ColegioCurso>): Observable<ResponseAPI<ColegioCurso>> {
    return this.http.patch<ResponseAPI<ColegioCurso>>(`${this.apiUrl}/${id}`, colegioCurso);
  }

  /**
   * La edición se cuenta por colegio y por programa: un colegio no puede repetir una edición que ya usó
   * en ese programa, y la nueva siempre es mayor (1, 2, 3…). Las ediciones usadas salen de los registros
   * del programa en el colegio y de las inscripciones (cuentas por cobrar) de ese colegio.
   * Devuelve el mensaje de error, o null si la edición es válida.
   */
  async validarEdicion(datos: {
    colegioId: string | null; cursoId: string; edicion: unknown; colegioCursoId?: string | number | null; edicionActual?: unknown;
  }): Promise<string | null> {
    if (!datos.cursoId) return null; // sin programa no hay con qué comparar
    const texto = datos.edicion === null || datos.edicion === undefined ? '' : String(datos.edicion).trim();
    if (!texto) return 'La edición es obligatoria.';
    const nueva = Number(texto);
    if (!Number.isInteger(nueva) || nueva < 1) return 'La edición debe ser un número entero desde 1.';
    const actual = datos.edicionActual === null || datos.edicionActual === undefined || String(datos.edicionActual).trim() === ''
      ? null : Number(datos.edicionActual);
    if (actual !== null && nueva === actual) return null; // no cambió

    const registros: any = { 'filter[curso_id][_eq]': datos.cursoId, fields: 'id,edicion', limit: '-1' };
    if (datos.colegioId) registros['filter[colegio_id][_eq]'] = datos.colegioId; else registros['filter[colegio_id][_null]'] = 'true';
    const usadas = new Set<number>();
    const [regs, cuentas] = await Promise.all([
      firstValueFrom(this.http.get<ResponseAPI<any[]>>(this.apiUrl, { params: registros })),
      datos.colegioId
        ? firstValueFrom(this.http.get<ResponseAPI<any[]>>(environment.accountsReceivable, { params: {
            'filter[curso_id][_eq]': datos.cursoId, 'filter[estudiante_id][colegio_id][_eq]': datos.colegioId,
            'filter[edicion_programa][_nnull]': 'true', 'groupBy[]': 'edicion_programa', 'aggregate[count]': 'id',
          } }))
        : Promise.resolve({ data: [] } as any),
    ]);
    for (const r of regs.data ?? []) if (String(r.id) !== String(datos.colegioCursoId ?? '') && r.edicion != null) usadas.add(Number(r.edicion));
    for (const c of cuentas.data ?? []) if (c.edicion_programa != null) usadas.add(Number(c.edicion_programa));
    if (actual !== null) usadas.add(actual);
    const numeros = [...usadas].filter((n) => Number.isFinite(n));
    if (!numeros.length) return null;
    const mayor = Math.max(...numeros);
    if (usadas.has(nueva)) return `Este colegio ya tuvo la edición ${nueva} de este programa. Usa la edición ${mayor + 1}.`;
    if (nueva < mayor) return `Este colegio ya llegó a la edición ${mayor} de este programa. La nueva debe ser la ${mayor + 1} o mayor.`;
    return null;
  }

  deleteColegioCurso(id: number): Observable<ResponseAPI<any>> {
    return this.http.delete<ResponseAPI<any>>(`${this.apiUrl}/${id}`);
  }
}
