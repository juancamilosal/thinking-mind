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
  // Extended fields for student registration & test tracking
  email?: string;
  test_completado?: boolean;
  nivel_idioma?: string;
  test_resultado?: any;
}

export class Certification {
  estudiante_id?: string;
  nivel_id?: string;
}

