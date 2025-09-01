import { Client } from './Clients';
import { Course } from './Course';

export class Student {
  id?: string;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido: string;
  colegio: string;
  acudiente?: Client | string;
  colegio_id?: string;
  curso_id?: Course;
}

