import { Component, EventEmitter, Input, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {AccountReceivable, PaymentRecord} from '../../../../../core/models/AccountReceivable';
import { PaymentDetailComponent } from '../payment-detail/payment-detail';
import {PAYMENT_METHOD} from '../../../../../core/const/PaymentMethod';
import {PaymentService} from '../../../../../core/services/payment.service';
import {AccountReceivableService} from '../../../../../core/services/account-receivable.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../../core/services/notification.service';

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

  constructor(
    private paymentService: PaymentService,
    private cdr: ChangeDetectorRef,
    private accountService: AccountReceivableService,
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService
  ) {}

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
        // Calcular el nuevo saldo sumando el pago
        const newSaldo = this.account.saldo + this.newPaymentAmount;

        // Determinar el nuevo estado basado en el saldo vs monto
        const newEstado = newSaldo >= this.account.monto ? 'PAGADA' : 'PENDIENTE';

        // Actualizar el saldo y estado en la cuenta por cobrar en Directus
        this.accountService.updateAccountReceivable(this.account.id, {
          saldo: newSaldo,
          estado: newEstado
        }).subscribe({
          next: (updateResponse) => {
            // Actualizar los datos locales
            this.account.saldo = newSaldo;
            this.account.estado = newEstado;

            this.resetPaymentForm();
            this.showAddPaymentForm = false;
            // Actualizar tanto los pagos como el saldo de la cuenta
            this.refreshAccountData();

          },
          error: (updateError) => {
            console.error('Error al actualizar el saldo y estado:', updateError);
            // Aún así, actualizar los datos para reflejar el nuevo pago
            this.resetPaymentForm();
            this.showAddPaymentForm = false;
            this.refreshAccountData();

          }
        });
      }
    });
  }

  // Nuevo método para actualizar todos los datos de la cuenta
  refreshAccountData() {
    this.accountService.getAccountById(this.account.id).subscribe({
      next: (response) => {
        console.log('Cuenta actualizada:', response);
        if (response.data) {
          // Actualizar el saldo y los pagos
          this.account.saldo = response.data.saldo;
          this.account.pagos = response.data.pagos || [];
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error al obtener la cuenta actualizada:', error);
        // Fallback: solo actualizar los pagos
        this.refreshPayments();
      }
    });
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
    if (this.account.estado === 'PAGADA') {
      return 'Pagado';
    }
    return 'Pendiente';
  }

  // Nuevo método para eliminar pago
  // Método para eliminar pago y actualizar saldo
  deletePayment(payment: PaymentRecord): void {
    const paymentName = `Pago de ${this.formatCurrency(payment.valor)} - ${payment.pagador}`;

    this.confirmationService.showDeleteConfirmation(
      paymentName,
      'pago',
      () => {
        // Callback de confirmación
        this.paymentService.deletePayment(payment.id).subscribe({
          next: (response) => {
            // Calcular el nuevo saldo restando el valor del pago eliminado
            const newSaldo = this.account.saldo - payment.valor;

            // Determinar el nuevo estado basado en el saldo vs monto
            const newEstado = newSaldo >= this.account.monto ? 'PAGADA' : 'PENDIENTE';

            // Actualizar el saldo y estado en la cuenta por cobrar en Directus
            this.accountService.updateAccountReceivable(this.account.id, {
              saldo: newSaldo,
              estado: newEstado
            }).subscribe({
              next: (updateResponse) => {
                this.notificationService.showSuccess(
                  'Pago eliminado',
                  `El pago ha sido eliminado exitosamente y el saldo ha sido actualizado.`
                );

                // Actualizar los datos locales
                this.account.saldo = newSaldo;
                this.account.estado = newEstado;

                // Actualizar tanto los pagos como el saldo de la cuenta
                this.refreshAccountData();

                // Emitir evento para actualizar el componente padre
                this.llamarFuncion.emit();
              },
              error: (updateError) => {
                console.error('Error al actualizar el saldo:', updateError);
                this.notificationService.showError(
                  'Error al actualizar saldo',
                  'El pago fue eliminado pero no se pudo actualizar el saldo. Por favor, actualiza la página.'
                );

                // Aún así, actualizar los datos para reflejar la eliminación del pago
                this.refreshAccountData();
                this.llamarFuncion.emit();
              }
            });
          },
          error: (error) => {
            console.error('Error al eliminar pago:', error);
            this.notificationService.showError(
              'Error al eliminar',
              'No se pudo eliminar el pago. Inténtalo nuevamente.'
            );
          }
        });
      }
    );
  }
}
