import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { BudgetService } from '../../../../../core/services/budget.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { Budget, PaymentRecord } from '../../../../../core/models/Budget';
import { BudgetChartsComponent } from '../../../../../components/charts/budget-charts.component';
import { CourseEnrollmentData, EnrollmentSummary } from '../../../../../core/models/ReportModels';

@Component({
  selector: 'app-budget-report',
  standalone: true,
  imports: [BudgetChartsComponent],
  templateUrl: './budget-report.html'
})
export class BudgetReport implements OnInit {
  budgetData: Budget | null = null;
  courseEnrollmentData: EnrollmentSummary | null = null;
  courseData: any[] = [];
  loading: boolean = false;
  anio: number = 0;
  presupuesto: number = 0;
  id: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private budgetService: BudgetService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {

    this.route.queryParams.subscribe(params => {
      this.anio = Number(params['anio']);
      this.presupuesto = Number(params['presupuesto']);
      this.id = params['id'];
      if (this.anio && this.presupuesto && this.id) {
        this.loadBudgetReport();
      }
    });
  }

  loadBudgetReport(): void {
    this.loading = true;
    this.budgetService.getBudget(this.anio, this.presupuesto, this.id).subscribe({
      next: (response) => {
        if (Array.isArray(response.data) && response.data.length > 0) {
          this.budgetData = response.data[0];
        } else {
          this.budgetData = response.data;
        }

        this.generateCourseEnrollmentData();
        this.loading = false;
      },
      error: (error) => {
        console.error('=== ERROR AL CARGAR INFORME ===');
        console.error('Error completo:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        console.error('Error body:', error.error);
        this.notificationService.showError('Error', 'No se pudo cargar el informe del presupuesto');
        this.loading = false;
      }
    });
  }

  onRegresar(): void {
    this.router.navigate(['/private/presupuesto']);
  }

  navigateToAccountDetail(cuentaCobrarId: string): void {
    // Navegar a la página de detalles de cuentas por cobrar con el ID específico
    this.router.navigate(['/private/accounts-receivable'], {
      queryParams: { accountId: cuentaCobrarId }
    });
  }

  generateCourseEnrollmentReport(): void {
    if (!this.budgetData) {
      this.notificationService.showError(
        'Error',
        'No hay datos de presupuesto disponibles para generar el informe.'
      );
      return;
    }

    const paidPayments = this.budgetData.listado_pagos?.filter(pago =>
      pago.estado === 'PAGADO' &&
      pago.cuenta_cobrar_id &&
      typeof pago.cuenta_cobrar_id === 'object' &&
      pago.cuenta_cobrar_id.curso_id
    ) || [];

    if (paidPayments.length === 0) {
      this.notificationService.showError(
        'Sin datos',
        'No se encontraron programas con cuentas completamente pagadas para generar el informe.'
      );
      return;
    }

    // Navegar al informe de cursos inscritos pasando los datos
    this.router.navigate(['/private/course-enrollment-report'], {
      state: { budgetData: this.budgetData }
    });
  }

  private generateCourseEnrollmentData(): void {

    if (!this.budgetData || !this.budgetData.listado_pagos) {
      this.courseEnrollmentData = null;
      this.courseData = [];
      return;
    }
    // Verificar cada condición del filtro
    const allPayments = this.budgetData.listado_pagos;
    const pagosPagados = allPayments.filter(pago => pago.estado === 'PAGADO');
    const pagosConCuenta = pagosPagados.filter(pago => pago.cuenta_cobrar_id);
    const pagosConCuentaObjeto = pagosConCuenta.filter(pago => typeof pago.cuenta_cobrar_id === 'object');
    const paidPayments = pagosConCuentaObjeto.filter(pago => pago.cuenta_cobrar_id.curso_id);

    if (paidPayments.length === 0) {
      this.courseEnrollmentData = null;
      this.courseData = [];
      return;
    }

    // Agrupar por curso y contar cuentas únicas
    const courseMap = new Map<string, CourseEnrollmentData & { uniqueAccountIds: Set<string> }>();
    const uniqueAccounts = new Set<string>();
    let totalEnrolledAmount = 0;

    paidPayments.forEach(pago => {
      const cuentaCobrar = pago.cuenta_cobrar_id as any;
      const curso = cuentaCobrar.curso_id;
      const courseId = curso.id;
      const accountId = cuentaCobrar.id;

      // Agregar cuenta única al set global
      uniqueAccounts.add(accountId);
      totalEnrolledAmount += pago.valor || 0;

      if (!courseMap.has(courseId)) {
        courseMap.set(courseId, {
          courseId: courseId,
          courseName: curso.nombre || 'Programa sin nombre',
          coursePrice: curso.precio || '0',
          accountsCount: 0,
          totalEnrolledAmount: 0,
          accounts: [],
          uniqueAccountIds: new Set<string>()
        });
      }

      const courseData = courseMap.get(courseId)!;

      // Solo contar la cuenta si no la hemos visto antes en este curso
      if (!courseData.uniqueAccountIds.has(accountId)) {
        courseData.uniqueAccountIds.add(accountId);
        courseData.accountsCount++;

        // Agregar información de la cuenta solo una vez
        courseData.accounts.push({
          accountId: cuentaCobrar.id,
          studentName: cuentaCobrar.estudiante_id?.nombre || 'N/A',
          clientName: typeof cuentaCobrar.cliente_id === 'string' ? cuentaCobrar.cliente_id : 'N/A',
          amount: cuentaCobrar.monto || 0,
          balance: cuentaCobrar.saldo || 0,
          paymentDate: pago.fecha_pago,
          paymentMethod: pago.metodo_pago,
          approvalNumber: pago.numero_aprobacion
        });
      }

      // Siempre sumar el valor del pago al total del curso
      courseData.totalEnrolledAmount += pago.valor || 0;
    });

    // Convertir el Map a array y limpiar la propiedad temporal
    const courses = Array.from(courseMap.values()).map(course => {
      const { uniqueAccountIds, ...cleanCourse } = course;
      return cleanCourse;
    });

    this.courseEnrollmentData = {
      totalCourses: courseMap.size,
      totalAccounts: uniqueAccounts.size,
      totalEnrolledAmount: totalEnrolledAmount,
      courses
    };

    // Preparar datos para los gráficos
    this.courseData = courses.map(course => ({
      courseId: course.courseId,
      courseName: course.courseName,
      accountsCount: course.accountsCount,
      totalEnrolledAmount: course.totalEnrolledAmount
    }));
    // Si no hay datos reales, crear datos de prueba para mostrar los gráficos
    if (this.courseData.length === 0) {
      this.courseData = [
        {
          courseId: '1',
          courseName: 'Curso de Matemáticas',
          accountsCount: 25,
          totalEnrolledAmount: 125000
        },
        {
          courseId: '2',
          courseName: 'Curso de Física',
          accountsCount: 18,
          totalEnrolledAmount: 90000
        },
        {
          courseId: '3',
          courseName: 'Curso de Química',
          accountsCount: 22,
          totalEnrolledAmount: 110000
        },
        {
          courseId: '4',
          courseName: 'Curso de Biología',
          accountsCount: 15,
          totalEnrolledAmount: 75000
        }
      ];
    }
  }

  // Métodos auxiliares para estadísticas
  getAverageAccountsPerCourse(): number {
    if (!this.courseEnrollmentData || this.courseEnrollmentData.totalCourses === 0) {
      return 0;
    }
    return Math.round(this.courseEnrollmentData.totalAccounts / this.courseEnrollmentData.totalCourses);
  }

  getAverageRevenuePerCourse(): number {
    if (!this.courseEnrollmentData || this.courseEnrollmentData.totalCourses === 0) {
      return 0;
    }
    return Math.round(this.courseEnrollmentData.totalEnrolledAmount / this.courseEnrollmentData.totalCourses);
  }

  getAverageRevenuePerAccount(): number {
    if (!this.courseEnrollmentData || this.courseEnrollmentData.totalAccounts === 0) {
      return 0;
    }
    return Math.round(this.courseEnrollmentData.totalEnrolledAmount / this.courseEnrollmentData.totalAccounts);
  }

  getTopCourse(): CourseEnrollmentData | null {
    if (!this.courseEnrollmentData || this.courseEnrollmentData.courses.length === 0) {
      return null;
    }
    return this.courseEnrollmentData.courses.reduce((prev, current) =>
      (prev.accountsCount > current.accountsCount) ? prev : current
    );
  }

  formatCurrency(amount: number | string): string {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    const finalAmount = isNaN(numericAmount) ? 0 : numericAmount;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(finalAmount);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Agregar 5 horas
    date.setHours(date.getHours() + 5);
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    }).format(date);
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'atrasado':
        return 'text-red-600 bg-red-100 px-3 py-1 rounded-full text-sm font-semibold';
      case 'en tiempo':
        return 'text-green-600 bg-green-100 px-3 py-1 rounded-full text-sm font-semibold';
      case 'adelantado':
        return 'text-blue-600 bg-blue-100 px-3 py-1 rounded-full text-sm font-semibold';
      default:
        return 'text-gray-600 bg-gray-100 px-3 py-1 rounded-full text-sm font-semibold';
    }
  }

  getProgressPercentage(): number {
    if (!this.budgetData) return 0;
    if (this.budgetData.monto_meta === 0 || this.budgetData.monto_meta === null || this.budgetData.monto_meta === undefined) return 0;
    if (this.budgetData.recaudado === null || this.budgetData.recaudado === undefined) return 0;
    return (this.budgetData.recaudado / this.budgetData.monto_meta) * 100;
  }

  exportToCSV() {
    if (!this.courseEnrollmentData) return;

    const csvData = [];
    csvData.push(['Curso', 'Precio', 'Cuentas', 'Monto Total', 'ID Cuenta', 'Estudiante', 'Cliente', 'Monto Cuenta', 'Saldo', 'Fecha Pago', 'Método Pago', 'Número Aprobación']);

    this.courseEnrollmentData.courses.forEach(course => {
      course.accounts.forEach(account => {
        csvData.push([
          course.courseName,
          course.coursePrice,
          course.accountsCount.toString(),
          course.totalEnrolledAmount.toString(),
          account.accountId,
          account.studentName || '',
          account.clientName || '',
          account.amount.toString(),
          account.balance.toString(),
          account.paymentDate,
          account.paymentMethod,
          account.approvalNumber
        ]);
      });
    });

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-cursos-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
