import {AccountReceivable} from './AccountReceivable';

export class Meeting {
    id: string;
    fecha_inicio: string;
    fecha_finalizacion: string;
    id_reunion: string;
    link_reunion: string;
    id_cuentas_cobrar: AccountReceivable[];
    id_docente: Docente;
    dia_semana?: string;
    hora_inicio?: string;
    hora_fin?: string;
    link_meet?: string;
}


export class Docente {
  id: string;
  first_name: string;
  last_name: string;
}
