import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Payment } from '../accout-receivable-detail/account-receivable-detail';

@Component({
  selector: 'app-payment-detail',
  imports: [CommonModule],
  templateUrl: './payment-detail.html',
  standalone: true
})
export class PaymentDetailComponent {
  @Input() payment!: Payment;
  @Output() backToPaymentHistory = new EventEmitter<void>();

  onBack() {
    this.backToPaymentHistory.emit();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }
}
