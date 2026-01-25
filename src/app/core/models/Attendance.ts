export interface Attendance {
    id: string;
    status?: string;
    date_created?: string;
    date_updated?: string;
    user_created?: string;
    user_updated?: string;
    fecha?: string;
    calificacion?: number;
    asiste?: boolean;
    estudiante_id?: string;
    observaciones?: string;
    [key: string]: any;
}
