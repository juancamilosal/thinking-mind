import { Injectable, NgZone, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, MonoTypeOperatorFunction, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageServices } from './storage.services';

export type RolWillGo = 'administrativo' | 'docente' | 'banco' | 'cajero' | 'administrador';

export interface PerfilWillGo {
  id: string;
  role: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolWillGo | null;
  es_will_go: boolean;
  debe_cambiar_clave: boolean;
}

export interface Funcionario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  tipo_documento: string | null;
  numero_documento: string | null;
  celular: string | null;
  estado: 'active' | 'suspended' | string;
  ultimo_ingreso: string | null;
  debe_cambiar_clave: boolean;
  rol: Exclude<RolWillGo, 'administrador'>;
}

export interface NuevoFuncionario {
  nombre: string;
  apellido: string;
  email: string;
  rol: Funcionario['rol'];
  tipo_documento?: string;
  numero_documento?: string;
  celular?: string;
}

export const NOMBRE_ROL: Record<RolWillGo, string> = {
  administrativo: 'Administrativo',
  docente: 'Docente',
  banco: 'Banco',
  cajero: 'Cajero',
  administrador: 'Administrador',
};

const PERFIL = 'wge_perfil';

/** Habla con la extensión /wge de Directus. Las operaciones con billetes nunca se hacen con /items. */
@Injectable({ providedIn: 'root' })
export class WillGoService {
  private api = environment.willGo;
  private zone = inject(NgZone);

  constructor(private http: HttpClient) {}

  /**
   * Las respuestas de la API pueden llegar fuera de la zona de Angular. Si no se devuelven a ella,
   * lo que se abre con la respuesta (por ejemplo, la ventana de la clave temporal) no se redibuja
   * al pulsar sus botones.
   */
  private enZona<T>(): MonoTypeOperatorFunction<T> {
    return (origen) => new Observable<T>((obs) => origen.subscribe({
      next: (v) => this.zone.run(() => obs.next(v)),
      error: (e) => this.zone.run(() => obs.error(e)),
      complete: () => this.zone.run(() => obs.complete()),
    }));
  }

  /** Quién inició sesión. También deja guardado el usuario para el guard y el interceptor. */
  yo(): Observable<PerfilWillGo> {
    return this.http.get<{ data: PerfilWillGo }>(`${this.api}/yo`).pipe(
      this.enZona(),
      map((r) => r.data),
      tap((p) => {
        StorageServices.setUserData({ id: p.id, email: p.email, first_name: p.nombre, last_name: p.apellido, role: p.role });
        StorageServices.saveObjectInLocalStorage(PERFIL, p);
        if (typeof localStorage !== 'undefined') localStorage.setItem('last_user_role', p.role);
      })
    );
  }

  static perfilGuardado(): PerfilWillGo | null {
    return StorageServices.getItemObjectFromSessionStorage(PERFIL);
  }

  static olvidarPerfil(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(PERFIL);
  }

  cambiarClave(nueva: string): Observable<void> {
    return this.http.post(`${this.api}/cambiar-clave`, { nueva }).pipe(
      this.enZona(),
      map(() => undefined),
      tap(() => {
        const p = WillGoService.perfilGuardado();
        if (p) StorageServices.saveObjectInLocalStorage(PERFIL, { ...p, debe_cambiar_clave: false });
      })
    );
  }

  funcionarios(): Observable<Funcionario[]> {
    return this.http.get<{ data: Funcionario[] }>(`${this.api}/funcionarios`).pipe(this.enZona(), map((r) => r.data));
  }

  crearFuncionario(datos: NuevoFuncionario): Observable<{ funcionario: Funcionario; clave_temporal: string }> {
    return this.http.post<{ data: { funcionario: Funcionario; clave_temporal: string } }>(`${this.api}/funcionarios`, datos)
      .pipe(this.enZona(), map((r) => r.data));
  }

  actualizarFuncionario(id: string, cambios: Partial<NuevoFuncionario> & { estado?: string }): Observable<Funcionario> {
    return this.http.patch<{ data: Funcionario }>(`${this.api}/funcionarios/${id}`, cambios).pipe(this.enZona(), map((r) => r.data));
  }

  restablecerClave(id: string): Observable<{ funcionario: Funcionario; clave_temporal: string }> {
    return this.http.post<{ data: { funcionario: Funcionario; clave_temporal: string } }>(`${this.api}/funcionarios/${id}/restablecer-clave`, {})
      .pipe(this.enZona(), map((r) => r.data));
  }

  /** Mensaje en español que devuelve la extensión, o uno genérico. */
  static mensajeDeError(error: unknown, porDefecto = 'No se pudo completar la operación. Intenta de nuevo.'): string {
    const e = error as HttpErrorResponse;
    return e?.error?.errors?.[0]?.message || (e?.status === 0 ? 'Sin conexión con el servidor. Revisa el internet.' : porDefecto);
  }
}
