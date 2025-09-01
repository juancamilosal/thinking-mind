import {User} from './User';
import {Student} from './Student';

export class School {
  id?: string;
  nombre: string;
  ciudad: string;
  direccion: string;
  rector_id?: User[];
  celular: string;
  estudiante_id?: Student[];
}
