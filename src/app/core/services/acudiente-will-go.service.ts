import { Injectable, NgZone, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MonoTypeOperatorFunction, Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FondoPortal { id: string; nombre: string; riesgo: 'bajo' | 'medio' | 'alto'; logo: string | null; a_que_se_dedica: string | null; por_que_invertir: string | null; }
export interface EdicionPortal {
  id: string; nombre: string; estado: string;
  ronda: { id: string; nombre: string; apertura: string; cierre_programado: string | null; duracion_minutos: number | null; mis_votos: string[]; votos_por_ronda: number } | null;
  fondos: FondoPortal[];
  rondas: { id: string; nombre: string; resultados: { fondo_id: string; rendimiento: number }[] }[];
}
export interface HijoPortal {
  id: string; edicion_id: string; nombre: string; apellido: string; pais: string | null; color: string | null; codigo_moneda: string | null; saldo: number;
  inversiones: { id: string; monto: number; estado: string; monto_pagado: number | null; rendimiento_final: number | string | null; fondo: string; ronda: string }[];
  movimientos: { id: string; entra: boolean; titulo: string; monto: number; fecha: string; billetes: Record<string, number> | null }[];
  total_entro: number; total_salio: number;
}
export interface DatosPanelAcudiente { acudiente: { nombre: string; apellido: string }; ahora: string; hijos: HijoPortal[]; ediciones: EdicionPortal[]; }

const CLAVE = 'wg-acudiente';

/** Portal del acudiente: su sesión es propia (no es un usuario de Directus) y viaja en el cuerpo de cada petición. */
@Injectable({ providedIn: 'root' })
export class AcudienteWillGoService {
  private http = inject(HttpClient);
  private zone = inject(NgZone);
  private api = `${environment.willGo}/acudiente`;

  static sesion(): string | null {
    try { return localStorage.getItem(CLAVE); } catch { return null; }
  }

  private guardar(token: string | null): void {
    try { token ? localStorage.setItem(CLAVE, token) : localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
  }

  private enZona<T>(): MonoTypeOperatorFunction<T> {
    return (origen) => new Observable<T>((obs) => origen.subscribe({
      next: (v) => this.zone.run(() => obs.next(v)),
      error: (e) => this.zone.run(() => obs.error(e)),
      complete: () => this.zone.run(() => obs.complete()),
    }));
  }

  pedirCodigo(documento: string): Observable<{ enviado: boolean; correo: string | null }> {
    return this.http.post<{ data: { enviado: boolean; correo: string | null } }>(`${this.api}/codigo`, { documento }).pipe(this.enZona(), map((r) => r.data));
  }

  entrar(documento: string, codigo: string): Observable<{ sesion: string; nombre: string }> {
    return this.http.post<{ data: { sesion: string; nombre: string } }>(`${this.api}/entrar`, { documento, codigo })
      .pipe(this.enZona(), map((r) => r.data), tap((r) => this.guardar(r.sesion)));
  }

  salir(): void {
    const sesion = AcudienteWillGoService.sesion();
    this.guardar(null);
    if (sesion) this.http.post(`${this.api}/salir`, { sesion }).subscribe({ error: () => undefined });
  }

  panel(): Observable<DatosPanelAcudiente> {
    return this.http.post<{ data: DatosPanelAcudiente }>(`${this.api}/panel`, { sesion: AcudienteWillGoService.sesion() }).pipe(this.enZona(), map((r) => r.data));
  }

  /** Vota por una empresa (o retira el voto con `quitar`); devuelve los votos que le quedan puestos en la ronda. */
  votar(rondaId: string, fondoId: string, quitar = false): Observable<{ fondo: string; mis_votos: string[] }> {
    return this.http.post<{ data: { fondo: string; mis_votos: string[] } }>(`${this.api}/votar`, { sesion: AcudienteWillGoService.sesion(), ronda_id: rondaId, fondo_id: fondoId, quitar })
      .pipe(this.enZona(), map((r) => r.data));
  }

  urlLogo(id: string): string { return `${this.api}/logo/${id}`; }

  /** ¿El error es porque la sesión venció? */
  static sesionVencida(e: unknown): boolean {
    return e instanceof HttpErrorResponse && e.status === 403 && e.error?.errors?.[0]?.extensions?.code === 'SESION_VENCIDA';
  }

  static mensaje(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 0) return 'No hay conexión. Revisa tu internet e intenta de nuevo.';
      return e.error?.errors?.[0]?.message ?? 'Algo salió mal. Intenta de nuevo.';
    }
    return 'Algo salió mal. Intenta de nuevo.';
  }
}
