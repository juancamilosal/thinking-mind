import { Component, EventEmitter, Input, Output } from '@angular/core';

import { PaymentModel } from '../../../../../core/models/AccountReceivable';

@Component({
  selector: 'app-payment-detail',
  imports: [],
  templateUrl: './payment-detail.html',
  standalone: true
})
export class PaymentDetailComponent {
  @Input() payment!: PaymentModel;
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

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    // Agregar 5 horas
    date.setHours(date.getHours() + 5);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    });
  }

  formatPaymentMethod(method: string): string {
    if (method === 'CARD') {
      return 'TARJETA';
    }
    if (method === 'BANCOLOMBIA_TRANSFER') {
      return 'TRANSFERENCIA BANCOLOMBIA';
    }
    if (method === 'BANCOLOMBIA_COLLECT') {
      return 'CORRESPONSAL BANCARIO';
    }
    return method;
  }
}
