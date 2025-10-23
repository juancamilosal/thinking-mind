import {Client} from './Clients';
import {Student} from './Student';
import {Course} from './Course';

export class PaymentModel {
  id?: string;
  cuenta_cobrar_id: AccountReceivable;
  valor: number;
  fecha_pago: string;
  metodo_pago: string;
  pagador: string;
  numero_transaccion?: string;
  estado: string;
  comprobante?: string;
  tarifa?: number;
  comision?: number;
  iva?: number;
  valor_neto?:number;
  retencion_fuente?: number;
}

export class AccountReceivable {
  id: string;
  cliente_id: Client | string;
  estudiante_id: Student | string;
  monto: number;
  saldo?: number;
  curso_id: Course | null;
  fecha_limite?: string;
  estado: string;
  pin_entregado?: boolean | string;
  es_inscripcion?: string; // 'TRUE' | 'FALSE' u otro formato del backend
  pagos?: PaymentModel[];
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  studentName?: string;
  schoolName?: string;
  createdDate?: string;
  fecha_inscripcion?: string;
  fecha_finalizacion?: string;
  descuento?: number;
  id_inscripcion?: string | null;
  // Propiedades adicionales según la estructura JSON del servicio
  colegio_id?: any; // Para el colegio
  ciudad?: string;
  acudiente?: string;
  apellido?: string;
  celular?: string;
  direccion?: string;
  rector_id?: string;
  grado?: string;
  nombre?: string;
  numero_documento?: string;
  tipo_documento?: string;
  fecha_creacion?: string;
  observaciones?: string;
  precio_inscripcion?: number;
  colegios_cursos?: any;
}

export class TotalAccounts {
  total_charge:number
  total_expired: number
}

export class PaymentReceivable {
  id?: string;
  cliente: Client | string;
  estudiante: Student | string;
  curso_id: string;
  precio: number;
  precio_inscripcion?: number;
  estado: string;
}

export class ReturnAccount {
  id?: string;
  monto?: number;
  comprobante?: string;
}
