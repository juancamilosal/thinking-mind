export class Meeting {
    id: string;
    fecha_inicio: string;
    fecha_finalizacion: string;
    id_reunion: string;
    link_reunion: string;
    id_colegios_cursos: MeetingColegioCurso[];
    id_cuentas_cobrar: any[];
}

export class MeetingColegioCurso {
    curso_id: {
        nombre: string;
    };
    colegio_id: {
        nombre: string;
    };
}
