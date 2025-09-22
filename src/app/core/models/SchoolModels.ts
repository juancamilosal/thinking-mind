import { School } from './School';
import { Student } from './Student';
import { AccountReceivable } from './AccountReceivable';

export class StudentAccountReceivable {
  student: Student;
  accountsReceivable: AccountReceivable[];
  totalAmount: number;
  totalPending: number;
}

export class StudentWithAccount {
  student: Student;
  account: AccountReceivable;
}

export class CourseWithStudents {
  id?: string;
  nombre?: string;
  precio?: string;
  sku?: string;
  course?: any;
  students: StudentAccountReceivable[];
  expanded?: boolean;
  isExpanded?: boolean;
  totalStudents: number;
  totalAccounts?: number;
  newStudentsToday?: number;
  newStudentNames?: string[];
}

export class CourseWithStudentsAlternative {
  course: any;
  students: StudentWithAccount[];
  isExpanded?: boolean;
}

export class SchoolWithAccounts {
  school: School;
  accountsCount: number;
  studentsCount: number;
  totalAmount: number;
  accounts: AccountReceivable[];
  showStudents?: boolean;
  isLoadingStudents?: boolean;
  students?: StudentWithAccount[];
}

export class SchoolWithCourses {
  school: School;
  courses: CourseWithStudentsAlternative[];
  totalStudents: number;
  totalAmount: number;
  isExpanded?: boolean;
}

export class CourseWithSchools {
  course: any;
  schools: SchoolInCourse[];
  totalStudents: number;
  totalAmount: number;
  isExpanded?: boolean;
}

export class SchoolInCourse {
  school: School;
  students: StudentWithAccount[];
  totalStudents: number;
  totalAmount: number;
}