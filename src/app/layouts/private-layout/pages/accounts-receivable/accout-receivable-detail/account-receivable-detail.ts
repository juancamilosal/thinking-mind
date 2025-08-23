import { Component, EventEmitter, Input, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {AccountReceivable, PaymentRecord} from '../../../../../core/models/AccountReceivable';
import { PaymentDetailComponent } from '../payment-detail/payment-detail';
import {PAYMENT_METHOD} from '../../../../../core/const/PaymentMethod';
import {PaymentService} from '../../../../../core/services/payment.service';

@Component({
  selector: 'app-account-receivable-detail',
  imports: [CommonModule, FormsModule, PaymentDetailComponent],
  templateUrl: './account-receivable-detail.html',
  standalone: true
})
export class AccountReceivableDetailComponent {
  @Input() account!: AccountReceivable;
  @Output() backToList = new EventEmitter<void>();
  @Output() llamarFuncion = new EventEmitter<void>();
  @Output() addPayment = new EventEmitter<PaymentRecord>();
  
  get payments(): PaymentRecord[] {
    return this.account?.pagos || [];
  }

  selectedPayment: PaymentRecord | null = null;
  showPaymentDetailView = false;
  showAddPaymentForm = false;
  newPaymentAmount: number;
  newPaymentMethod: string;
  newPaymentReference: string;
  newPayerName: string;
  newApprovalNumber: string;
  newBank: string;
  PAYMENT_METHOD = PAYMENT_METHOD;

  constructor(private paymentService: PaymentService, private cdr: ChangeDetectorRef) {}

  // Método para capitalizar texto
  capitalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Método para manejar la capitalización del nombre del pagador
  onPayerNameChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.newPayerName = capitalizedValue;
  }

  onBack() {
    this.backToList.emit();
  }

  getTotalPaid(): number {
    return this.payments.reduce((total, payment) => total + payment.valor, 0);
  }

  getRemainingBalance(): number {
    return this.account.monto - this.getTotalPaid();
  }

  getPaymentProgress(): number {
    return (this.getTotalPaid() / this.account.monto) * 100;
  }

  getPaymentProgressCapped(): number {
    return Math.min(this.getPaymentProgress(), 100);
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
    });
  }

  toggleAddPaymentForm() {
    this.showAddPaymentForm = !this.showAddPaymentForm;
    if (!this.showAddPaymentForm) {
      this.resetPaymentForm();
    }
  }

  addNewPayment() {
    const payment = {
      cuenta_cobrar_id: this.account.id,
      valor: this.newPaymentAmount,
      fecha_pago: new Date().toISOString(),
      metodo_pago: this.newPaymentMethod,
      pagador: this.newPayerName,
      estado: 'PAGADO'
    }

    this.paymentService.createPayment(payment).subscribe({
      next: ():void => {
        this.resetPaymentForm();
        this.showAddPaymentForm = false;
        this.refreshPayments();
      }
    });
  }

  private resetPaymentForm() {
    this.newPaymentAmount = 0;
    this.newPaymentMethod = '';
    this.newPaymentReference = '';
    this.newPayerName = '';
    this.newApprovalNumber = '';
    this.newBank = '';
  }

  viewPaymentDetail(payment: PaymentRecord) {
    this.selectedPayment = payment;
    this.showPaymentDetailView = true;
  }

  closePaymentDetail() {
    this.showPaymentDetailView = false;
  }

  backToPaymentHistory() {
    this.showPaymentDetailView = false;
    this.selectedPayment = null;
  }

  getStatusColor(): string {
    const progress = this.getPaymentProgress();
    if (progress >= 100) return 'text-green-600';
    if (progress >= 50) return 'text-yellow-600';
    return 'text-red-600';
  }

  getStatusText(): string {
    const progress = this.getPaymentProgress();
    if (progress >= 100) return 'Pagado Completamente';
    if (progress >= 50) return 'Pago Parcial';
    return 'Pendiente';
  }


  refreshPayments() {
    this.paymentService.getPaymentsByAccountId(this.account.id).subscribe({
      next: (response) => {
        console.log('Pagos actualizados:', response);
        if (response.data) {
          this.account.pagos = response.data;
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error al obtener los pagos:', error);
      }
    });
  }

}
