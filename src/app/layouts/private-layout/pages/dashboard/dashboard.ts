import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolService } from '../../../../core/services/school.service';
import { StudentService } from '../../../../core/services/student.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import { CourseService } from '../../../../core/services/course.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { School } from '../../../../core/models/School';
import { Course } from '../../../../core/models/Course';
import { forkJoin } from 'rxjs';

interface DashboardStats {
  totalStudents: number;
  totalAccountsReceivable: number;
  totalAmountReceivable: number;
  totalPaidAmount: number;
  pendingPayments: number;
  overdueAmount: number;
  monthlyPayments: number;
}

interface RectorDashboardStats {
  totalStudentsEnrolled: number;
  totalStudentsWithPendingStatus: number;
  totalStudentsWithPaidStatus: number;
  totalPinsDelivered: number;
}

interface CourseWithStudents {
  course: Course;
  studentCount: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html'
})
export class Dashboard implements OnInit {
  stats: DashboardStats = {
    totalStudents: 0,
    totalAccountsReceivable: 0,
    totalAmountReceivable: 0,
    totalPaidAmount: 0,
    pendingPayments: 0,
    overdueAmount: 0,
    monthlyPayments: 0
  };

  rectorStats: RectorDashboardStats = {
    totalStudentsEnrolled: 0,
    totalStudentsWithPendingStatus: 0,
    totalStudentsWithPaidStatus: 0,
    totalPinsDelivered: 0
  };

  isLoading = true;
  courses: Course[] = [];
  students: any[] = [];
  accounts: any[] = [];
  coursesWithStudents: CourseWithStudents[] = [];
  currentDate = new Date();
  userRole: string = '';
  userColegioId: string = '';
  isRector: boolean = false;

  constructor(
    private schoolService: SchoolService,
    private studentService: StudentService,
    private accountReceivableService: AccountReceivableService,
    private courseService: CourseService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.isLoading = true;

    // Obtener información del usuario desde sessionStorage
    const userData = sessionStorage.getItem('current_user');
    if (userData) {
      const user = JSON.parse(userData);
      this.userRole = user.role;
      this.userColegioId = user.colegio_id;
      this.isRector = user.role === 'a4ed6390-5421-46d1-b81e-5cad06115abc';
    }

    if (this.isRector && this.userColegioId) {
      // Usuario es rector - cargar solo datos de su colegio
      this.loadRectorData();
    } else {
      // Usuario es administrador - cargar todos los datos
      this.loadAdminData();
    }
  }

  private loadRectorData(): void {
    console.log('userColegioId del rector:', this.userColegioId);

    forkJoin({
      students: this.studentService.getStudentsBySchool(this.userColegioId!),
      accounts: this.accountReceivableService.searchAccountReceivable()
    }).subscribe({
      next: ({ students, accounts }) => {
        this.students = students.data;
        console.log('Total cuentas recibidas:', accounts.data.length);

        const schoolAccounts = accounts.data.filter(account => {
          if (typeof account.estudiante_id === 'object' && account.estudiante_id !== null) {
            const colegioId = (account.estudiante_id as any).colegio_id?.id;
            console.log('Cuenta ID:', account.id, 'Colegio ID:', colegioId, 'Match:', colegioId === this.userColegioId);
            return colegioId === this.userColegioId;
          }
          return false;
        });

        const accountsToProcess = schoolAccounts.length > 0 ? schoolAccounts : accounts.data;

         this.calculateRectorStats(this.students, accountsToProcess);
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  private loadAdminData(): void {
    forkJoin({
        courses: this.courseService.searchCourse(),
        students: this.studentService.searchStudent(),
        accounts: this.accountReceivableService.searchAccountReceivable()
      }).subscribe({
      next: ({ courses, students, accounts }) => {
        this.courses = courses.data;
        this.students = students.data;
        this.accounts = accounts.data;

        this.calculateCoursesWithStudents();
        this.calculateStats(this.courses, this.students, this.accounts);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading admin data:', error);
        this.isLoading = false;
      }
    });
  }

  private calculateCoursesWithStudents(): void {
    this.coursesWithStudents = this.courses.map(course => {
      const studentCount = this.students.filter(student => {
        return student.curso_id === course.id ||
               (student.cursos && student.cursos.some((c: any) => c.id === course.id));
      }).length;

      return {
        course,
        studentCount
      };
    });
  }

  private calculateRectorStats(students: any[], accounts: any[]): void {
    // Total de estudiantes inscritos en el colegio
    this.rectorStats.totalStudentsEnrolled = students.length;

    let studentsWithPaidStatus = 0;
    let studentsWithPendingStatus = 0;
    let pinsDelivered = 0;

    accounts.forEach(account => {
      // Contar según el estado de la cuenta
      if (account.estado === 'PAGADA') {
        studentsWithPaidStatus++;
      } else if (account.estado === 'PENDIENTE') {
        studentsWithPendingStatus++;
      }

      // Contar pines entregados - verificar 'SI' con múltiples variaciones
      const pinValue = account.pin_entregado;
      if (pinValue === 'SI' || pinValue === 'Si' || pinValue === 'si' || pinValue === true || pinValue === 1 || pinValue === '1') {
        pinsDelivered++;
      }
    });

    console.log('Cuentas procesadas:', accounts.length);
    console.log('Estados PAGADA:', studentsWithPaidStatus);
    console.log('Estados PENDIENTE:', studentsWithPendingStatus);
    console.log('Pines SI:', pinsDelivered);

    this.rectorStats.totalStudentsWithPaidStatus = studentsWithPaidStatus;
    this.rectorStats.totalStudentsWithPendingStatus = studentsWithPendingStatus;
    this.rectorStats.totalPinsDelivered = pinsDelivered;
  }

  private calculateStats(courses: Course[], students: any[], accounts: any[]): void {
    this.stats.totalStudents = students.length;
    this.stats.totalAccountsReceivable = accounts.length;

    let totalAmount = 0;
    let totalPaid = 0;
    let pendingCount = 0;
    let overdueAmount = 0;
    let monthlyPayments = 0;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    accounts.forEach(account => {
      const precio = parseFloat(account.monto || account.precio) || 0;
      totalAmount += precio;

      if (account.pagos && Array.isArray(account.pagos)) {
        const paidAmount = account.pagos.reduce((sum: number, pago: any) => {
          return sum + (parseFloat(pago.valor || pago.monto) || 0);
        }, 0);
        totalPaid += paidAmount;

        // Calcular pagos del mes actual
        account.pagos.forEach((pago: any) => {
          if (pago.fecha_pago) {
            const paymentDate = new Date(pago.fecha_pago);
            if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
              monthlyPayments += parseFloat(pago.valor || pago.monto) || 0;
            }
          }
        });

        if (paidAmount < precio) {
          pendingCount++;

          // Verificar si la cuenta está vencida
          if (account.fecha_vencimiento) {
            const dueDate = new Date(account.fecha_vencimiento);
            if (currentDate > dueDate) {
              overdueAmount += (precio - paidAmount);
            }
          }
        }
      } else {
        pendingCount++;

        // Si no hay pagos y hay fecha de vencimiento, verificar si está vencida
        if (account.fecha_vencimiento) {
          const dueDate = new Date(account.fecha_vencimiento);
          if (currentDate > dueDate) {
            overdueAmount += precio;
          }
        }
      }
    });

    this.stats.totalAmountReceivable = totalAmount;
    this.stats.totalPaidAmount = totalPaid;
    this.stats.pendingPayments = pendingCount;
    this.stats.overdueAmount = overdueAmount;
    this.stats.monthlyPayments = monthlyPayments;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  getPaymentProgress(): number {
    if (this.stats.totalAmountReceivable === 0) return 0;
    return (this.stats.totalPaidAmount / this.stats.totalAmountReceivable) * 100;
  }
}