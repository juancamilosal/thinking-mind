export class CourseEnrollmentData {
  courseId: string;
  courseName: string;
  coursePrice: string;
  accountsCount: number;
  totalEnrolledAmount: number;
  accounts: {
    accountId: string;
    studentName?: string;
    clientName?: string;
    amount: number;
    balance: number;
    paymentDate: string;
    paymentMethod: string;
    approvalNumber: string;
  }[];
}

export class EnrollmentSummary {
  totalCourses: number;
  totalAccounts: number;
  totalEnrolledAmount: number;
  courses: CourseEnrollmentData[];
}