import { Course } from './Course';

export class DashboardStats {
  totalStudents: number;
  totalAccountsReceivable: number;
  totalAmountReceivable: number;
  totalPaidAmount: number;
  pendingPayments: number;
  overdueAmount: number;
  monthlyPayments: number;
  totalPendingAccountsReceivable: number;
}

export class RectorDashboardStats {
  totalStudentsEnrolled: number;
  totalStudentsWithPendingStatus: number;
  totalPinsDelivered: number;
  totalStudentsWithPaidStatus: number;
}

export class CourseWithStudents {
  course: Course;
  studentCount: number;
}

export interface TeacherMeeting {
  id: string;
  id_reunion: string;
  link_reunion: string;
  fecha_inicio: string;
  fecha_finalizacion: string;
  id_programa_ayo: {
    id: string;
    idioma: string;
    id_nivel: {
      nivel: string;
      subcategoria: string;
      tematica: string;
      idioma: string;
    };
  };
}

export interface TeacherDashboardStats {
  horas_trabajadas: number;
  reuniones_meet_id: TeacherMeeting[];
}