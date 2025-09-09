import {Component, EventEmitter, Input, Output, ChangeDetectorRef, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {AccountReceivable, PaymentModel} from '../../../../../core/models/AccountReceivable';
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
export class AccountReceivableDetailComponent implements OnInit {
  @Input() account!: AccountReceivable;

  ngOnInit() {

  }

  @Output() backToList = new EventEmitter<void>();
  @Output() llamarFuncion = new EventEmitter<void>();
  @Output() addPayment = new EventEmitter<PaymentModel>();

  get payments(): PaymentModel[] {
    return this.account?.pagos || [];
  }

  selectedPayment: PaymentModel | null = null;
  showPaymentDetailView = false;
  showAddPaymentForm = false;
  newPaymentAmount: number;
  newPaymentMethod: string;
  newPaymentReference: string;
  newPayerName: string;
  newApprovalNumber: string;
  newBank: string;
  newPaymentImage: File | null = null;
  isSubmittingPayment = false;
  isDeletingPayment = false;
  deletingPaymentId: string | null = null;
  PAYMENT_METHOD = PAYMENT_METHOD;
  isEditingAmount = false;
  editedAmount: number = 0;

  constructor(
    private paymentService: PaymentService,
    private cdr: ChangeDetectorRef,
    private accountService: AccountReceivableService,
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService
  ) {}


  capitalizeText(text: string): string {
    if (!text) return '';
    return text.toLowerCase().split(' ').map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }


  onPayerNameChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.newPayerName = capitalizedValue;
  }

  onBack() {
    this.backToList.emit();
  }

  getTotalPaid(): number {
    return this.payments
      .filter(payment => payment.estado === 'PAGADO')
      .reduce((total, payment) => total + payment.valor, 0);
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
      day: '2-digit',
      timeZone: 'America/Bogota'
    });
  }

  toggleAddPaymentForm() {
    this.showAddPaymentForm = !this.showAddPaymentForm;
    if (!this.showAddPaymentForm) {
      this.resetPaymentForm();
    }
  }

  addNewPayment() {
    this.isSubmittingPayment = true;

    const payment: any = {
      cuenta_cobrar_id: this.account.id,
      valor: this.newPaymentAmount,
      fecha_pago: new Date().toISOString(),
      metodo_pago: this.newPaymentMethod,
      pagador: this.newPayerName,
      estado: 'PAGADO',
      comprobante: null
    };

    if (this.newPaymentImage) {
      const formData = new FormData();
      formData.append('file', this.newPaymentImage);

      this.paymentService.uploadFile(formData).subscribe({
        next: (uploadResponse) => {
          payment.comprobante = uploadResponse.data.id;
          this.createPaymentRecord(payment);
        },
        error: (uploadError) => {
          this.isSubmittingPayment = false;
          this.notificationService.showError('Error', 'No se pudo subir la imagen del comprobante.');
        }
      });
    } else {
      this.createPaymentRecord(payment);
    }
  }

  private createPaymentRecord(payment: any) {
    this.paymentService.createPayment(payment).subscribe({
      next: ():void => {
        const newSaldo = this.account.saldo + this.newPaymentAmount;
        const newEstado = newSaldo >= this.account.monto ? 'PAGADA' : 'PENDIENTE';
        this.accountService.updateAccountReceivable(this.account.id, {
          saldo: newSaldo,
          estado: newEstado
        }).subscribe({
          next: (updateResponse) => {
            this.account.saldo = newSaldo;
            this.account.estado = newEstado;

            this.resetPaymentForm();
            this.showAddPaymentForm = false;
            this.isSubmittingPayment = false;
            this.refreshAccountData();
            this.notificationService.showSuccess('Éxito', 'El pago ha sido registrado correctamente.');

          },
          error: (updateError) => {
            this.resetPaymentForm();
            this.showAddPaymentForm = false;
            this.isSubmittingPayment = false;
            this.refreshAccountData();

          }
        });
      },
      error: (paymentError) => {
        this.isSubmittingPayment = false;
        this.notificationService.showError('Error', 'No se pudo registrar el pago.');
      }
    });
  }


  refreshAccountData() {
    this.accountService.getAccountById(this.account.id).subscribe({
      next: (response) => {
        if (response.data) {
          this.account.saldo = response.data.saldo;
          this.account.pagos = response.data.pagos || [];
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        this.refreshPayments();
      }
    });
  }

  refreshPayments() {
    this.paymentService.getPaymentsByAccountId(this.account.id).subscribe({
      next: (response) => {
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
    this.newPaymentImage = null;
    this.isSubmittingPayment = false;
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        this.newPaymentImage = file;
      } else {
        this.notificationService.showError('Error', 'Por favor seleccione un archivo de imagen válido.');
        event.target.value = '';
      }
    }
  }

  viewPaymentImage(payment: PaymentModel) {
    if (payment.comprobante) {
      const imageUrl = `${this.paymentService.getDirectusUrl()}/assets/${payment.comprobante}`;
      window.open(imageUrl, '_blank');
    }
  }

  hasPaymentImage(payment: PaymentModel): boolean {
    return payment.comprobante && payment.comprobante.trim() !== '';
  }

  viewPaymentDetail(payment: PaymentModel) {
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


  deletePayment(payment: PaymentModel): void {
    const paymentName = `Pago de ${this.formatCurrency(payment.valor)} - ${payment.pagador}`;

    this.confirmationService.showDeleteConfirmation(
      paymentName,
      'pago',
      () => {

        this.isDeletingPayment = true;
        this.deletingPaymentId = payment.id;
        this.paymentService.deletePayment(payment.id).subscribe({
          next: (response) => {
            const newSaldo = this.account.saldo - payment.valor;

            const newEstado = newSaldo >= this.account.monto ? 'PAGADA' : 'PENDIENTE';

            this.accountService.updateAccountReceivable(this.account.id, {
              saldo: newSaldo,
              estado: newEstado
            }).subscribe({
              next: (updateResponse) => {
                // Eliminación exitosa - solo actualizar datos sin mostrar modal
                this.account.saldo = newSaldo;
                this.account.estado = newEstado;
                this.refreshAccountData();
                this.llamarFuncion.emit();
                this.isDeletingPayment = false;
                this.deletingPaymentId = null;
              },
              error: (updateError) => {
                console.error('Error al actualizar el saldo:', updateError);
                this.notificationService.showError(
                  'Error al actualizar saldo',
                  'El pago fue eliminado pero no se pudo actualizar el saldo. Por favor, actualiza la página.'
                );

                this.refreshAccountData();
                this.llamarFuncion.emit();
                this.isDeletingPayment = false;
                this.deletingPaymentId = null;
              }
            });
          },
          error: (error) => {
            console.error('Error al eliminar pago:', error);
            this.notificationService.showError(
              'Error al eliminar',
              'No se pudo eliminar el pago. Inténtalo nuevamente.'
            );
            this.isDeletingPayment = false;
            this.deletingPaymentId = null;
          }
        });
      }
    );
  }


  startEditingAmount() {
    this.isEditingAmount = true;
    this.editedAmount = this.account.monto;
  }

  cancelEditingAmount() {
    this.isEditingAmount = false;
    this.editedAmount = 0;
  }

  saveAmount() {
    if (this.editedAmount > 0) {
      // Determinar el nuevo estado basado en la comparación monto vs saldo
      let newEstado = '';
      const currentSaldo = this.account.saldo || 0;

      if (currentSaldo >= this.editedAmount) {
        newEstado = 'PAGADA';
      } else {
        newEstado = 'PENDIENTE';
      }


      this.accountService.updateAccountReceivable(this.account.id, {
        monto: this.editedAmount,
        estado: newEstado
      }).subscribe({
        next: (updatedAccount) => {
          this.account.monto = this.editedAmount;
          this.account.estado = newEstado;
          this.isEditingAmount = false;
          this.notificationService.showSuccess('Éxito', `El monto de la cuenta ha sido actualizado. Estado: ${newEstado}`);
          this.llamarFuncion.emit(); // Actualizar la lista principal
        },
        error: (err) => {
          this.notificationService.showError('Error', 'No se pudo actualizar el monto de la cuenta.');
        }
      });
    }
  }

  canDeletePayment(payment: PaymentModel): boolean {
    return payment.metodo_pago !== 'PASARELA DE PAGO';
  }
}
