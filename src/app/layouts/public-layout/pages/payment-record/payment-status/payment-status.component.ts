import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../../../../core/services/payment.service';
import { PaymentModel } from '../../../../../core/models/AccountReceivable';

@Component({
  selector: 'app-payment-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-status.component.html',
  styleUrl: './payment-status.component.css'
})
export class PaymentStatusComponent implements OnInit {
  transactionData: any = {
    approved: true,
    transactionNumber: '',
    reference: '',
    paymentMethod: 'PSE',
    status: 'APROBADA',
    course: '',
    transactionDate: '',
    amount: 0
  };

  paymentInfo: PaymentModel | null = null;
  loading: boolean = true;
  error: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentService: PaymentService
  ) {}

  ngOnInit(): void {
    // Obtener el parámetro 'id' de la URL que contiene el número de transacción
    this.route.queryParams.subscribe(params => {
      const transactionNumber = params['id'];
      if (transactionNumber) {
        this.loadPaymentByTransactionNumber(transactionNumber);
      } else {
        this.error = 'No se proporcionó número de transacción';
        this.loading = false;
      }
    });
  }

  private loadPaymentByTransactionNumber(transactionNumber: string): void {
    this.loading = true;
    this.paymentService.getPaymentByTransactionNumber(transactionNumber).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          this.paymentInfo = response.data[0];
          this.populateTransactionData();
        } else {
          this.error = 'No se encontró información del pago';
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar información del pago:', error);
        this.error = 'Error al cargar la información del pago';
        this.loading = false;
      }
    });
  }

  private populateTransactionData(): void {
    if (this.paymentInfo) {
      this.transactionData = {
        approved: this.paymentInfo.estado === 'PAGADO',
        transactionNumber: this.paymentInfo.numero_transaccion || '',
        reference: this.paymentInfo.id || '',
        paymentMethod: this.paymentInfo.metodo_pago || 'PSE',
        status: this.paymentInfo.estado || 'APROBADA',
        course: this.paymentInfo.cuenta_cobrar_id?.curso_id?.nombre || 'Curso no especificado',
        transactionDate: this.formatDate(this.paymentInfo.fecha_pago),
        amount: this.paymentInfo.valor || 0,
        payerName: this.paymentInfo.pagador || ''
      };
    }
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Agregar 5 horas
    date.setHours(date.getHours() + 5);
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Bogota'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  goBackToPayments(): void {
    this.router.navigate(['/payment-record']);
  }

  printReceipt(): void {
    window.print();
  }

  isPaymentSuccessful(): boolean {
    return this.transactionData.status === 'PAGADO';
  }

  isPaymentRejected(): boolean {
    return this.transactionData.status === 'ERROR' || this.transactionData.status === 'RECHAZADO';
  }

  getHeaderClass(): string {
    if (this.isPaymentSuccessful()) {
      return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white';
    }
    return 'bg-red-400 text-white';
  }

  getHeaderTitle(): string {
    if (this.isPaymentSuccessful()) {
      return 'Transacción Aprobada';
    }
    return 'Transacción RECHAZADA';
  }

  getHeaderSubtitle(): string {
    if (this.isPaymentSuccessful()) {
      return 'Su pago ha sido procesado exitosamente';
    }
    return 'Su pago fue rechazado';
  }

  getHeaderIcon(): string {
    if (this.isPaymentSuccessful()) {
      return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
    }
    return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  getStatusClass(): string {
    if (this.isPaymentSuccessful()) {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-red-100 text-red-800';
  }

  getAmountLabel(): string {
    if (this.isPaymentSuccessful()) {
      return 'Monto Pagado';
    }
    return 'Monto Rechazado';
  }

  getAmountClass(): string {
    if (this.isPaymentSuccessful()) {
      return 'text-2xl font-bold text-green-600 bg-green-50 p-3 rounded-lg border border-green-200';
    }
    return 'text-2xl font-bold text-red-600 bg-red-50 p-3 rounded-lg border border-red-200';
  }
}