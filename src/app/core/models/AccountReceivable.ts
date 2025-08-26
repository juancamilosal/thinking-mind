import {Client} from './Clients';
import {Student} from './Student';
import {Course} from './Course';

export class PaymentRecord {
  id?: string;
  cuenta_cobrar_id: string;
  valor: number;
  fecha_pago: string;
  metodo_pago: string;
  pagador: string;
  numero_aprobacion?: string;
  estado: string;
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
  pagos?: PaymentRecord[];
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  studentName?: string;
  createdDate?: string;
}

export class TotalAccounts {
  total_charge:number
  total_expired: number
}

export class PaymentReceivable {
  id: string;
  cliente_id: string;
  estudiante_id: string;
  curso_id: string;
  precio: number;
}
