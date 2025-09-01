import {User} from './User';

export class School {
  id?: string;
  nombre: string;
  ciudad: string;
  direccion: string;
  rector_id?: User[];
  celular: string;
  estudiante_id?: any[];
}
