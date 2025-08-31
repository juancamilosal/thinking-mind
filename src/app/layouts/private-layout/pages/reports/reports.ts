import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { REPORT_TYPE } from '../../../../core/const/ReportType';
import { PaymentRecord } from '../../../../core/models/AccountReceivable';
import { PaymentService } from '../../../../core/services/payment.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';

interface EnrollReportData {
  schoolName: string;
  courseName: string;
  studentCount: number;
}

@Component({
  selector: 'app-reports',
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './reports.html',
  standalone: true
})

export class Reports {
  reportForm!: FormGroup;
  REPORT_TYPE = REPORT_TYPE;
  payments: PaymentRecord[] = [];
  enrollReportData: EnrollReportData[] = [];
  reportGenerated: boolean = false;


  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private paymentService: PaymentService,
    private accountReceivableService: AccountReceivableService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm=(): void => {
    this.reportForm = this.fb.group({
      reportType: ['', Validators.required],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required]
    });
  }

  generateReport(): void {
     if (this.reportForm.invalid) {
    this.notificationService.showWarning('Por favor, completa todos los campos del formulario.', '');
    return;
    }
    this.reportGenerated = true;
    const { reportType, startDate, endDate } = this.reportForm.value;

    switch (reportType) {
    case 'CARTERA':
      this.generatePaymentsReport(startDate, endDate);
      break;
    case 'INSCRIPCIONES':
      this.generateEnrollReport(startDate, endDate);
      break;
    default:
      this.notificationService.showError('Tipo de reporte no válido.');
      this.reportGenerated = false;
    }
  }

private  generatePaymentsReport(startDate: string, endDate: string): void {
    this.paymentService.getPayments().subscribe({
      next: (data) => {
        this.payments = data.data.filter(payment => {
          const paymentDate = new Date(payment.fecha_pago);
          const start = new Date(startDate + 'T00:00:00Z');
          const end = new Date(endDate + 'T23:59:59.999Z');

          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);

          console.log('Date filter:', {
        startDate: startDate,
        endDate: endDate,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString()
      });

          return paymentDate >= start && paymentDate <= end;
        });
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.notificationService.showError('Error loading payments');
      }
    });
  }

private generateEnrollReport(startDate: string, endDate: string): void {
  this.accountReceivableService.getAccountsForReport().subscribe({
    next: (response: any) => {
      console.log('Raw response before mapping:', response);
      const rawData = response.data || response;
      const paidAccounts = rawData.filter((account: any) => {
        if (!account.estudiante_id || typeof account.estudiante_id === 'string') return false;
        if (!account.pagos || account.pagos.length === 0) return false;

        return account.pagos.some((payment: any) => {
          const paymentDate = new Date(payment.fecha_pago);
          const start = new Date(startDate + 'T00:00:00Z');
          const end = new Date(endDate + 'T23:59:59.999Z');
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);

          return payment.estado === 'PAGADO' &&
                 paymentDate >= start &&
                 paymentDate <= end;
        });
      });

      const aggregationMap = new Map<string, EnrollReportData>();

      for (const account of paidAccounts) {
        const schoolName = account.estudiante_id?.colegio_id?.nombre ||
                          account.estudiante_id?.colegio_id?.nombre_colegio ||
                          'Sin Colegio';

        const courseName = account.curso_id?.nombre || 'Sin Curso';

        const key = `${schoolName}|${courseName}`;

        if (!aggregationMap.has(key)) {
          aggregationMap.set(key, {
            schoolName: schoolName,
            courseName: courseName,
            studentCount: 0
          });
        }

        aggregationMap.get(key)!.studentCount++;
      }

      this.enrollReportData = Array.from(aggregationMap.values());

      if (this.enrollReportData.length === 0) {
        this.notificationService.showWarning('No se encontraron inscripciones en el rango de fechas seleccionadas','');
      }
    },
    error: (error) => {
      console.error('Error loading enrollments:', error);
      this.notificationService.showError('Error al cargar las inscripciones');
    }
  });
}


  calculateTotal(): number {
  return this.payments
    .filter(payment => payment.estado === 'PAGADO')
    .reduce((total, payment) => total + payment.valor, 0);
  }

  downloadReport(): void {

  }

  clearForm(): void {
    this.reportForm.reset();
    this.payments = [];
    this.enrollReportData = [];
    this.reportGenerated = false;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }); // Esto devuelve DD/MM/YYYY
  }

  getStatusColor(estado: string): string {
    switch (estado) {
      case 'PAGADO':
      case 'Completado':
        return 'bg-green-100 text-green-800';
      case 'PENDIENTE':
      case 'Pendiente':
        return 'bg-orange-100 text-orange-800';
      case 'RECHAZADO':
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusArrow(estado: number): string {
    switch (estado) {
      case 1:
        return '↑'; // Aumentaron estudiantes registrados
      case 2:
        return '='; // Se mantienen igual
      default:
        return '';
    }
  }
}
