import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchoolService } from '../../../../core/services/school.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import { CourseService } from '../../../../core/services/course.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { StudentService } from '../../../../core/services/student.service';
import { Course } from '../../../../core/models/Course';
import { PaymentModel } from '../../../../core/models/AccountReceivable';
import { forkJoin } from 'rxjs';
import { DashboardStats, RectorDashboardStats, CourseWithStudents, TeacherDashboardStats } from '../../../../core/models/DashboardModels';
import {Roles} from '../../../../core/const/Roles';
import { StorageServices } from '../../../../core/services/storage.services';

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
  isSales: boolean = false;
  isAyoStudent: boolean = false;
  isAyoTeacher: boolean = false;
  rol = Roles;

  // AYO Student Stats
  ayoStats: any = {
    creditos: 0,
    nivel: '',
    calificacion: 0,
    resultado_test: '',
    estado_cuenta: '',
    idioma: '',
    subcategoria: '',
    tematica: '',
    reuniones_meet: []
  };

  // AYO Teacher Stats
  teacherStats: TeacherDashboardStats = {
    horas_trabajadas: 0,
    reuniones_meet_id: []
  };

  constructor(
    private schoolService: SchoolService,
    private accountReceivableService: AccountReceivableService,
    private courseService: CourseService,
    private paymentService: PaymentService,
    private notificationService: NotificationService,
    private dashboardService: DashboardService,
    private studentService: StudentService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private sortReuniones(reuniones: any[]): any[] {
    const weekdayOrder = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
    return reuniones.sort((a, b) => {
        const dayA = a.DIA ? a.DIA.toUpperCase() : '';
        const dayB = b.DIA ? b.DIA.toUpperCase() : '';
        return weekdayOrder.indexOf(dayA) - weekdayOrder.indexOf(dayB);
    });
  }

  private loadDashboardData(): void {
    this.isLoading = true;

    // Obtener información del usuario desde sessionStorage usando StorageServices
    const user = StorageServices.getItemObjectFromSessionStorage('current_user');

    if (user) {
      this.userRole = user.role;
      this.userColegioId = user.colegio_id;
      this.isRector = user.role === this.rol.RECTOR;
      this.isSales = user.role === this.rol.VENTAS;
      this.isAyoStudent = user.role === Roles.STUDENT;
      this.isAyoTeacher = user.role === Roles.TEACHER;

      if (this.isSales) {
        // Consumir el servicio dashboardSale para el rol específico
        this.loadSalesData();
        return;
      }

      if (this.isAyoTeacher) {
        this.loadTeacherData();
        return;
      }

      const isRegularStudent = user.resultado_test !== undefined || user.student_id !== undefined;

      if (this.isAyoStudent || isRegularStudent) {
        this.ayoStats.creditos = user.creditos || 0;
        this.ayoStats.calificacion = user.calificacion || 0;
        this.ayoStats.nivel_idioma = user.nivel_idioma || 'N/A';
        this.ayoStats.resultado_test = user.resultado_test || 'N/A';
        this.studentService.dashboardStudent({ params: { user_id: user.id, role_id: user.role } }).subscribe({
          next: (response) => {
            const data = response.data || response;
            if (data) {
              this.ayoStats = {
                creditos: data.creditos ?? 0,
                nivel: data.nivel || data.nivel_idioma || 'N/A',
                calificacion: data.calificacion ?? 0,
                resultado_test: data.resultado_test === 'undefined' ? 'N/A' : (data.resultado_test || 'N/A'),
                estado_cuenta: data.estado_cuenta || 'N/A',
                idioma: data.idioma || 'N/A',
                subcategoria: data.subcategoria || 'N/A',
                tematica: data.tematica || 'N/A',
                reuniones_meet: data.reuniones_meet ? this.sortReuniones(data.reuniones_meet) : []
              };
            }
            this.isLoading = false;
          },
          error: (error) => {
            this.isLoading = false;
          }
        });

        return;
      }
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
    this.dashboardService.dashboardRector().subscribe({
      next: (response) => {
        if (response.data) {
          this.rectorStats.totalStudentsEnrolled = response.data.total_estudiantes || 0;
          this.rectorStats.totalStudentsWithPendingStatus = response.data.cuentas_pendientes || 0;
          this.rectorStats.totalStudentsWithPaidStatus = response.data.cuentas_pagadas || 0;
          this.rectorStats.totalPinsDelivered = response.data.pines_entregados || 0;
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  private loadAdminData(): void {
    this.dashboardService.dashboard().subscribe({
      next: (response) => {
        if (response && response.data) {
          this.processDefaultDashboardData(response.data);
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.loadAdminDataFallback();
      }
    });
  }

  private processDefaultDashboardData(data: any): void {


    this.stats = {
      totalStudents: 0,
      totalAccountsReceivable: data.total_cuentas || 0,
      totalAmountReceivable: data.monto_total || 0,
      totalPaidAmount: data.saldo_total || 0,
      pendingPayments: data.saldo_pendiente || 0,
      overdueAmount: 0,
      monthlyPayments: data.total_pagos_mes || 0,
      totalPendingAccountsReceivable: data.total_cuentas || 0
    };
  }

  private loadAdminDataFallback(): void {
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const startDate = firstDayOfMonth.toISOString().split('T')[0];
    const endDate = lastDayOfMonth.toISOString().split('T')[0];

    forkJoin({
        courses: this.courseService.searchCourse(),
        accounts: this.accountReceivableService.searchAccountReceivable(1, 1000), // Aumentar el límite para obtener todas las cuentas
        monthlyPayments: this.paymentService.getPayments(1, 1000, undefined, startDate, endDate)
      }).subscribe({
      next: ({ courses, accounts, monthlyPayments }) => {
        this.courses = courses.data;
        this.accounts = accounts.data;

        this.calculateCoursesWithStudents();
        this.calculateStats(this.courses, this.accounts);
        this.calculateMonthlyPayments(monthlyPayments.data || []);
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


  private calculateStats(courses: Course[], accounts: any[]): void {
    const uniqueStudentIds = new Set();
    accounts.forEach(account => {
      if (account.estudiante_id && account.estudiante_id.id) {
        uniqueStudentIds.add(account.estudiante_id.id);
      }
    });

    this.stats.totalStudents = uniqueStudentIds.size;
    this.stats.totalAccountsReceivable = accounts.filter(account => account.estado === 'PENDIENTE').length;

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
      if (account.estado === 'PENDIENTE') {
        totalAmount += precio;
      }

      if (account.pagos && Array.isArray(account.pagos)) {
        // Calcular total pagado excluyendo devoluciones
        const paidAmount = account.pagos
          .filter((pago: any) => pago.estado === 'PAGADO')
          .reduce((sum: number, pago: any) => {
            return sum + (parseFloat(pago.valor || pago.monto) || 0);
          }, 0);

        const refundAmount = account.pagos
          .filter((pago: any) => pago.estado === 'DEVOLUCION')
          .reduce((sum: number, pago: any) => {
            return sum + (parseFloat(pago.valor || pago.monto) || 0);
          }, 0);

        const netPaidAmount = paidAmount - refundAmount;
        totalPaid += netPaidAmount;

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

        if (account.estado === 'PENDIENTE' && account.fecha_finalizacion) {
          const dueDate = new Date(account.fecha_finalizacion);
          if (currentDate > dueDate) {
            pendingCount++;
          }
        }

        if (netPaidAmount < precio) {
          if (account.fecha_vencimiento) {
            const dueDate = new Date(account.fecha_vencimiento);
            if (currentDate > dueDate) {
              overdueAmount += (precio - netPaidAmount);
            }
          }
        }
      } else {
        if (account.estado === 'PENDIENTE' && account.fecha_finalizacion) {
          const dueDate = new Date(account.fecha_finalizacion);
          if (currentDate > dueDate) {
            pendingCount++;
          }
        }

        if (account.fecha_vencimiento) {
          const dueDate = new Date(account.fecha_vencimiento);
          if (currentDate > dueDate) {
            overdueAmount += precio;
          }
        }
      }

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

  private calculateMonthlyPayments(payments: PaymentModel[]): void {
    // Calcular la suma de pagos del mes actual usando solo valor_neto
    const monthlyTotal = payments
      .filter(payment => payment.estado === 'PAGADO')
      .reduce((sum, payment) => {
        const valorNeto = parseFloat(payment.valor_neto?.toString() || '0') || 0;
        return sum + valorNeto;
      }, 0);

    // Actualizar el valor en las estadísticas
    this.stats.monthlyPayments = monthlyTotal;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  getPaymentProgress(): number {
    if (this.stats.totalAmountReceivable === 0) return 0;
    return (this.stats.totalPaidAmount / this.stats.totalAmountReceivable) * 100;
  }

  private loadTeacherData(): void {
    this.dashboardService.dashboardTeacher().subscribe({
      next: (response) => {
        if (response && response.data && response.data.length > 0) {
          this.teacherStats = response.data[0];
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading teacher dashboard', error);
        this.isLoading = false;
      }
    });
  }

  private loadSalesData(): void {
    this.dashboardService.dashboardSale().subscribe({
      next: (response) => {
        if (response.data) {
          this.rectorStats.totalStudentsEnrolled = response.data.total_estudiantes || 0;
          this.rectorStats.totalStudentsWithPendingStatus = response.data.cuentas_pendientes || 0;
          this.rectorStats.totalStudentsWithPaidStatus = response.data.cuentas_pagadas || 0;
          this.rectorStats.totalPinsDelivered = response.data.pines_entregados || 0;
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }
}
