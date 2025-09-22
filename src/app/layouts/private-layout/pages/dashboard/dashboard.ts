import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolService } from '../../../../core/services/school.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import { CourseService } from '../../../../core/services/course.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { School } from '../../../../core/models/School';
import { Course } from '../../../../core/models/Course';
import { forkJoin } from 'rxjs';

class DashboardStats {
  totalStudents: number;
  totalAccountsReceivable: number;
  totalAmountReceivable: number;
  totalPaidAmount: number;
  pendingPayments: number;
  overdueAmount: number;
  monthlyPayments: number;
  totalPendingAccountsReceivable: number;
}

class RectorDashboardStats {
  totalStudentsEnrolled: number;
  totalStudentsWithPendingStatus: number;
  totalPinsDelivered: number;
  totalStudentsWithPaidStatus: number;
}

class CourseWithStudents {
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
    monthlyPayments: 0,
    totalPendingAccountsReceivable: 0
  };

  rectorStats: RectorDashboardStats = {
    totalStudentsEnrolled: 0,
    totalStudentsWithPendingStatus: 0,
    totalPinsDelivered: 0,
    totalStudentsWithPaidStatus: 0
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
    this.accountReceivableService.searchAccountReceivable(undefined, this.userColegioId!).subscribe({
      next: (accounts) => {
        this.accounts = accounts.data; // Ya vienen filtradas por colegio desde el servicio
        this.calculateRectorStats(accounts.data);
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
        accounts: this.accountReceivableService.searchAccountReceivable()
      }).subscribe({
      next: ({ courses, accounts }) => {
        this.courses = courses.data;
        this.accounts = accounts.data;

        this.calculateCoursesWithStudents();
        this.calculateStats(this.courses, this.accounts);
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  private calculateCoursesWithStudents(): void {
    this.coursesWithStudents = this.courses.map(course => {
      // Contar estudiantes únicos por curso usando las cuentas por cobrar
      const uniqueStudentIds = new Set();
      this.accounts.forEach(account => {
        if (account.curso_id && account.curso_id.id === course.id && account.estudiante_id && account.estudiante_id.id) {
          uniqueStudentIds.add(account.estudiante_id.id);
        }
      });

      return {
        course,
        studentCount: uniqueStudentIds.size
      };
    });
  }

  private calculateRectorStats(accounts: any[]) {
    // Calcular estudiantes inscritos: solo contar cuentas que tienen fecha_inscripcion
    this.rectorStats.totalStudentsEnrolled = accounts.filter(account =>
      account.fecha_inscripcion && account.fecha_inscripcion !== null
    ).length;

    // Calcular estudiantes con estado pendiente: solo contar estudiantes únicos que tienen fecha_inscripcion y estado PENDIENTE
    const studentsWithPendingStatus = new Set<number>();

    accounts.forEach(account => {
      if (account.estado === 'PENDIENTE' && account.fecha_inscripcion && account.fecha_inscripcion !== null) {
        studentsWithPendingStatus.add(account.estudiante_id.id);
      }
    });

    this.rectorStats.totalStudentsWithPendingStatus = studentsWithPendingStatus.size;

    // Calcular cuentas con estado PAGADA: contar todas las cuentas con estado "PAGADA"
    this.rectorStats.totalStudentsWithPaidStatus = accounts.filter(account =>
      account.estado === 'PAGADA'
    ).length;

    // Calcular pines entregados: contar cuentas donde pin_entregado es "SI"
    this.rectorStats.totalPinsDelivered = accounts.filter(account =>
      account.pin_entregado === 'SI' ||
      account.pin_entregado === 'Si' ||
      account.pin_entregado === 'si'
    ).length;
  }

  private calculateStats(courses: Course[], accounts: any[]): void {
    // Contar estudiantes únicos basándose en las cuentas por cobrar
    const uniqueStudentIds = new Set();
    accounts.forEach(account => {
      if (account.estudiante_id && account.estudiante_id.id) {
        uniqueStudentIds.add(account.estudiante_id.id);
      }
    });

    this.stats.totalStudents = uniqueStudentIds.size;
    this.stats.totalAccountsReceivable = accounts.length;

    let totalAmount = 0;
    let totalPaid = 0;
    let pendingCount = 0;
    let overdueAmount = 0;
    let monthlyPayments = 0;
    let totalPendingAccountsReceivable = 0;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    accounts.forEach(account => {
      const precio = parseFloat(account.monto || account.precio) || 0;
      totalAmount += precio;

      if (account.pagos && Array.isArray(account.pagos)) {
        // Calcular total pagado excluyendo devoluciones
        const paidAmount = account.pagos
          .filter((pago: any) => pago.estado === 'PAGADO')
          .reduce((sum: number, pago: any) => {
            return sum + (parseFloat(pago.valor || pago.monto) || 0);
          }, 0);

        // Restar las devoluciones del total pagado
        const refundAmount = account.pagos
          .filter((pago: any) => pago.estado === 'DEVOLUCION')
          .reduce((sum: number, pago: any) => {
            return sum + (parseFloat(pago.valor || pago.monto) || 0);
          }, 0);

        const netPaidAmount = paidAmount - refundAmount;
        totalPaid += netPaidAmount;

        // Calcular pagos del mes actual usando valor_neto
        const monthlyPaid = account.pagos
          .filter((pago: any) => pago.estado === 'PAGADO')
          .filter((pago: any) => {
            if (pago.fecha_pago) {
              const paymentDate = new Date(pago.fecha_pago);
              return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
            }
            return false;
          })
          .reduce((sum: number, pago: any) => {
            const valorNeto = parseFloat(pago.valor_neto?.toString() || '0') || 0;
            return sum + valorNeto;
          }, 0);

        const monthlyRefunds = account.pagos
          .filter((pago: any) => pago.estado === 'DEVOLUCION')
          .filter((pago: any) => {
            if (pago.fecha_pago) {
              const paymentDate = new Date(pago.fecha_pago);
              return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
            }
            return false;
          })
          .reduce((sum: number, pago: any) => {
            const valorNeto = parseFloat(pago.valor_neto?.toString() || '0') || 0;
            return sum + valorNeto;
          }, 0);

        monthlyPayments += (monthlyPaid - monthlyRefunds);

        // Contar solo cuentas PENDIENTES y vencidas (fecha_finalizacion < fecha actual)
        if (account.estado === 'PENDIENTE' && account.fecha_finalizacion) {
          const dueDate = new Date(account.fecha_finalizacion);
          if (currentDate > dueDate) {
            pendingCount++;
          }
        }

        // Verificar si la cuenta está vencida para calcular monto vencido
        if (netPaidAmount < precio) {
          if (account.fecha_vencimiento) {
            const dueDate = new Date(account.fecha_vencimiento);
            if (currentDate > dueDate) {
              overdueAmount += (precio - netPaidAmount);
            }
          }
        }
      } else {
        // Contar solo cuentas PENDIENTES y vencidas (fecha_finalizacion < fecha actual)
        if (account.estado === 'PENDIENTE' && account.fecha_finalizacion) {
          const dueDate = new Date(account.fecha_finalizacion);
          if (currentDate > dueDate) {
            pendingCount++;
          }
        }

        // Si no hay pagos y hay fecha de vencimiento, verificar si está vencida
        if (account.fecha_vencimiento) {
          const dueDate = new Date(account.fecha_vencimiento);
          if (currentDate > dueDate) {
            overdueAmount += precio;
          }
        }
      }

      // Contar todas las cuentas pendientes
      if (account.estado === 'PENDIENTE') {
        totalPendingAccountsReceivable++;
      }
    });

    this.stats.totalAmountReceivable = totalAmount;
    this.stats.totalPaidAmount = totalPaid;
    this.stats.pendingPayments = pendingCount;
    this.stats.overdueAmount = overdueAmount;
    this.stats.monthlyPayments = monthlyPayments;
    this.stats.totalPendingAccountsReceivable = totalPendingAccountsReceivable;
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