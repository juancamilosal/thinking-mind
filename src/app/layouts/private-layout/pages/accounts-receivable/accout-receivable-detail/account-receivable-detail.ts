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
  newPaymentAmountDisplay: string = '';
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
  
  // Propiedades para el modal de devolución
  showRefundModal = false;
  refundAmount: number = 0;
  refundAmountDisplay: string = '';
  refundFile: File | null = null;
  isProcessingRefund = false;

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
    // Calcular total pagado excluyendo devoluciones
    const totalPagado = this.payments
      .filter(payment => payment.estado === 'PAGADO')
      .reduce((total, payment) => total + payment.valor, 0);
    
    // Restar las devoluciones del total pagado
    const totalDevoluciones = this.payments
      .filter(payment => payment.estado === 'DEVOLUCION')
      .reduce((total, payment) => total + payment.valor, 0);
    
    return totalPagado - totalDevoluciones;
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
          this.account.estado = response.data.estado; // Actualizar también el estado
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
    this.newPaymentAmountDisplay = '';
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
            // Lógica correcta para eliminar pagos según su estado
            let newSaldo;
            let newEstado;
            
            if (payment.estado === 'DEVOLUCION') {
              // Si es una devolución, actualizar el saldo: saldo pendiente + valor de la devolución eliminada
              newSaldo = this.account.saldo + payment.valor;
              newEstado = newSaldo >= this.account.monto ? 'PAGADA' : 'PENDIENTE';
            } else if (payment.estado === 'PAGADO') {
              // Si es un pago PAGADO, al eliminarlo el saldo pendiente disminuye (se resta)
              newSaldo = this.account.saldo - payment.valor;
              newEstado = newSaldo >= this.account.monto ? 'PAGADA' : 'PENDIENTE';
            } else {
              // Para otros tipos de pago, al eliminarlo el saldo aumenta (más deuda)
              newSaldo = this.account.saldo + payment.valor;
              newEstado = newSaldo >= this.account.monto ? 'PAGADA' : 'PENDIENTE';
            }

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
    const allowedMethods = ['EFECTIVO', 'TRANSFERENCIA', 'DATÁFONO', 'CHEQUE'];
    return allowedMethods.includes(payment.metodo_pago);
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

  // Métodos para el modal de devolución
  openRefundModal(): void {
    this.showRefundModal = true;
    this.refundAmount = 0;
    this.refundFile = null;
  }

  closeRefundModal(): void {
    this.showRefundModal = false;
    this.refundAmount = 0;
    this.refundAmountDisplay = '';
    this.refundFile = null;
    this.isProcessingRefund = false;
  }

  onRefundAmountChange(event: any): void {
    const value = event.target.value.replace(/\./g, ''); // Remover puntos existentes
    const numericValue = parseInt(value) || 0;
    
    this.refundAmount = numericValue;
    this.refundAmountDisplay = this.formatNumberWithDots(numericValue);
    
    // Actualizar el valor del input
    event.target.value = this.refundAmountDisplay;
  }

  private formatNumberWithDots(num: number): string {
    if (num === 0) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  onPaymentAmountChange(event: any): void {
    const value = event.target.value.replace(/\./g, ''); // Remover puntos existentes
    const numericValue = parseInt(value) || 0;
    
    this.newPaymentAmount = numericValue;
    this.newPaymentAmountDisplay = this.formatNumberWithDots(numericValue);
    
    // Actualizar el valor del input
    event.target.value = this.newPaymentAmountDisplay;
  }

  onRefundFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validar tamaño del archivo (máximo 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB en bytes
      if (file.size > maxSize) {
        this.notificationService.showError('Error', 'El archivo no puede ser mayor a 10MB');
        return;
      }

      // Validar tipo de archivo
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        this.notificationService.showError('Error', 'Solo se permiten archivos PDF, JPG, JPEG o PNG');
        return;
      }

      this.refundFile = file;
    }
  }

  removeRefundFile(): void {
    this.refundFile = null;
  }

  processRefund(): void {
    if (!this.refundAmount || this.refundAmount <= 0) {
      this.notificationService.showError('Error', 'Debe ingresar un monto válido para la devolución');
      return;
    }

    if (this.refundAmount > this.getTotalPaid()) {
      this.notificationService.showError('Error', 'El monto de devolución no puede ser mayor al total pagado');
      return;
    }

    this.confirmationService.showConfirmation(
      {
        title: 'Confirmar Devolución',
        message: `¿Está seguro de procesar una devolución de ${this.formatCurrency(this.refundAmount)}?`,
        confirmText: 'Procesar',
        cancelText: 'Cancelar',
        type: 'warning'
      },
      () => {
        this.executeRefund();
      }
    );
  }

  private executeRefund(): void {
    this.isProcessingRefund = true;

    if (this.refundFile) {
      // Primero subir el archivo
      const formData = new FormData();
      formData.append('file', this.refundFile);

      this.paymentService.uploadFile(formData).subscribe({
        next: (uploadResponse) => {
          // Una vez subido el archivo, procesar la devolución
          const returnAccount = {
            id: this.account.id,
            monto: this.refundAmount,
            comprobante: uploadResponse.data.id
          };

          this.accountService.returnAccount(returnAccount).subscribe({
            next: (response) => {
              this.isProcessingRefund = false;
              this.notificationService.showSuccess('Devolución Procesada', 'La devolución ha sido procesada exitosamente');
              this.closeRefundModal();
              
              // Recargar los datos de la cuenta
              this.refreshAccountData();
            },
            error: (error) => {
              this.isProcessingRefund = false;
              this.notificationService.showError('Error', 'Error al procesar la devolución: ' + (error.message || 'Error desconocido'));
            }
          });
        },
        error: (error) => {
          this.isProcessingRefund = false;
          this.notificationService.showError('Error', 'Error al subir el comprobante: ' + (error.message || 'Error desconocido'));
        }
      });
    } else {
      // Si no hay archivo, procesar sin comprobante
      const returnAccount = {
        id: this.account.id,
        monto: this.refundAmount,
        comprobante: undefined
      };

      this.accountService.returnAccount(returnAccount).subscribe({
        next: (response) => {
          this.isProcessingRefund = false;
          this.notificationService.showSuccess('Devolución Procesada', 'La devolución ha sido procesada exitosamente');
          this.closeRefundModal();
          
          // Recargar los datos de la cuenta
          this.refreshAccountData();
        },
        error: (error) => {
          this.isProcessingRefund = false;
          this.notificationService.showError('Error', 'Error al procesar la devolución: ' + (error.message || 'Error desconocido'));
        }
      });
    }
  }
}
