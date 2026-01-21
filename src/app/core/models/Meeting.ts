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


export class Nivel {
    id: string;
    categoria: string;
    subcategoria: string;
    nivel: string;
    idioma: string;
    tematica: string;
    imagen?: string;
}

export class Docente {
  first_name: string;
  last_name: string;
}
