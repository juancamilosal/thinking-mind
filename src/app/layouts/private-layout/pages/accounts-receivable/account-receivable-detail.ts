import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Agregar esta importación
import {AccountReceivable} from '../../../../core/models/AccountReceivable';

export interface Payment {
  id: string;
  paymentNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
}

@Component({
  selector: 'app-account-receivable-detail',
  imports: [CommonModule, FormsModule], // Agregar FormsModule aquí
  templateUrl: './account-receivable-detail.html',
  standalone: true
})
export class AccountReceivableDetailComponent {
  @Input() account!: AccountReceivable; // Usar ! para indicar que siempre tendrá valor
  @Output() backToList = new EventEmitter<void>();
  @Output() addPayment = new EventEmitter<Payment>();

  // Datos de ejemplo de pagos
  payments: Payment[] = [
    {
      id: 'PAY-001',
      paymentNumber: 'Pago 1',
      amount: 200000,
      paymentDate: '2024-01-25',
      paymentMethod: 'Transferencia',
      reference: 'TRF-001'
    },
    {
      id: 'PAY-002',
      paymentNumber: 'Pago 2',
      amount: 150000,
      paymentDate: '2024-02-05',
      paymentMethod: 'Efectivo',
      reference: 'EFE-001'
    }
  ];

  showAddPaymentForm = false;
  newPaymentAmount = 0;
  newPaymentMethod = '';
  newPaymentReference = '';

  onBack() {
    this.backToList.emit();
  }

  getTotalPaid(): number {
    return this.payments.reduce((total, payment) => total + payment.amount, 0);
  }

  getRemainingBalance(): number {
    return this.account.amount - this.getTotalPaid();
  }

  getPaymentProgress(): number {
    return (this.getTotalPaid() / this.account.amount) * 100;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  toggleAddPaymentForm() {
    this.showAddPaymentForm = !this.showAddPaymentForm;
    if (!this.showAddPaymentForm) {
      this.resetPaymentForm();
    }
  }

  addNewPayment() {
    if (this.newPaymentAmount > 0 && this.newPaymentMethod && this.newPaymentReference) {
      const newPayment: Payment = {
        id: 'PAY-' + (this.payments.length + 1).toString().padStart(3, '0'),
        paymentNumber: `Pago ${this.payments.length + 1}`,
        amount: this.newPaymentAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: this.newPaymentMethod,
        reference: this.newPaymentReference
      };

      this.payments.push(newPayment);
      this.addPayment.emit(newPayment);
      this.resetPaymentForm();
      this.showAddPaymentForm = false;
    }
  }

  private resetPaymentForm() {
    this.newPaymentAmount = 0;
    this.newPaymentMethod = '';
    this.newPaymentReference = '';
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
}
