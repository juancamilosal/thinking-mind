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