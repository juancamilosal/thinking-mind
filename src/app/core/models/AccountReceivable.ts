import {Client} from './Clients';
import {Student} from './Student';
import {Course} from './Course';

export class PaymentModel {
  id?: string;
  cuenta_cobrar_id: {
    id: string;
    monto: number;
    fecha_limite: string | null;
    saldo: number;
    cliente_id: string;
    estudiante_id: string;
    estado: string;
    observaciones: string | null;
    pin_entregado: string;
    fecha_creacion: string;
    fecha_inscripcion: string;
    pagos: string[];
    curso_id: {
      id: string;
      nombre: string;
      precio: string;
      sku: string;
      precio_inscripcion: number;
      img: string;
      estudiantes: any[];
      cuentas_cobrar: string[];
    };
  };
  valor: number;
  fecha_pago: string;
  metodo_pago: string;
  pagador: string;
  numero_transaccion?: string;
  estado: string;
  comprobante?: string;
}

export class AccountReceivable {
  id: string;
  cliente_id: Client | string;
  estudiante_id: Student | string;
  monto: number;
  saldo?: number;
  curso_id: Course | null;
  fecha_limite: string;
  estado: string;
  pin_entregado?: boolean | string;
  pagos?: PaymentModel[];
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  studentName?: string;
  schoolName?: string;
  createdDate?: string;
  fecha_inscripcion?: string;
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
  estado: string;
}
