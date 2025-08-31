export interface Rector {
  id?: number;
  nombre: string;
  apellido: string;
  celular: string;
  email: string;
  colegio_id: number;
  colegio?: string; // Para mostrar el nombre del colegio en la vista
}
