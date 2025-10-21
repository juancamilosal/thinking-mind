export class Course {
  id?: string;
  nombre: string;
  precio?: string;
  codigo: string;
  img?: string; // Campo que viene del servicio
  img_url?: string; // URL construida para mostrar la imagen
  sku?: string;
  precio_inscripcion?: number;
  programa_independiente?: boolean; // Nuevo campo para programa independiente
  estudiantes?: any[];
  cuentas_cobrar?: any[];
  colegios_cursos?: any[]; // Array de objetos completos con colegio_id expandido
}
