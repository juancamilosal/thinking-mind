import { IdiomaWillGoService } from './idioma-will-go.service';
import { Injectable, NgZone, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, MonoTypeOperatorFunction, catchError, map, of, shareReplay, tap } from 'rxjs';
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

export interface Franja { dia?: string; fecha?: string; inicio: string; fin: string; }

export interface Edicion {
  id: string;
  nombre: string;
  colegio_id: string | null;
  curso_id: string | null;
  edicion_programa: string | null;
  colegio_nombre: string | null;
  programa_nombre: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  horario: Franja[] | null;
  tasa_inicial: number;
  tope_minimo: number | string;
  tope_maximo: number | string;
  investment_bill: number;
  /** Encargado de la caja GO•STORE (colaborador con rol Cajero). */
  responsable_caja?: string | null;
  /** Parámetros del tipo de cambio (p. ej. intervalo_minutos: cada cuánto se recalcula). */
  parametros_fx?: { intervalo_minutos?: number; [clave: string]: unknown } | string | null;
  estado: 'borrador' | 'abierta' | 'cerrada';
  participantes: number;
  sin_pais: number;
  retirados?: number;
  equipo?: number;
  /** Inscritos que llegaron en esta consulta (se traen solos). */
  nuevos?: number;
  /** Participantes de otro colegio que salieron solos (no tenían historial). */
  quitados?: number;
}

export interface Oferta {
  id: string; colegio_id: string | null; colegio: string | null; curso_id: string; programa: string;
  edicion: string; fecha_finalizacion: string | null;
  /** Nombre de la edición de Will-Go que ya usa esta oferta, si existe. */
  edicion_will_go: string | null;
}

export interface Pais {
  id: string; nombre: string; codigo_moneda: string | null; color: string | null;
  provision_inicial: number; tasa_actual: number | null; orden: number | null;
  provision_billetes?: Record<string, number> | null;
  /** Colaborador (rol Banco) que maneja el banco de este país. */
  responsable_banco?: string | null;
  /** Billetes que hoy tiene el banco y los que ya salieron (en manos de docentes y estudiantes). */
  saldo_banco?: number; en_circulacion?: number;
}

export interface Producto {
  id: string; nombre: string; foto: string | null; precio_cop: number; stock: number;
  maximo_por_estudiante: number | null; activo: boolean;
}

export interface Fondo {
  id: string; nombre: string; historia: string | null; riesgo: 'bajo' | 'medio' | 'alto';
  rendimiento_base: number | string; rendimiento_alterno: number | string | null; variacion: number | string;
  activo: boolean; orden: number | null;
  logo: string | null; a_que_se_dedica: string | null; por_que_invertir: string | null;
  /** Texto de ejemplo que propone el sistema (solo lectura). */
  ejemplo?: { a_que_se_dedica: string; por_que_invertir: string } | null;
}

export interface Participante {
  id: string; codigo: string; pais_id: string | null; presente: boolean;
  nombre: string; apellido: string; grado: string | null; colegio_id: string | null; colegio: string | null; saldo: number;
  corresponde: boolean;
  retirado: boolean | null; motivo_retiro: string | null; fecha_retiro: string | null; pidio_reembolso: boolean;
}

export interface MiembroEquipo {
  id: string; usuario_id: string; pais_id: string | null; pais: string | null;
  nombre: string; apellido: string; email: string; estado: string;
  rol: 'docente' | 'banco' | 'cajero' | 'administrativo' | null;
  /** Billetes que el docente tiene en mano en esta edición. */
  billetes: number;
}

export interface PaisArqueo {
  id: string; nombre: string; codigo_moneda: string | null; color: string | null;
  /** Billetes que hoy tiene el banco según el sistema. */
  saldo_sistema: number;
  /** Billetes asignados al banco (total y por denominación) y los que ya salieron. */
  provision_inicial: number; provision_billetes: Record<string, number>; en_circulacion: number;
  /** Billetes que hay hoy en el banco por denominación (asignados − entregados + recibidos). */
  inventario?: Record<string, number>;
  /** Lo que ha entrado y salido del banco (los últimos 100) y los totales de siempre. */
  movimientos: { id: string; tipo: string; entra: boolean; titulo: string; monto: number; saldo_despues: number; fecha: string; quien: string; billetes: Record<string, number> | null }[];
  total_entro: number; total_salio: number;
}

export interface Arqueo {
  id: string; pais_id: string; conteo: Record<string, number>; total_contado: number; saldo_sistema: number;
  diferencia: number; observaciones: string | null; date_created: string; responsable?: string;
}

export interface DatosArqueo {
  edicion: { id: string; nombre: string; estado: string };
  denominaciones: number[];
  paises: PaisArqueo[];
  historial: Arqueo[];
}

/** saldo = billetes en mano; cuenta = su cuenta electrónica. */
export interface DocenteReparto { id: string; nombre: string; apellido: string; pais_id: string | null; saldo: number; cuenta?: number; recibido: number; }
export interface EntregaReparto { id: string; monto: number; billetes: Record<string, number> | string | null; date_created: string; nombre: string; apellido: string; medio?: 'billetes' | 'transferencia'; }
export interface PaisReparto {
  id: string; nombre: string; codigo_moneda: string | null; color: string | null;
  saldo_banco: number; inventario: Record<string, number>; docentes: DocenteReparto[]; entregas: EntregaReparto[];
}
export interface DatosReparto { edicion: { id: string; nombre: string; estado: string }; denominaciones: number[]; paises: PaisReparto[]; }

export interface MovimientoDocente { id: string; monto: number; billetes: Record<string, number> | string | null; date_created: string; quien?: string; nombre?: string; apellido?: string; medio?: 'billetes' | 'transferencia'; }
export interface EstudianteDocente { id: string; codigo: string; llave?: string | null; presente: boolean; nombre: string; apellido: string; grado: string | null; saldo: number; cuenta?: number; }
export interface PaisDocente {
  id: string; nombre: string; codigo_moneda: string | null; color: string | null;
  saldo: number; inventario: Record<string, number>; recibidos: MovimientoDocente[]; entregas: MovimientoDocente[]; estudiantes: EstudianteDocente[];
  total_recibido: number; total_entregado: number;
  /** Saldo de la cuenta electrónica del docente (lo que puede transferir). */
  cuenta?: number;
}
export interface DatosDocente { edicion: { id: string; nombre: string; estado: string }; denominaciones: number[]; paises: PaisDocente[]; }

export interface RondaWfunds {
  id: string; nombre: string; estado: 'abierta' | 'liquidada'; apertura: string; cierre: string | null;
  resultados: { fondo_id: string; fondo: string; votos: number; rendimiento: number }[];
  duracion_minutos: number | null; cierre_programado: string | null;
}
export interface FondoWfunds { id: string; nombre: string; riesgo: 'bajo' | 'medio' | 'alto'; logo: string | null; a_que_se_dedica: string | null; por_que_invertir: string | null; activo: boolean; }
export interface InversionWfunds {
  id: string; participante_id?: string; fondo_id: string; monto: number; billetes?: Record<string, number> | string | null;
  monto_pagado?: number; rendimiento_final?: number | string; ronda?: string; cobrado_en?: string; date_created?: string; nombre: string; apellido: string;
  /** Lo que vale hoy (sigue invertida) y cómo cambió en cada ronda. */
  valor_actual?: number; historial?: { ronda: string; rendimiento: number; antes: number; despues: number }[];
}
export interface PaisWfunds {
  id: string; nombre: string; codigo_moneda: string | null; color: string | null; saldo_banco: number; inventario: Record<string, number>;
  estudiantes: { id: string; nombre: string; apellido: string; saldo: number }[];
  inversiones: InversionWfunds[]; vigentes: InversionWfunds[]; retiradas: InversionWfunds[];
}
export interface DatosWfunds {
  edicion: { id: string; nombre: string; estado: string }; denominaciones: number[];
  ronda: RondaWfunds | null; rondas: RondaWfunds[]; fondos: FondoWfunds[]; paises: PaisWfunds[];
  /** Hora del servidor (para la cuenta regresiva) y fin de la franja del horario actual (null = fuera del horario). */
  ahora: string; fin_horario: string | null; duraciones: number[];
  /** Si las rondas siguen solas (al empezar cada franja del horario) y cuándo arranca la próxima. */
  reanudacion: { automaticas: boolean; duracion: number | null; proxima: string | null };
}

export type CriterioRubrica = 'uso_lengua' | 'iniciativa' | 'nivel_reto' | 'colaboracion';
export interface EstudianteRubrica { id: string; nombre: string; apellido: string; presente: boolean; hoy: number; ultima: string | null; }
export interface PaisRubrica { id: string; nombre: string; codigo_moneda: string | null; color: string | null; tasa_actual: number; estudiantes: EstudianteRubrica[]; }
export interface CalificacionRubrica {
  id: string; participante_id: string; uso_lengua: number; iniciativa: number; nivel_reto: number; colaboracion: number;
  puntaje: number; idioma: 'ingles' | 'frances' | null; evidencia: string | null; recompensa: number; date_created: string; nombre: string; apellido: string; se_puede_deshacer: boolean;
}
export interface DatosRubrica { edicion: { id: string; nombre: string; estado: string }; paises: PaisRubrica[]; recientes: CalificacionRubrica[]; criterios: CriterioRubrica[]; nivel_maximo: number; puntaje_maximo: number; }

export interface CalculoTasa { ventana: string; participantes_presentes: number; puntos: number; indice: number; tasa_anterior: number; tasa_nueva: number; }
export interface PaisTasaCambio { id: string; nombre: string; codigo_moneda: string | null; color: string | null; tasa_actual: number; presentes: number; historial: CalculoTasa[]; }
export interface DatosTipoCambio {
  edicion: { id: string; nombre: string; estado: string }; tasa_inicial: number; tope_minimo: number; tope_maximo: number;
  intervalo_minutos: number; referencia: number; ahora: string; proximo_calculo: string | null; paises: PaisTasaCambio[];
}

export interface PaisCaja { id: string; nombre: string; codigo_moneda: string | null; color: string | null; tasa_actual: number; saldo_caja: number; inventario: Record<string, number>; }
export interface ProductoCaja { id: string; nombre: string; foto: string | null; precio_cop: number; stock: number; maximo_por_estudiante: number | null; vendidos?: number; }
/** saldo = efectivo (billetes en el bolsillo); cuenta = cuenta de la tarjeta débito. */
export interface EstudianteCaja { id: string; pais_id: string; llave?: string | null; nombre: string; apellido: string; saldo: number; cuenta?: number; }
export interface VentaCaja {
  id: string; numero_recibo: string; total_billetes: number; tasa_aplicada: number; pais_id: string; metodo_pago?: 'efectivo' | 'tarjeta';
  billetes_recibidos: Record<string, number>; billetes_vuelto: Record<string, number>; date_created: string; nombre: string; apellido: string;
  items: { nombre: string; cantidad: number; precio_billetes: number }[];
}
export interface DatosCaja {
  edicion: { id: string; nombre: string; estado: string; responsable_caja: string | null; responsable: string };
  puede_vender: boolean; denominaciones: number[]; paises: PaisCaja[]; productos: ProductoCaja[]; estudiantes: EstudianteCaja[];
  /** Unidades que cada estudiante ya compró de cada producto: { estudiante: { producto: n } } */
  comprado: Record<string, Record<string, number>>;
  ventas: VentaCaja[];
  entregas: { id: string; pais_id: string; monto: number; billetes: Record<string, number> | string; date_created: string; quien: string }[];
}

/** Edición vigente del usuario (para el selector de edición de cada pantalla). */
export interface EdicionVigente {
  id: string; nombre: string; estado: string; edicion_programa?: string | null;
  fecha_inicio?: string | null; fecha_fin?: string | null; colegio?: string | null; programa?: string | null;
}

export type SeccionEdicion = 'paises' | 'productos' | 'fondos';

export const NOMBRE_ROL: Record<RolWillGo, string> = {
  administrativo: 'Administrativo',
  docente: 'Docente',
  banco: 'Banco',
  cajero: 'Cajero',
  administrador: 'Administrador',
};

const PERFIL = 'wge_perfil';

/** Habla con la extensión /wge de Directus. Las operaciones con billetes nunca se hacen con /items. */
/** Resumen final de una edición (o vista previa mientras sigue abierta). */
export interface EmpresaResumen { fondo_id: string; nombre: string; logo: string | null; acumulado: number; rondas: number; mejor: number | null; peor: number | null }
export interface EstudianteResumen {
  id: string; nombre: string; apellido: string; saldo: number; cuenta?: number; invertido: number; total: number;
  ganancia_fondos: number; gastado_tienda: number; rubrica: { promedio: number; n: number } | null;
}
export interface PaisResumen {
  id: string; nombre: string; codigo_moneda: string | null; color: string | null; provision_inicial: number; tasa_actual: number | null;
  saldo_banco: number; saldo_caja: number; saldo_docentes: number; saldo_cuentas?: number; ventas: number; total_ventas: number;
  estudiantes: EstudianteResumen[]; total_estudiantes: number;
}
export interface ResumenFinal {
  edicion: { id: string; nombre: string; estado: string; fecha_inicio: string | null; fecha_fin: string | null };
  rondas: number; empresas: EmpresaResumen[]; paises: PaisResumen[]; maximo_rubrica: number;
}

/** Qué secciones puede usar hoy el colaborador (GET /wge/mi-menu). */
export interface AccesoMenu { equipo: boolean; banco: boolean; caja: boolean }

/** Cuentas electrónicas (tarjeta débito con llave tipo Bre-B). */
export interface EstudianteCuenta { id: string; nombre: string; apellido: string; llave: string | null; efectivo: number; cuenta: number; }
export interface PaisCuentas { id: string; nombre: string; codigo_moneda: string | null; color: string | null; inventario: Record<string, number>; estudiantes: EstudianteCuenta[]; en_cuentas: number; }
export interface DatosCuentas { edicion: { id: string; nombre: string; estado: string }; denominaciones: number[]; paises: PaisCuentas[]; }
export interface TarjetaImprimir { id: string; nombre: string; apellido: string; llave: string; pais_id: string; pais: string; color: string | null; codigo_moneda: string | null; }
export interface DuenoLlave { participante_id: string; llave: string; nombre: string; apellido: string; pais_id: string; pais: string; codigo_moneda: string | null; edicion_id: string; }

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
        WillGoService.accesoMenu$ = null; // al entrar (o cambiar de usuario) se vuelve a preguntar qué puede usar
        if (typeof localStorage !== 'undefined') localStorage.setItem('last_user_role', p.role);
      })
    );
  }

  static perfilGuardado(): PerfilWillGo | null {
    return StorageServices.getItemObjectFromSessionStorage(PERFIL);
  }

  static olvidarPerfil(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(PERFIL);
    WillGoService.accesoMenu$ = null;
  }

  /** Se pide una vez por sesión y lo comparten el menú y la página de inicio. */
  private static accesoMenu$: Observable<AccesoMenu> | null = null;
  miMenu(): Observable<AccesoMenu> {
    WillGoService.accesoMenu$ ??= this.http.get<{ data: AccesoMenu }>(`${this.api}/mi-menu`).pipe(
      this.enZona(), map((r) => r.data),
      // Con una extensión anterior (sin /mi-menu) se muestra todo, como antes
      catchError(() => of({ equipo: true, banco: true, caja: true })),
      shareReplay(1),
    );
    return WillGoService.accesoMenu$;
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

  /** Elimina un colaborador (solo si nunca movió nada en Will-Go; si no, hay que desactivarlo). */
  eliminarFuncionario(id: string): Observable<{ eliminado: boolean }> {
    return this.http.delete<{ data: { eliminado: boolean } }>(`${this.api}/funcionarios/${id}`).pipe(this.enZona(), map((r) => r.data));
  }

  restablecerClave(id: string): Observable<{ funcionario: Funcionario; clave_temporal: string }> {
    return this.http.post<{ data: { funcionario: Funcionario; clave_temporal: string } }>(`${this.api}/funcionarios/${id}/restablecer-clave`, {})
      .pipe(this.enZona(), map((r) => r.data));
  }

  // ---------- Administración de ediciones ----------

  catalogos(): Observable<{ colegios: { id: string; nombre: string }[]; programas: { id: string; nombre: string }[]; ofertas: Oferta[] }> {
    return this.http.get<{ data: any }>(`${this.api}/admin/catalogos`).pipe(this.enZona(), map((r) => r.data));
  }

  ediciones(): Observable<Edicion[]> {
    return this.http.get<{ data: Edicion[] }>(`${this.api}/admin/ediciones`).pipe(this.enZona(), map((r) => r.data));
  }

  edicion(id: string): Observable<Edicion> {
    return this.http.get<{ data: Edicion }>(`${this.api}/admin/ediciones/${id}`).pipe(this.enZona(), map((r) => r.data));
  }

  crearEdicion(datos: Partial<Edicion>): Observable<Edicion> {
    return this.http.post<{ data: Edicion }>(`${this.api}/admin/ediciones`, datos).pipe(this.enZona(), map((r) => r.data));
  }

  actualizarEdicion(id: string, datos: Partial<Edicion>): Observable<Edicion> {
    return this.http.patch<{ data: Edicion }>(`${this.api}/admin/ediciones/${id}`, datos).pipe(this.enZona(), map((r) => r.data));
  }

  eliminarEdicion(id: string): Observable<{ eliminada: boolean; nombre: string }> {
    return this.http.delete<{ data: any }>(`${this.api}/admin/ediciones/${id}`).pipe(this.enZona(), map((r) => r.data));
  }

  seccion<T>(edicionId: string, seccion: SeccionEdicion): Observable<T[]> {
    return this.http.get<{ data: T[] }>(`${this.api}/admin/ediciones/${edicionId}/${seccion}`).pipe(this.enZona(), map((r) => r.data));
  }

  crearEnSeccion<T>(edicionId: string, seccion: SeccionEdicion, datos: Partial<T>): Observable<T> {
    return this.http.post<{ data: T }>(`${this.api}/admin/ediciones/${edicionId}/${seccion}`, datos).pipe(this.enZona(), map((r) => r.data));
  }

  actualizarEnSeccion<T>(seccion: SeccionEdicion, id: string, datos: Partial<T>): Observable<T> {
    return this.http.patch<{ data: T }>(`${this.api}/admin/${seccion}/${id}`, datos).pipe(this.enZona(), map((r) => r.data));
  }

  borrarProducto(id: string): Observable<{ borrado: boolean; desactivado?: boolean }> {
    return this.http.delete<{ data: any }>(`${this.api}/admin/productos/${id}`).pipe(this.enZona(), map((r) => r.data));
  }

  participantes(edicionId: string): Observable<Participante[]> {
    return this.http.get<{ data: Participante[] }>(`${this.api}/admin/ediciones/${edicionId}/participantes`).pipe(this.enZona(), map((r) => r.data));
  }

  actualizarParticipantes(ids: string[], cambios: { pais_id?: string | null; presente?: boolean }): Observable<{ actualizados: number; bienvenidas: number }> {
    return this.http.patch<{ data: any }>(`${this.api}/admin/participantes`, { ids, ...cambios }).pipe(this.enZona(), map((r) => r.data));
  }

  retirarParticipantes(ids: string[], motivo: string): Observable<{ retirados: number; billetes_devueltos: number }> {
    return this.http.post<{ data: any }>(`${this.api}/admin/participantes/retirar`, { ids, motivo }).pipe(this.enZona(), map((r) => r.data));
  }

  reintegrarParticipantes(ids: string[]): Observable<{ reintegrados: number }> {
    return this.http.post<{ data: any }>(`${this.api}/admin/participantes/reintegrar`, { ids }).pipe(this.enZona(), map((r) => r.data));
  }

  sincronizarParticipantes(edicionId: string): Observable<{ inscritos: number; nuevos: number }> {
    return this.http.post<{ data: any }>(`${this.api}/ediciones/${edicionId}/sincronizar-participantes`, {}).pipe(this.enZona(), map((r) => r.data));
  }

  resumenFinal(edicionId: string): Observable<ResumenFinal> {
    return this.http.get<{ data: ResumenFinal }>(`${this.api}/admin/ediciones/${edicionId}/resumen-final`).pipe(this.enZona(), map((r) => r.data));
  }

  cerrarEdicion(edicionId: string): Observable<{ rondas_cerradas: number; inversiones_liquidadas: number; total_liquidado: number }> {
    return this.http.post<{ data: any }>(`${this.api}/admin/ediciones/${edicionId}/cerrar`, { confirmar: 'CERRAR' }).pipe(this.enZona(), map((r) => r.data));
  }

  abrirEdicion(edicionId: string): Observable<{ provisiones: number; bienvenidas: number }> {
    return this.http.post<{ data: any }>(`${this.api}/ediciones/${edicionId}/abrir`, {}).pipe(this.enZona(), map((r) => r.data));
  }

  equipo(edicionId: string): Observable<MiembroEquipo[]> {
    return this.http.get<{ data: MiembroEquipo[] }>(`${this.api}/admin/ediciones/${edicionId}/equipo`).pipe(this.enZona(), map((r) => r.data));
  }

  /** Reenvía por correo el aviso de asignación a todo el equipo de la edición. */
  avisarEquipo(edicionId: string): Observable<{ equipo: number; enviados: number }> {
    return this.http.post<{ data: { equipo: number; enviados: number } }>(`${this.api}/admin/ediciones/${edicionId}/equipo/avisar`, {}).pipe(this.enZona(), map((r) => r.data));
  }

  agregarAlEquipo(edicionId: string, usuarioIds: string[]): Observable<{ agregados: number }> {
    return this.http.post<{ data: any }>(`${this.api}/admin/ediciones/${edicionId}/equipo`, { usuario_ids: usuarioIds }).pipe(this.enZona(), map((r) => r.data));
  }

  asignarPaisDocente(miembroId: string, paisId: string | null): Observable<{ ok: boolean }> {
    return this.http.patch<{ data: any }>(`${this.api}/admin/equipo/${miembroId}`, { pais_id: paisId }).pipe(this.enZona(), map((r) => r.data));
  }

  quitarDelEquipo(miembroId: string): Observable<{ quitado: boolean }> {
    return this.http.delete<{ data: any }>(`${this.api}/admin/equipo/${miembroId}`).pipe(this.enZona(), map((r) => r.data));
  }

  provisionarPais(paisId: string, billetes: Record<string, number>): Observable<{ agregado: number; saldo_banco: number; provision_total: number }> {
    return this.http.post<{ data: any }>(`${this.api}/admin/paises/${paisId}/provisionar`, { billetes }).pipe(this.enZona(), map((r) => r.data));
  }

  // ---------- Arqueo del banco ----------

  reparto(edicionId: string): Observable<DatosReparto> {
    return this.http.get<{ data: DatosReparto }>(`${this.api}/ediciones/${edicionId}/reparto`).pipe(this.enZona(), map((r) => r.data));
  }

  entregarADocente(paisId: string, docenteId: string, billetes: Record<string, number>, clave: string): Observable<{ monto: number; saldo_origen: number; saldo_destino: number }> {
    return this.http.post<{ data: any }>(`${this.api}/transferencias`, {
      tipo: 'banco_docente', pais_id: paisId, docente_id: docenteId, billetes, clave_idempotencia: clave,
    }).pipe(this.enZona(), map((r) => r.data));
  }

  /** Banco → cuenta del docente, sin billetes. */
  transferirADocente(paisId: string, docenteId: string, monto: number, clave: string): Observable<{ monto: number; saldo_origen: number; saldo_destino: number }> {
    return this.http.post<{ data: any }>(`${this.api}/transferencias`, {
      tipo: 'banco_docente', electronica: true, pais_id: paisId, docente_id: docenteId, monto, clave_idempotencia: clave,
    }).pipe(this.enZona(), map((r) => r.data));
  }

  /** Cuenta del docente → cuenta del estudiante (por su id o por su llave), sin billetes. */
  transferirAEstudiante(destino: { participante_id?: string; llave?: string }, monto: number, clave: string): Observable<{ monto: number; saldo_origen: number; saldo_destino: number }> {
    return this.http.post<{ data: any }>(`${this.api}/transferencias`, {
      tipo: 'docente_estudiante', electronica: true, ...destino, monto, clave_idempotencia: clave,
    }).pipe(this.enZona(), map((r) => r.data));
  }

  /** A quién pertenece una llave (o el texto de un QR de tarjeta). */
  duenoDeLlave(llave: string): Observable<DuenoLlave> {
    return this.http.get<{ data: DuenoLlave }>(`${this.api}/cuentas/llave/${encodeURIComponent(llave.trim())}`).pipe(this.enZona(), map((r) => r.data));
  }

  cuentas(edicionId: string): Observable<DatosCuentas> {
    return this.http.get<{ data: DatosCuentas }>(`${this.api}/ediciones/${edicionId}/cuentas`).pipe(this.enZona(), map((r) => r.data));
  }

  tarjetasParaImprimir(edicionId: string): Observable<{ edicion: { id: string; nombre: string }; tarjetas: TarjetaImprimir[] }> {
    return this.http.get<{ data: any }>(`${this.api}/ediciones/${edicionId}/tarjetas`).pipe(this.enZona(), map((r) => r.data));
  }

  /** El estudiante entrega billetes al banco y le suben a su cuenta. */
  consignar(participanteId: string, billetes: Record<string, number>, clave: string): Observable<{ monto: number; efectivo: number; cuenta: number }> {
    return this.http.post<{ data: any }>(`${this.api}/cuentas/consignar`, { participante_id: participanteId, billetes, clave_idempotencia: clave }).pipe(this.enZona(), map((r) => r.data));
  }

  /** El estudiante saca dinero de su cuenta y recibe billetes del banco. */
  retirarDeCuenta(participanteId: string, billetes: Record<string, number>, clave: string): Observable<{ monto: number; efectivo: number; cuenta: number }> {
    return this.http.post<{ data: any }>(`${this.api}/cuentas/retirar`, { participante_id: participanteId, billetes, clave_idempotencia: clave }).pipe(this.enZona(), map((r) => r.data));
  }

  panelDocente(edicionId: string): Observable<DatosDocente> {
    return this.http.get<{ data: DatosDocente }>(`${this.api}/ediciones/${edicionId}/docente`).pipe(this.enZona(), map((r) => r.data));
  }

  entregarAEstudiante(participanteId: string, billetes: Record<string, number>, clave: string): Observable<{ monto: number; saldo_origen: number; saldo_destino: number }> {
    return this.http.post<{ data: any }>(`${this.api}/transferencias`, {
      tipo: 'docente_estudiante', participante_id: participanteId, billetes, clave_idempotencia: clave,
    }).pipe(this.enZona(), map((r) => r.data));
  }

  wfunds(edicionId: string): Observable<DatosWfunds> {
    return this.http.get<{ data: DatosWfunds }>(`${this.api}/ediciones/${edicionId}/wfunds`).pipe(this.enZona(), map((r) => r.data));
  }

  abrirRonda(edicionId: string, duracionMinutos: number): Observable<RondaWfunds> {
    return this.http.post<{ data: RondaWfunds }>(`${this.api}/ediciones/${edicionId}/rondas`, { duracion_minutos: duracionMinutos }).pipe(this.enZona(), map((r) => r.data));
  }

  /** Las rondas dejan de reanudarse solas en la siguiente franja del horario. */
  detenerRondas(edicionId: string): Observable<unknown> {
    return this.http.post<{ data: unknown }>(`${this.api}/ediciones/${edicionId}/rondas/detener`, {}).pipe(this.enZona(), map((r) => r.data));
  }

  /** El estudiante saca su dinero de una empresa: recibe lo que vale hoy su inversión. */
  retirarInversion(inversionId: string, billetes: Record<string, number>): Observable<{ monto_pagado: number }> {
    return this.http.post<{ data: { monto_pagado: number } }>(`${this.api}/inversiones/${inversionId}/retirar`, { billetes }).pipe(this.enZona(), map((r) => r.data));
  }

  /** Cierra la ronda ya; con `continuar` se abre la siguiente con la misma duración. */
  cerrarRonda(rondaId: string, continuar: boolean): Observable<{ inversiones: number; valor_antes: number; valor_despues: number; siguiente: RondaWfunds | null }> {
    return this.http.post<{ data: { inversiones: number; valor_antes: number; valor_despues: number; siguiente: RondaWfunds | null } }>(`${this.api}/rondas/${rondaId}/cerrar`, { continuar })
      .pipe(this.enZona(), map((r) => r.data));
  }

  invertir(participanteId: string, fondoId: string, rondaId: string, billetes: Record<string, number>, clave: string): Observable<{ monto: number }> {
    return this.http.post<{ data: { monto: number } }>(`${this.api}/inversiones`, {
      participante_id: participanteId, fondo_id: fondoId, ronda_id: rondaId, billetes, clave_idempotencia: clave,
    }).pipe(this.enZona(), map((r) => r.data));
  }

  rubrica(edicionId: string): Observable<DatosRubrica> {
    return this.http.get<{ data: DatosRubrica }>(`${this.api}/ediciones/${edicionId}/rubrica`).pipe(this.enZona(), map((r) => r.data));
  }

  /** Califica (cada criterio de 0 a 3) y devuelve el puntaje (0 a 12) y la recompensa recomendada en billetes. */
  calificar(participanteId: string, criterios: Record<CriterioRubrica, number>, idioma: 'ingles' | 'frances', evidencia: string): Observable<{ id: string; puntaje: number; recompensa: number }> {
    return this.http.post<{ data: { id: string; puntaje: number; recompensa: number } }>(`${this.api}/evaluaciones`, { participante_id: participanteId, ...criterios, idioma, evidencia })
      .pipe(this.enZona(), map((r) => r.data));
  }

  deshacerCalificacion(id: string): Observable<unknown> {
    return this.http.delete<{ data: unknown }>(`${this.api}/evaluaciones/${id}`).pipe(this.enZona(), map((r) => r.data));
  }

  marcarAsistencia(participanteId: string, presente: boolean): Observable<{ presente: boolean }> {
    return this.http.patch<{ data: { presente: boolean } }>(`${this.api}/asistencia`, { participante_id: participanteId, presente }).pipe(this.enZona(), map((r) => r.data));
  }

  tipoCambio(edicionId: string): Observable<DatosTipoCambio> {
    return this.http.get<{ data: DatosTipoCambio }>(`${this.api}/ediciones/${edicionId}/tipo-cambio`).pipe(this.enZona(), map((r) => r.data));
  }

  caja(edicionId: string): Observable<DatosCaja> {
    return this.http.get<{ data: DatosCaja }>(`${this.api}/ediciones/${edicionId}/caja`).pipe(this.enZona(), map((r) => r.data));
  }

  /** Vende en la caja: en efectivo (billetes y vuelto) o con tarjeta débito ({ metodo: 'tarjeta', llave }). */
  vender(datos: { participante_id: string; items: { producto_id: string; cantidad: number }[]; billetes_recibidos?: Record<string, number>; billetes_vuelto?: Record<string, number>; clave_idempotencia: string; metodo?: 'efectivo' | 'tarjeta'; llave?: string }):
    Observable<{ numero_recibo: string; total_billetes: number; saldo: number; items: { nombre: string; cantidad: number; precio_billetes: number }[] }> {
    return this.http.post<{ data: any }>(`${this.api}/ventas`, datos).pipe(this.enZona(), map((r) => r.data));
  }

  /** La caja entrega billetes al banco de un país. */
  entregarCajaAlBanco(edicionId: string, paisId: string, billetes: Record<string, number>, clave: string): Observable<{ monto: number }> {
    return this.http.post<{ data: { monto: number } }>(`${this.api}/ediciones/${edicionId}/caja/entregar`, { pais_id: paisId, billetes, clave_idempotencia: clave })
      .pipe(this.enZona(), map((r) => r.data));
  }

  misEdiciones(): Observable<EdicionVigente[]> {
    return this.http.get<{ data: any[] }>(`${this.api}/mis-ediciones`).pipe(this.enZona(), map((r) => r.data));
  }

  arqueo(edicionId: string): Observable<DatosArqueo> {
    return this.http.get<{ data: DatosArqueo }>(`${this.api}/ediciones/${edicionId}/arqueo`).pipe(this.enZona(), map((r) => r.data));
  }

  guardarArqueo(edicionId: string, paisId: string, conteo: Record<string, number>, observaciones: string): Observable<Arqueo> {
    return this.http.post<{ data: Arqueo }>(`${this.api}/ediciones/${edicionId}/arqueos`, { pais_id: paisId, conteo, observaciones })
      .pipe(this.enZona(), map((r) => r.data));
  }

  subirFoto(nombre: string, tipo: string, base64: string): Observable<{ id: string }> {
    return this.http.post<{ data: { id: string } }>(`${this.api}/admin/fotos`, { nombre, tipo, base64 }).pipe(this.enZona(), map((r) => r.data));
  }

  /** URL de la foto de un producto (las imágenes no envían el token en el encabezado). */
  /** Logos de empresas ya cargados en cualquier edición. */
  logosFondos(): Observable<{ id: string; nombre: string }[]> {
    return this.http.get<{ data: { id: string; nombre: string }[] }>(`${this.api}/admin/logos-fondos`).pipe(this.enZona(), map((r) => r.data));
  }

  /** Llena los fondos sin logo o sin textos de la edición con lo ya cargado. */
  completarFondos(edicionId: string): Observable<{ completados: number }> {
    return this.http.post<{ data: { completados: number } }>(`${this.api}/admin/ediciones/${edicionId}/fondos/completar`, {}).pipe(this.enZona(), map((r) => r.data));
  }

  urlFoto(id: string): string {
    return `${this.api}/foto/${id}?access_token=${encodeURIComponent(StorageServices.getAccessToken() ?? '')}`;
  }

  /** Mensaje en español que devuelve la extensión, o uno genérico. */
  static mensajeDeError(error: unknown, porDefecto?: string): string {
    const e = error as HttpErrorResponse;
    return e?.error?.errors?.[0]?.message || (e?.status === 0
      ? IdiomaWillGoService.traducir('wg.errores.sinConexion', 'Sin conexión con el servidor. Revisa el internet.')
      : porDefecto ?? IdiomaWillGoService.traducir('wg.errores.generico', 'No se pudo completar la operación. Intenta de nuevo.'));
  }
}
