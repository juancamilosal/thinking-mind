import {School} from './School';

export class User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
  celular?: string;
  colegio_id?: School;
  tipo_documento?: string;
  numero_documento?: string;
  nivel_id?: string;
  calificacion?: number;
  valor_hora?: number;
}
