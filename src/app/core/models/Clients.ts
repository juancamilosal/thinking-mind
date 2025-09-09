import {Student} from './Student';
import {AccountReceivable, PaymentModel} from './AccountReceivable';

export class Client {
  id?: number;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido: string;
  celular: string;
  email: string;
  direccion: string;
  estudiantes?: Student[];
  cuentas_cobrar?: AccountReceivable[]
}
