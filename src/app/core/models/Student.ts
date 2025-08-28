import { Client } from './Clients';

export class Student {
  id?: string;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido: string;
  colegio: string;
  acudiente?: Client | string;
}

