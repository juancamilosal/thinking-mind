import {Client} from './Clients';
import {Student} from './Student';

export class PaymentRecord {
  id?: string;
  cuenta_cobrar_id: string;  // ✅ Este es el campo correcto
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
  curso: string;
  fecha_limite: string;
  estado: string;
  pagos?: PaymentRecord[];
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  studentName?: string;
  createdDate?: string;
}
