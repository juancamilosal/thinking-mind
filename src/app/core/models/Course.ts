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
  id_nivel?: string;
  id_reuniones_meet?: any[];
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
