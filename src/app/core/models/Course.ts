import {Meeting} from './Meeting';
import {Nivel} from './Nivel';

export class Course {
  id?: string;
  nombre: string;
  precio?: string;
  codigo: string;
  img?: string;
  img_url?: string;
  sku?: string;
  precio_inscripcion?: number;
  programa_independiente?: boolean;
  moneda?: string;
  estudiantes?: any[];
  cuentas_cobrar?: any[];
  colegios_cursos?: any[];
}

export interface ProgramaAyo {
  id?: string;
  fecha_creacion?: string;
  fecha_finalizacion: string;
  curso_id: string;
  precio_curso?: number;
  tiene_precio_especial?: boolean;
  precio_especial?: number | null;
  programa_con_inscripcion?: boolean;
  moneda?: string;
  precio_inscripcion?: number | null;
  fecha_finalizacion_precio_especial?: string | null;
  idioma?: string;
  id_nivel?: Nivel;
  id_reuniones_meet?: Meeting[];
  img?: any;
  cuentas_cobrar_id?: any[];
  plan_estudio_id?: PlanEstudio[] | string;

}

export interface ProgramGroup {
  tematica: string;
  nivel?: string;
  subcategoria?: string;
  img?: any;
  programs: ProgramaAyo[];
  id_nivel?: Nivel;
}

export interface PrecioProgramaAyo {
  id?: string;
  precio: number;
  nombre: string;
  precio_especial: number | null;
  fecha_creacion: string | null;
  fecha_finalizacion_precio_especial: string | null;
  tiene_precio_especial: boolean;
}

export class ColegioCurso {
  id?: number;
  fecha_finalizacion: string;
  curso_id: number;
  colegio_id: number;
  precio_curso?: number;
  tiene_precio_especial?: string;
  precio_especial?: number | null;
  programa_independiente?: boolean;
  idioma?: string;
}

export class PlanEstudio {
  plan: string;
  realizado: boolean;
}
