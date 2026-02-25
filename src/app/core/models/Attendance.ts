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

export interface AttendanceItem {
  id?: string;
  fecha: string | Date;
  studentName: string;
  email?: string;
  attended: boolean;
  score: string | number;
  attendancePercentage?: number;
  currentLevelId?: string;
  levelName?: string;
  level?: string;
  subcategoria?: string;
  creditos?: number;
}
