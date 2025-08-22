import {Client} from './Clients';
import {Student} from './Student';

export class AccountReceivable {
  id: string;
  cliente_id: Client | string;
  estudiante_id: Student | string;
  monto: number;
  saldo: number;
  curso: string;
  fecha_limite: string;
  estado: string;
  // Campos adicionales para la UI (opcionales)
  clientName?: string;
  clientEmail?: string;
  studentName?: string;
  createdDate?: string;
}
