export class Course {
  id?: string;
  nombre: string;
  precio: string;
  codigo: string;
  img?: string; // Campo que viene del servicio
  img_url?: string; // URL construida para mostrar la imagen
  sku?: string;
  precio_inscripcion?: number;
  imagen: File;
}
