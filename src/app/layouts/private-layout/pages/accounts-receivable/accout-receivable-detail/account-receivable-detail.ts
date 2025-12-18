import {Component, EventEmitter, Input, Output, ChangeDetectorRef, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {AccountReceivable, PaymentModel} from '../../../../../core/models/AccountReceivable';
import { PaymentDetailComponent } from '../payment-detail/payment-detail';
import {PAYMENT_METHOD} from '../../../../../core/const/PaymentMethod';
import {PaymentService} from '../../../../../core/services/payment.service';
import {AccountReceivableService} from '../../../../../core/services/account-receivable.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { StorageServices } from '../../../../../core/services/storage.services';

@Component({
  selector: 'app-account-receivable-detail',
  imports: [CommonModule, FormsModule, PaymentDetailComponent],
  templateUrl: './account-receivable-detail.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default
})
export class AccountReceivableDetailComponent implements OnInit, OnChanges {
  @Input() account!: AccountReceivable;

  ngOnInit() {
    if (this.account) {
      this.initializeDiscountValues();
      setTimeout(() => this.checkAndUpdateAccountStatus(), 0);
    }
    this.initializeComponentProperties();
    this.cdr.detectChanges();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['account'] && changes['account'].currentValue) {
      this.initializeDiscountValues();
      this.initializeComponentProperties();
      setTimeout(() => this.checkAndUpdateAccountStatus(), 0);
      this.cdr.detectChanges();
    }
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

  // Propiedades para el descuento
  discountPercentage: number = 0;
  originalAmount: number = 0;
  finalAmount: number = 0;
  isEditingDiscount = false;

  // Propiedades para el modal de devolución
  showRefundModal = false;
  refundAmount: number = 0;
  refundAmountDisplay: string = '';
  refundFile: File | null = null;
  isProcessingRefund = false;
  returnTotalPaid: boolean = false;

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

  getMaxRefundAvailable(): number {
    const totalValorNeto = this.payments
      .filter(payment => payment.estado === 'PAGADO')
      .reduce((total, payment) => {
        const valorNeto = payment.valor_neto ? parseFloat(payment.valor_neto.toString()) : 0;
        return total + valorNeto;
      }, 0);

    const totalDevoluciones = this.payments
      .filter(payment => payment.estado === 'DEVOLUCION')
      .reduce((total, payment) => total + payment.valor, 0);

    return totalValorNeto - totalDevoluciones;
  }

  getTotalPaidAmount(): number {
    const totalValor = this.payments
      .filter(payment => payment.estado === 'PAGADO')
      .reduce((total, payment) => {
        return total + payment.valor;
      }, 0);

    const totalDevoluciones = this.payments
      .filter(payment => payment.estado === 'DEVOLUCION')
      .reduce((total, payment) => total + payment.valor, 0);

    return totalValor - totalDevoluciones;
  }

  getRemainingBalance(): number {
    return this.finalAmount - this.getTotalPaid();
  }

  getPaymentProgress(): number {
    return (this.getTotalPaid() / this.finalAmount) * 100;
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

  get client(): any {
    const c: any = this.account?.cliente_id as any;
    return c && typeof c === 'object' ? c : null;
  }

  toggleAddPaymentForm() {
    this.showAddPaymentForm = !this.showAddPaymentForm;
    if (!this.showAddPaymentForm) {
      this.resetPaymentForm();
    }
    this.cdr.detectChanges();
  }

  addNewPayment() {
    this.isSubmittingPayment = true;
    const currentUser = StorageServices.getCurrentUser();

    const payment: any = {
      cuenta_cobrar_id: this.account.id,
      valor: this.newPaymentAmount,
      fecha_pago: new Date().toISOString(),
      metodo_pago: this.newPaymentMethod,
      pagador: this.newPayerName,
      estado: 'PAGADO',
      comprobante: null,
      responsable: currentUser?.id
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
        // Use finalAmount instead of account.monto for status determination
        const newEstado = newSaldo >= this.finalAmount ? 'PAGADA' : 'PENDIENTE';
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
          // Check and update account status after refreshing data
          this.checkAndUpdateAccountStatus();
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
    // Forzar detección de cambios
    this.cdr.detectChanges();
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

  // Construye el texto para la sección Curso, incluyendo prefijo "Inscripción -" si aplica
  getCourseLabel(): string {
    const nombre = ((this.account?.curso_id as any)?.nombre || '').toString().trim();
    const isInscripcion = this.isInscripcion();

    const base = nombre || 'Sin curso';
    return isInscripcion ? `Inscripción - ${base}`.trim() : base;
  }

  // Devuelve etiqueta del tipo de cuenta: "Inscripción" o "Curso"
  getAccountTypeLabel(): string {
    return this.isInscripcion() ? 'Inscripción' : 'Curso';
  }

  // Normaliza distintos formatos del backend para el flag de inscripción
  private isInscripcion(): boolean {
    const flag: any = this.account?.es_inscripcion;
    if (typeof flag === 'boolean') return flag;
    if (typeof flag === 'number') return flag === 1;
    const normalized = (flag ?? '').toString().trim().toUpperCase();
    return normalized === 'TRUE' || normalized === 'SI' || normalized === 'YES' || normalized === 'Y' || normalized === '1';
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
      // Determinar el nuevo estado basado en la comparación finalAmount vs saldo
      let newEstado = '';
      const currentSaldo = this.account.saldo || 0;

      // Use finalAmount for status determination instead of editedAmount
      if (currentSaldo >= this.finalAmount) {
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

    // Permitir eliminar si es un método permitido O si es TRANSACCIÓN y estado DEVOLUCION
    return allowedMethods.includes(payment.metodo_pago) ||
           (payment.metodo_pago === 'TRANSACCIÓN' && payment.estado === 'DEVOLUCION');
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
    this.returnTotalPaid = false;
    this.refundAmountDisplay = '';
    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  closeRefundModal(): void {
    this.showRefundModal = false;
    this.refundAmount = 0;
    this.refundAmountDisplay = '';
    this.refundFile = null;
    this.returnTotalPaid = false;
    this.isProcessingRefund = false;
    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  toggleReturnTotalPaid(): void {
    // No invertimos el valor aquí porque ngModel ya lo actualizó al hacer click

    if (this.returnTotalPaid) {
      // Si se activa, usar el TOTAL PAGADO (bruto) como monto
      const totalPaid = this.getTotalPaidAmount();
      this.refundAmount = totalPaid;
      this.refundAmountDisplay = this.formatRefundNumber(totalPaid);

      // Ocultar cualquier notificación de advertencia existente
      this.notificationService.hideNotification();
    } else {
      // Si se desactiva, limpiar el monto
      this.refundAmount = 0;
      this.refundAmountDisplay = '';
    }
  }

  onRefundAmountChange(event: any): void {
    // Si el usuario edita manualmente, desmarcamos el checkbox de "Total Pagado"
    if (this.returnTotalPaid) {
      this.returnTotalPaid = false;
    }

    // Remover comas (separadores de miles) y caracteres no válidos (dejar números y punto)
    let value = event.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');

    // Manejar múltiples puntos - mantener solo el primero
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Calcular valor numérico (parseFloat usa punto nativamente)
    const numericValue = parseFloat(value) || 0;

    // Validar que no exceda el máximo disponible (valor_neto)
    // PERO si se seleccionó "Devolver Total Pagado", permitimos el valor bruto
    const maxRefundAvailable = this.getMaxRefundAvailable();

    // NOTA: Aquí es donde estaba el conflicto. Si queremos que el usuario pueda devolver
    // el total pagado (bruto), la validación debe ser flexible o basarse en el bruto.
    // Sin embargo, el backend probablemente valide contra valor_neto si se trata de Wompi.
    // Asumiremos que si el usuario selecciona "Total Pagado", queremos permitir ese valor
    // en el input, pero el envío al backend y validación final dependerá de la lógica de negocio.
    // Para cumplir con la solicitud visual: "El monto no puede ser mayor al máximo disponible"
    // debe seguir validando contra lo que el sistema permite realmente (maxRefundAvailable).

    if (numericValue > maxRefundAvailable && !this.returnTotalPaid) {
       // Si el valor ingresado manualmente supera el disponible REAL (neto), mostramos error.
       // Pero si viene del checkbox (aunque aquí se desmarca al editar), la lógica es delicada.
       // Si el usuario quiere devolver el bruto, pero el sistema solo tiene el neto disponible,
       // técnicamente no se puede devolver más de lo que hay en la cuenta de Wompi.

       // REVISIÓN: El usuario pidió:
       // "Hay una sección que se llama Total Pagado. Ese valor debe ser lo máximo permitido cuando le doy check"
       // Y "el Máximo disponible: no es como lo tenía antes. Esa sección debe quedar como estaba antes"

       // Entonces:
       // 1. getMaxRefundAvailable() debe retornar el valor NETO (como estaba antes).
       // 2. toggleReturnTotalPaid() debe llenar el input con el valor BRUTO (Total Pagado).
       // 3. La validación en onRefundAmountChange debe permitir este valor si es igual al Total Pagado,
       //    O debemos ajustar la validación para que no bloquee la acción visual.

       // Si el valor bruto es mayor al neto disponible, técnicamente hay un déficit para la devolución completa
       // desde la pasarela, pero tal vez el negocio lo maneja diferente.
       // Vamos a permitir que se llene el input, pero la validación de advertencia se disparará
       // si el usuario edita y supera el límite.

       this.refundAmount = maxRefundAvailable;
       this.refundAmountDisplay = this.formatRefundNumber(maxRefundAvailable);
       event.target.value = this.refundAmountDisplay;

       this.notificationService.showWarning('Advertencia',
         `El monto no puede ser mayor al máximo disponible: ${this.formatCurrency(maxRefundAvailable)}`);
       return;
    }

    // Si el usuario selecciona el checkbox, el valor puede ser mayor al disponible neto.
    // Debemos manejar esto. Si numericValue viene de la edición manual, validamos estricto.

    this.refundAmount = numericValue;
    this.refundAmountDisplay = this.formatRefundInputValue(value);

    // Actualizar el valor del input
    event.target.value = this.refundAmountDisplay;
  }

  private formatRefundInputValue(value: string): string {
    if (!value) return '';

    const parts = value.split('.');
    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';

    // Manejar parte entera vacía o ceros a la izquierda
    if (integerPart === '') {
      integerPart = '0';
    } else {
      const val = parseInt(integerPart);
      integerPart = isNaN(val) ? '0' : val.toString();
    }

    // Agregar separadores de miles (comas)
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return integerPart + decimalPart;
  }

  private formatRefundNumber(num: number): string {
    if (num === 0) return '';
    // Manejar decimales si existen
    const parts = num.toString().split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
    return integerPart + decimalPart;
  }

  private formatNumberWithDots(num: number): string {
    if (num === 0) return '';
    // Manejar decimales si existen
    const parts = num.toString().split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    // Limitar a 2 decimales si hay muchos? Por ahora mostramos lo que hay
    const decimalPart = parts.length > 1 ? ',' + parts[1] : '';
    return integerPart + decimalPart;
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

    const maxRefundAvailable = this.getMaxRefundAvailable();
    if (this.refundAmount > maxRefundAvailable) {
      this.notificationService.showError('Error', `El monto de devolución no puede ser mayor al máximo disponible: ${this.formatCurrency(maxRefundAvailable)}`);
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
    const currentUser = StorageServices.getCurrentUser();

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
            comprobante: uploadResponse.data.id,
            responsable: currentUser?.id
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
              this.notificationService.showError('Error', 'Error al subir el comprobante: ' + (error.message || 'Error desconocido'));
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
        comprobante: undefined,
        responsable: currentUser?.id
      };

      this.accountService.returnAccount(returnAccount).subscribe({
        next: (response) => {
          this.isProcessingRefund = false;
          this.notificationService.showSuccess('Devolución Procesada', 'La devolución ha sido procesada exitosamente');
          this.closeRefundModal();


          this.refreshAccountData();
        },
        error: (error) => {
          this.isProcessingRefund = false;
          this.notificationService.showError('Error', 'Error al procesar la devolución: ' + (error.message || 'Error desconocido'));
        }
      });
    }
  }


  initializeDiscountValues(): void {
    if (!this.account) return;
    this.discountPercentage = this.account.descuento || 0;
    if (this.discountPercentage > 0) {
      this.originalAmount = this.account.monto;
      this.finalAmount = this.originalAmount * (1 - this.discountPercentage / 100);
    } else {
      this.originalAmount = this.account.monto;
      this.finalAmount = this.account.monto;
    }
  }

  private initializeComponentProperties(): void {
    this.showRefundModal = false;
    this.showAddPaymentForm = false;
    this.showPaymentDetailView = false;
    this.isSubmittingPayment = false;
    this.isDeletingPayment = false;
    this.isProcessingRefund = false;
    this.isEditingAmount = false;
    this.isEditingDiscount = false;

    // Inicializar propiedades de formulario
    this.newPaymentAmountDisplay = '';
    this.refundAmountDisplay = '';
    this.selectedPayment = null;
    this.deletingPaymentId = null;
    this.newPaymentImage = null;
    this.refundFile = null;

    // Forzar detección de cambios múltiple
    this.cdr.markForCheck();
    this.cdr.detectChanges();

    // Usar setTimeout para asegurar que los cambios se apliquen en el próximo ciclo
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  startEditingDiscount(): void {
    this.isEditingDiscount = true;
  }

  cancelEditingDiscount(): void {
    this.isEditingDiscount = false;
    // Restaurar el descuento original
    this.discountPercentage = this.account.descuento || 0;
    this.calculateDiscount();
  }

  saveDiscount(): void {
    if (this.discountPercentage >= 0 && this.discountPercentage <= 100) {
      // Si es la primera vez aplicando descuento, usar el monto actual como original
      if (this.account.descuento === 0 || !this.account.descuento) {
        this.originalAmount = this.account.monto;
      }

      this.calculateDiscount();
      this.updateAccountAmount();
      this.isEditingDiscount = false;
    }
  }

  calculateDiscount(): void {
    const discountAmount = (this.originalAmount * this.discountPercentage) / 100;
    this.finalAmount = this.originalAmount - discountAmount;
  }

  onDiscountPercentageChange(): void {
    if (this.discountPercentage < 0) {
      this.discountPercentage = 0;
    } else if (this.discountPercentage > 100) {
      this.discountPercentage = 100;
    }
    this.calculateDiscount();
  }

  private updateAccountAmount(): void {
    const updateData = {
      monto: this.originalAmount,
      descuento: this.discountPercentage
    };

    this.accountService.updateAccountReceivable(this.account.id, updateData).subscribe({
      next: (response) => {
        this.account.monto = this.originalAmount;
        this.account.descuento = this.discountPercentage;
        this.notificationService.showSuccess('Éxito', 'Descuento aplicado correctamente');
        this.checkAndUpdateAccountStatus();
        this.llamarFuncion.emit();
      },
      error: (error) => {
        console.error('Error al aplicar descuento:', error);
        this.notificationService.showError('Error', 'Error al aplicar el descuento');
      }
    });
  }

  private checkAndUpdateAccountStatus(): void {
    const totalPaid = this.getTotalPaid();
    const shouldBePaid = totalPaid >= this.finalAmount;

    // Only update if the status needs to change
    if (shouldBePaid && this.account.estado === 'PENDIENTE') {
      this.updateAccountStatus('PAGADA');
    } else if (!shouldBePaid && this.account.estado === 'PAGADA') {
      this.updateAccountStatus('PENDIENTE');
    }
  }


  private updateAccountStatus(newStatus: 'PAGADA' | 'PENDIENTE'): void {
    this.accountService.updateAccountReceivable(this.account.id, {
      estado: newStatus
    }).subscribe({
      next: (response) => {
        this.account.estado = newStatus;
        this.llamarFuncion.emit();
      }
    });
  }

  getDiscountAmount(): number {
    return this.originalAmount - this.finalAmount;
  }
}
