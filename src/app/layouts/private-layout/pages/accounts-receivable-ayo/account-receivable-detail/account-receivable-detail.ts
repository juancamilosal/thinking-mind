import {Component, EventEmitter, Input, Output, ChangeDetectorRef, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {AccountReceivable, PaymentModel} from '../../../../../core/models/AccountReceivable';
import { PaymentDetailComponent } from '../../accounts-receivable/payment-detail/payment-detail';
import {PAYMENT_METHOD} from '../../../../../core/const/PaymentMethod';
import {PaymentService} from '../../../../../core/services/payment.service';
import {AccountReceivableService} from '../../../../../core/services/account-receivable.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { StorageServices } from '../../../../../core/services/storage.services';
import { AppButtonComponent } from '../../../../../components/app-button/app-button.component';

@Component({
  selector: 'app-account-receivable-detail-ayo',
  imports: [CommonModule, FormsModule, PaymentDetailComponent, AppButtonComponent],
  templateUrl: './account-receivable-detail.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default
})
export class AccountReceivableDetailAyoComponent implements OnInit, OnChanges {
  @Input() account!: AccountReceivable;
  isLoading = false;

  ngOnInit() {
    if (this.account) {
      this.initializeDiscountValues();
      setTimeout(() => this.checkAndUpdateAccountStatus(), 0);
      this.initializeComponentProperties();
      this.cdr.detectChanges();
    } else {
      this.route.paramMap.subscribe(params => {
        const id = params.get('id');
        if (id) {
          this.loadAccount(id);
        }
      });
    }
  }

  loadAccount(id: string) {
    this.isLoading = true;
    this.accountService.getAccountById(id).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.data) {
          this.account = response.data;
          this.initializeDiscountValues();
          this.checkAndUpdateAccountStatus();
          this.initializeComponentProperties();
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.showError('Error', 'No se pudo cargar la cuenta');
        this.goBack();
      }
    });
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

  goBack() {
    if (this.route.snapshot.paramMap.get('id')) {
      this.router.navigate(['/private/accounts-receivable-ayo']);
    } else {
      this.backToList.emit();
    }
  }


  get payments(): PaymentModel[] {
    return this.account?.pagos || [];
  }

  selectedPayment: PaymentModel | null = null;
  showPaymentDetailView = false;
  showAddPaymentForm = false;
  newPaymentAmount: number = 0;
  newPaymentAmountDisplay: string = '';
  newPaymentMethod: string = '';
  newPaymentReference: string = '';
  newPayerName: string = '';
  newApprovalNumber: string = '';
  newBank: string = '';
  newPaymentImage: File | null = null;
  newPaymentImagePreview: string | null = null;
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
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private router: Router
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
    this.goBack();
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
          // Validar respuesta del backend
          if ((uploadResponse as any)?.status === 'ERROR' || !(uploadResponse as any)?.data?.id) {
            this.isSubmittingPayment = false;
            const msg = this.getResponseMessage(uploadResponse) || 'No se pudo subir la imagen del comprobante.';
            this.notificationService.showError('Error al subir comprobante', msg);
            this.cdr.detectChanges();
            return;
          }
          payment.comprobante = (uploadResponse as any).data.id;
          this.createPaymentRecord(payment);
        },
        error: (uploadError) => {
          this.isSubmittingPayment = false;
          const msg = this.getErrorMessage(uploadError);
          this.notificationService.showError('Error al subir comprobante', msg);
          this.cdr.detectChanges();
        }
      });
    } else {
      this.createPaymentRecord(payment);
    }
  }

  private createPaymentRecord(payment: any) {
    this.paymentService.createPayment(payment).subscribe({
      next: (response: any): void => {
        // Si el backend retorna éxito lógico/ERROR en 200, validarlo
        if (response && response.status === 'ERROR') {
          this.isSubmittingPayment = false;
          const msg = this.getResponseMessage(response) || 'El servidor rechazó el registro del pago.';
          this.notificationService.showError('Error al registrar pago', msg);
          this.cdr.detectChanges();
          return;
        }
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
            this.cdr.detectChanges();

          },
          error: (updateError) => {
            this.isSubmittingPayment = false;
            const msg = this.getErrorMessage(updateError);
            this.notificationService.showError('Error al actualizar saldo', msg);
            this.cdr.detectChanges();

          }
        });
      },
      error: (paymentError) => {
        this.isSubmittingPayment = false;
        const msg = this.getErrorMessage(paymentError);
        this.notificationService.showError('Error al registrar pago', msg);
        this.cdr.detectChanges();
      }
    });
  }

  private getErrorMessage(error: any): string {
    try {
      const e = error || {};
      if (e.error) {
        const err = e.error;
        if (typeof err === 'string') return err;
        if (err.data && typeof err.data === 'string') return err.data;
        if (Array.isArray(err.errors) && err.errors.length > 0) {
          const first = err.errors[0];
          if (first.message) return first.message;
          if (first.extensions && first.extensions.code) return first.extensions.code;
        }
        if (err.message) return err.message;
      }
      if (e.message) return e.message;
      return 'Ocurrió un error no especificado. Inténtalo nuevamente.';
    } catch {
      return 'Ocurrió un error no especificado. Inténtalo nuevamente.';
    }
  }

  private getResponseMessage(response: any): string {
    if (!response) return '';
    const r = response as any;
    if (typeof r.message === 'string' && r.message.trim()) return r.message;
    if (r.data && typeof r.data === 'string' && r.data.trim()) return r.data;
    if (Array.isArray(r.errors) && r.errors.length > 0) {
      const first = r.errors[0];
      if (first?.message) return first.message;
    }
    return '';
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
    this.newPaymentImagePreview = null;
    this.isSubmittingPayment = false;
    // Forzar detección de cambios
    this.cdr.detectChanges();
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        this.newPaymentImage = file;
        
        // Generate preview
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.newPaymentImagePreview = e.target.result;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(file);
      } else {
        this.notificationService.showError('Error', 'Por favor seleccione un archivo de imagen válido.');
        event.target.value = '';
        this.newPaymentImage = null;
        this.newPaymentImagePreview = null;
      }
    }
  }

  removePaymentImage() {
    this.newPaymentImage = null;
    this.newPaymentImagePreview = null;
    this.cdr.detectChanges();
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

  cancelEditingAmount(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.isEditingAmount = false;
    this.editedAmount = 0;
  }

  saveAmount(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.editedAmount > 0) {
      // Actualización optimista: Cerrar edición inmediatamente
      this.isEditingAmount = false;

      // Guardar valores anteriores para rollback si falla
      const previousMonto = this.account.monto;
      const previousEstado = this.account.estado;
      const previousMontoDescuento = (this.account as any).monto_descuento;

      let newEstado = '';
      const currentSaldo = this.account.saldo || 0;

      this.originalAmount = this.editedAmount;
      this.calculateDiscount();

      if (currentSaldo >= this.finalAmount) {
        newEstado = 'PAGADA';
      } else {
        newEstado = 'PENDIENTE';
      }

      // Actualizar modelo local inmediatamente
      this.account.monto = this.finalAmount;
      this.account.estado = newEstado;

      // Llamar a la API
      this.accountService.updateAccountReceivable(this.account.id, {
        monto: this.finalAmount,
        estado: newEstado,
        monto_descuento: this.account.monto_descuento, // Actualizar también el descuento en DB
        descuento: this.discountPercentage
      }).subscribe({
        next: (response) => {
          this.notificationService.showSuccess('Monto actualizado', 'El monto de la cuenta ha sido actualizado.');
          this.llamarFuncion.emit();
          this.cdr.detectChanges();
        },
        error: (error) => {
          // Revertir cambios si falla
          this.account.monto = previousMonto;
          this.account.estado = previousEstado;
          (this.account as any).monto_descuento = previousMontoDescuento;
          this.calculateDiscount();

          this.notificationService.showError('Error', 'No se pudo actualizar el monto.');
          this.cdr.detectChanges();
        }
      });
    }
  }

  onPaymentAmountChange(event: any) {
    // Remove non-numeric chars for processing
    const rawValue = event.target.value.replace(/[^0-9]/g, '');
    this.newPaymentAmount = rawValue ? parseInt(rawValue, 10) : 0;
    
    // Format for display
    if (rawValue) {
      this.newPaymentAmountDisplay = new Intl.NumberFormat('es-CO').format(this.newPaymentAmount);
    } else {
      this.newPaymentAmountDisplay = '';
    }
  }

  // --- Lógica para Descuento ---

  startEditingDiscount() {
    this.isEditingDiscount = true;
  }

  cancelEditingDiscount(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.isEditingDiscount = false;
    // Restaurar valor visual si se cancela (aunque discountPercentage ya tiene el valor real)
    this.initializeDiscountValues();
  }

  onDiscountPercentageChange() {
    if (this.discountPercentage < 0) this.discountPercentage = 0;
    if (this.discountPercentage > 100) this.discountPercentage = 100;
  }

  saveDiscount(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.isEditingDiscount = false;
    this.calculateDiscount();
    this.updateDiscountInBackend();
  }

  initializeDiscountValues() {
    if (this.account) {
      // Parse values safely handling strings/numbers
      const monto = Number(this.account.monto) || 0;
      const montoDescuento = Number(this.account.monto_descuento) || 0;
      const descuentoRaw = this.account.descuento;
      let discountPct = 0;
      
      if (descuentoRaw !== undefined && descuentoRaw !== null) {
          discountPct = parseFloat(descuentoRaw.toString());
      }
      
      // Fix: if discountPct is NaN, set to 0
      if (isNaN(discountPct)) discountPct = 0;

      this.finalAmount = monto;
      this.discountPercentage = discountPct;

      if (discountPct > 0) {
          // If we have a percentage, calculate original amount
          if (montoDescuento > 0) {
              this.originalAmount = monto + montoDescuento;
          } else {
              this.originalAmount = Math.round(monto / (1 - (discountPct / 100)));
              // Backfill monto_descuento locally
              this.account.monto_descuento = this.originalAmount - monto;
          }
      } else if (montoDescuento > 0) {
          // No percentage explicit, calculate from amounts
          this.originalAmount = monto + montoDescuento;
          this.discountPercentage = parseFloat(((montoDescuento / this.originalAmount) * 100).toFixed(1));
      } else {
          // No discount
          this.originalAmount = monto;
          this.discountPercentage = 0;
      }
    }
  }
  
  initializeComponentProperties() {
     this.showAddPaymentForm = false;
     this.showRefundModal = false;
     this.resetPaymentForm();
     this.resetRefundForm();
  }

  calculateDiscount() {
    const discountAmount = Math.round((this.originalAmount * this.discountPercentage) / 100);
    this.finalAmount = Math.round(this.originalAmount - discountAmount);
    
    // Actualizar los valores en el objeto account para que se reflejen y se envíen
    this.account.monto_descuento = discountAmount;
    this.account.descuento = this.discountPercentage;
    // Nota: No actualizamos account.monto aquí todavía, se hace al confirmar/guardar o en updateDiscountInBackend
  }

  getDiscountAmount(): number {
    return Math.round((this.originalAmount * this.discountPercentage) / 100);
  }

  updateDiscountInBackend() {
    // Actualizar el monto en el backend
    // El nuevo monto de la cuenta es el finalAmount
    
    const previousMonto = this.account.monto;
    const previousMontoDescuento = (this.account as any).monto_descuento;
    const previousEstado = this.account.estado;

    // Actualización optimista
    this.account.monto = this.finalAmount;
    
    // Recalcular estado basado en el nuevo monto
    let newEstado = '';
    const currentSaldo = this.account.saldo || 0;
    if (currentSaldo >= this.finalAmount) {
      newEstado = 'PAGADA';
    } else {
      newEstado = 'PENDIENTE';
    }
    this.account.estado = newEstado;

    this.accountService.updateAccountReceivable(this.account.id, {
      monto: this.finalAmount,
      monto_descuento: this.account.monto_descuento,
      descuento: this.discountPercentage,
      estado: newEstado
    }).subscribe({
      next: (response) => {
        this.notificationService.showSuccess('Descuento actualizado', 'El descuento ha sido aplicado correctamente.');
        this.llamarFuncion.emit();
        this.cdr.detectChanges();
      },
      error: (error) => {
        // Rollback
        this.account.monto = previousMonto;
        (this.account as any).monto_descuento = previousMontoDescuento;
        this.account.estado = previousEstado;
        this.initializeDiscountValues(); // Recalcular valores visuales
        
        this.notificationService.showError('Error', 'No se pudo actualizar el descuento.');
        this.cdr.detectChanges();
      }
    });
  }

  checkAndUpdateAccountStatus() {
    if (!this.account) return;
    
    // Verificar si el estado visual coincide con la lógica de negocio
    const currentSaldo = this.account.saldo || 0;
    // Usar finalAmount si está inicializado, sino monto
    const targetAmount = this.finalAmount || this.account.monto || 0;
    
    const calculatedState = currentSaldo >= targetAmount ? 'PAGADA' : 'PENDIENTE';
    
    if (this.account.estado !== calculatedState && this.account.estado !== 'ANULADA' && this.account.estado !== 'DEVOLUCION') {
      console.log(`Estado incorrecto detectado. Actual: ${this.account.estado}, Calculado: ${calculatedState}`);
      // Opcional: Auto-corregir en backend si es crítico, o solo visualmente
      // this.account.estado = calculatedState;
    }
  }


  // --- Lógica para Devoluciones ---

  openRefundModal() {
    this.showRefundModal = true;
    this.refundAmount = 0;
    this.refundAmountDisplay = '';
    this.refundFile = null;
    this.returnTotalPaid = false;
  }

  closeRefundModal() {
    this.showRefundModal = false;
    this.resetRefundForm();
  }

  resetRefundForm() {
    this.refundAmount = 0;
    this.refundAmountDisplay = '';
    this.refundFile = null;
    this.isProcessingRefund = false;
    this.returnTotalPaid = false;
  }

  onRefundAmountChange(event: any) {
    const rawValue = event.target.value.replace(/[^0-9]/g, '');
    let val = rawValue ? parseInt(rawValue, 10) : 0;
    
    // Validar que no exceda lo disponible para devolver
    const maxRefund = this.getMaxRefundAvailable();
    if (val > maxRefund) {
      val = maxRefund;
    }
    
    this.refundAmount = val;
    this.refundAmountDisplay = val > 0 ? new Intl.NumberFormat('es-CO').format(val) : '';
  }

  toggleReturnTotal() {
    this.returnTotalPaid = !this.returnTotalPaid;
    if (this.returnTotalPaid) {
      this.refundAmount = this.getMaxRefundAvailable();
      this.refundAmountDisplay = new Intl.NumberFormat('es-CO').format(this.refundAmount);
    } else {
      this.refundAmount = 0;
      this.refundAmountDisplay = '';
    }
  }

  onRefundFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.refundFile = file;
    }
  }

  processRefund() {
    if (this.refundAmount <= 0) {
      this.notificationService.showError('Error', 'El monto de devolución debe ser mayor a cero.');
      return;
    }

    if (this.refundAmount > this.getMaxRefundAvailable()) {
      this.notificationService.showError('Error', 'El monto excede el saldo disponible para devolución.');
      return;
    }

    this.isProcessingRefund = true;
    const currentUser = StorageServices.getCurrentUser();

    const paymentData: any = {
      cuenta_cobrar_id: this.account.id,
      valor: this.refundAmount,
      fecha_pago: new Date().toISOString(),
      metodo_pago: 'DEVOLUCION',
      pagador: 'COLEGIO', // O el nombre de la institución
      estado: 'DEVOLUCION',
      responsable: currentUser?.id,
      observaciones: 'Devolución de dinero'
    };

    // 1. Subir archivo si existe
    if (this.refundFile) {
      const formData = new FormData();
      formData.append('file', this.refundFile);

      this.paymentService.uploadFile(formData).subscribe({
        next: (uploadResponse) => {
          if ((uploadResponse as any)?.data?.id) {
            paymentData.comprobante = (uploadResponse as any).data.id;
            this.createRefundPayment(paymentData);
          } else {
            this.isProcessingRefund = false;
            this.notificationService.showError('Error', 'No se pudo subir el comprobante.');
          }
        },
        error: () => {
          this.isProcessingRefund = false;
          this.notificationService.showError('Error', 'Error al subir el comprobante.');
        }
      });
    } else {
      this.createRefundPayment(paymentData);
    }
  }

  private createRefundPayment(paymentData: any) {
    this.paymentService.createPayment(paymentData).subscribe({
      next: () => {
        // Actualizar el saldo de la cuenta
        // En devoluciones, el saldo "pagado" disminuye, por ende el saldo pendiente aumenta?
        // O simplemente se registra la devolución. 
        // Lógica: El saldo de la cuenta es cuanto han pagado. Si devuelvo, han pagado menos.
        // Saldo = Pagos - Devoluciones.
        
        // Pero en la DB, 'saldo' suele ser lo que han pagado (acumulado).
        // Si la lógica es Saldo = Total Pagado, entonces al hacer devolución, el Saldo debe disminuir.
        
        const newSaldo = this.account.saldo - this.refundAmount;
        const newEstado = newSaldo >= this.finalAmount ? 'PAGADA' : 'DEVOLUCION'; // O PENDIENTE?

        this.accountService.updateAccountReceivable(this.account.id, {
          saldo: newSaldo,
          estado: newEstado
        }).subscribe({
          next: () => {
            this.isProcessingRefund = false;
            this.closeRefundModal();
            this.notificationService.showSuccess('Éxito', 'Devolución registrada correctamente.');
            this.account.saldo = newSaldo;
            this.account.estado = newEstado;
            this.refreshAccountData();
            this.llamarFuncion.emit();
          },
          error: (err) => {
            this.isProcessingRefund = false;
            this.notificationService.showError('Error', 'Se registró el pago pero falló la actualización de saldo.');
            this.refreshAccountData();
          }
        });
      },
      error: (err) => {
        this.isProcessingRefund = false;
        this.notificationService.showError('Error', 'No se pudo registrar la devolución.');
      }
    });
  }
}
