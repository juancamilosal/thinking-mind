import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PayrollService } from '../../../../core/services/payroll.service';
import { UserService } from '../../../../core/services/user.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { User } from '../../../../core/models/User';
import { TeacherPayroll } from '../../../../core/models/Payroll';
import { Roles } from '../../../../core/const/Roles';
import { PAYMENT_METHOD } from '../../../../core/const/PaymentMethod';
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';

@Component({
  selector: 'payroll-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AppButtonComponent],
  templateUrl: './payroll-admin.html'
})
export class PayrollAdmin implements OnInit, OnDestroy {
  // Data
  teachers: User[] = [];
  payrollRecords: TeacherPayroll[] = [];

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 15, 20, 50];
  Math = Math;

  // Filters
  selectedTeacherId: string = '';
  startDate: string = '';
  endDate: string = '';
  selectedStatus: string = '';
  teacherSearchTerm: string = '';

  // Loading states
  isLoading = false;
  isLoadingTeachers = false;

  // Selection for batch operations
  selectedPayrollIds: Set<string> = new Set();
  selectAll = false;

  // Payment modal
  showPaymentModal = false;
  paymentMethod: string = '';
  paymentDate: string = '';
  selectedPayrollForPayment: string[] = [];
  isProcessingPayment = false;

  // Search timeout
  private searchTimeout: any;

  // Payment methods for dropdown
  paymentMethods = PAYMENT_METHOD;

  constructor(
    private payrollService: PayrollService,
    private userService: UserService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.loadTeachers();
    this.loadPayrollRecords();
    this.setDefaultPaymentDate();
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  setDefaultPaymentDate() {
    const today = new Date();
    this.paymentDate = today.toISOString().split('T')[0];
  }

  loadTeachers(searchTerm?: string) {
    this.isLoadingTeachers = true;
    this.userService.getUsersByRole(Roles.TEACHER, searchTerm).subscribe({
      next: (response) => {
        this.teachers = response.data || [];
        this.isLoadingTeachers = false;
      },
      error: (error) => {
        console.error('Error loading teachers:', error);
        this.isLoadingTeachers = false;
        this.notificationService.showError('Error', 'No se pudieron cargar los docentes');
      }
    });
  }

  onTeacherSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.teacherSearchTerm = target.value;
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadTeachers(this.teacherSearchTerm);
    }, 300);
  }

  loadPayrollRecords() {
    this.isLoading = true;
    this.selectedPayrollIds.clear();
    this.selectAll = false;

    const filters: any = {};

    if (this.selectedTeacherId) {
      filters.teacherId = this.selectedTeacherId;
    }

    if (this.startDate) {
      filters.startDate = this.startDate;
    }

    if (this.endDate) {
      filters.endDate = this.endDate;
    }

    if (this.selectedStatus) {
      filters.estadoPago = this.selectedStatus;
    }

    this.payrollService.getAllPayrollRecords(this.currentPage, this.itemsPerPage, filters).subscribe({
      next: (response) => {
        this.payrollRecords = response.data || [];
        this.totalItems = response.meta?.filter_count || response.meta?.total_count || 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading payroll records:', error);
        this.isLoading = false;
        this.notificationService.showError('Error', 'No se pudieron cargar los registros de nómina');
      }
    });
  }

  applyFilters() {
    this.currentPage = 1;
    this.loadPayrollRecords();
  }

  clearFilters() {
    this.selectedTeacherId = '';
    this.startDate = '';
    this.endDate = '';
    this.selectedStatus = '';
    this.teacherSearchTerm = '';
    this.currentPage = 1;
    this.loadTeachers();
    this.loadPayrollRecords();
  }

  // Pagination methods
  onItemsPerPageChange() {
    this.currentPage = 1;
    this.loadPayrollRecords();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPayrollRecords();
    }
  }

  getVisiblePages(): number[] {
    const maxVisible = 5;
    const pages: number[] = [];

    if (this.totalPages <= maxVisible) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, this.currentPage - 2);
      const end = Math.min(this.totalPages, start + maxVisible - 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  // Selection methods
  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.payrollRecords
        .filter(record => record.estado_pago === 'Pendiente')
        .forEach(record => {
          if (record.id) {
            this.selectedPayrollIds.add(record.id);
          }
        });
    } else {
      this.selectedPayrollIds.clear();
    }
  }

  toggleSelection(payrollId: string) {
    if (this.selectedPayrollIds.has(payrollId)) {
      this.selectedPayrollIds.delete(payrollId);
    } else {
      this.selectedPayrollIds.add(payrollId);
    }

    // Update selectAll checkbox state
    const pendingRecords = this.payrollRecords.filter(r => r.estado_pago === 'Pendiente');
    this.selectAll = pendingRecords.length > 0 &&
      pendingRecords.every(r => r.id && this.selectedPayrollIds.has(r.id));
  }

  isSelected(payrollId: string): boolean {
    return this.selectedPayrollIds.has(payrollId);
  }

  // Payment methods
  openPaymentModal(payrollId?: string) {
    if (payrollId) {
      this.selectedPayrollForPayment = [payrollId];
    } else {
      this.selectedPayrollForPayment = Array.from(this.selectedPayrollIds);
    }

    if (this.selectedPayrollForPayment.length === 0) {
      this.notificationService.showWarning('Advertencia', 'Por favor seleccione al menos un registro');
      return;
    }

    this.paymentMethod = '';
    this.setDefaultPaymentDate();
    this.showPaymentModal = true;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.paymentMethod = '';
    this.selectedPayrollForPayment = [];
  }

  confirmPayment() {
    if (!this.paymentMethod) {
      this.notificationService.showError('Error', 'Por favor seleccione un método de pago');
      return;
    }

    if (!this.paymentDate) {
      this.notificationService.showError('Error', 'Por favor seleccione una fecha de pago');
      return;
    }

    const totalAmount = this.getTotalPaymentAmount();
    const recordCount = this.selectedPayrollForPayment.length;

    this.confirmationService.showConfirmation(
      {
        title: 'Confirmar Pago',
        message: `¿Está seguro de procesar ${recordCount} pago(s) por un total de ${this.formatCurrency(totalAmount)}?`,
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        type: 'warning'
      },
      () => this.processPayment()
    );
  }

  processPayment() {
    this.isProcessingPayment = true;

    const updateData: Partial<TeacherPayroll> = {
      estado_pago: 'Pagado',
      metodo_pago: this.paymentMethod,
      fecha_pago: this.paymentDate
    };

    if (this.selectedPayrollForPayment.length === 1) {
      // Single payment
      this.payrollService.updatePayrollStatus(this.selectedPayrollForPayment[0], updateData).subscribe({
        next: (response) => {
          this.isProcessingPayment = false;
          this.closePaymentModal();
          this.notificationService.showSuccess('Éxito', 'Pago procesado exitosamente');
          this.loadPayrollRecords();
        },
        error: (error) => {
          this.isProcessingPayment = false;
          console.error('Error processing payment:', error);
          this.notificationService.showError('Error', 'No se pudo procesar el pago');
        }
      });
    } else {
      // Batch payment
      this.payrollService.updateMultiplePayrollStatus(this.selectedPayrollForPayment, updateData).subscribe({
        next: (response) => {
          this.isProcessingPayment = false;
          this.closePaymentModal();
          this.notificationService.showSuccess('Éxito', `${this.selectedPayrollForPayment.length} pagos procesados exitosamente`);
          this.loadPayrollRecords();
        },
        error: (error) => {
          this.isProcessingPayment = false;
          console.error('Error processing batch payment:', error);
          this.notificationService.showError('Error', 'No se pudieron procesar todos los pagos');
        }
      });
    }
  }

  getTotalPaymentAmount(): number {
    return this.payrollRecords
      .filter(record => record.id && this.selectedPayrollForPayment.includes(record.id))
      .reduce((sum, record) => {
        const total = typeof record.valor_total === 'string' ? parseFloat(record.valor_total) : record.valor_total;
        return sum + (total || 0);
      }, 0);
  }

  // Helper methods
  getTeacherName(record: TeacherPayroll): string {
    if (record.teacher_id && typeof record.teacher_id === 'object') {
      const teacher = record.teacher_id as any;
      return `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
    }
    return 'N/A';
  }

  formatCurrency(value: number): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numValue || 0);
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed

    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getEstadoBadgeClass(estado: string): string {
    return estado === 'Pagado'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
}
