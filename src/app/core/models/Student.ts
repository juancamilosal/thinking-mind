import { Client } from './Clients';
import { Course } from './Course';
import {School} from './School';

export class Student {
  id?: string;
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  apellido: string;
  grado?: string;
  acudiente?: Client | string;
  colegio_id?: School;
  curso_id?: Course;
  colegio_independiente?: string;
  programa_independiente?: boolean;
  accountInfo?: any;
}

