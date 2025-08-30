import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { REPORT_TYPE } from '../../../../core/const/ReportType';
import { PaymentRecord } from '../../../../core/models/AccountReceivable';
import { PaymentService } from '../../../../core/services/payment.service';

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
  reportGenerated: boolean = false;

  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private paymentService: PaymentService
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
    if (this.reportForm.valid) {
      const { reportType, startDate, endDate } = this.reportForm.value;
      this.reportGenerated = true;
      this.paymentService.getPayments().subscribe({
      next: (data) => {
        this.payments = data.data;
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.notificationService.showError('Error loading payments');
      }
    });
    }
  }

  downloadReport(): void {

  }

  clearForm(): void {
    this.reportForm.reset();
    this.payments = [];
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
}
