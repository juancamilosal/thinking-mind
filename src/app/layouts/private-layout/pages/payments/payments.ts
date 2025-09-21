import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../../core/services/payment.service';
import { WompiTariffService, WompiTariff } from '../../../../core/services/wompi-tariff.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ResponseAPI } from '../../../../core/models/ResponseAPI';
import {PaymentModel} from '../../../../core/models/AccountReceivable';
import { PaymentDetailComponent } from '../accounts-receivable/payment-detail/payment-detail';

export interface Payment {
  id: string;
  pagador: string;
  valor: number;
  fechaPago: string;
  estado: 'Completado' | 'Pendiente' | 'Cancelado';
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, PaymentDetailComponent],
  templateUrl: './payments.html',
  styleUrl: './payments.scss'
})
export class Payments implements OnInit, OnDestroy {
  payments: PaymentModel[] = [];
  filteredPayments: PaymentModel[] = [];
  searchTerm: string = '';
  isLoading: boolean = false;
  selectedPayment: PaymentModel | null = null;
  showPaymentDetail: boolean = false;
  
  // Propiedades de paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  paginatedPayments: PaymentModel[] = [];
  itemsPerPageOptions = [5, 10, 15, 20, 50];
  Math = Math; // Para usar Math.min en el template



  // Propiedades para las tarifas Wompi
  wompiTariffs: WompiTariff = {
    tarifa: 0,
    comision: 0,
    iva: 0
  };
  isLoadingTariffs: boolean = false;
  isUpdatingTariffs: boolean = false;
  currentTariffId: number | null = null;

  constructor(
    private paymentService: PaymentService,
    private wompiTariffService: WompiTariffService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadPayments();
    this.loadWompiTariffs();
  }

  loadWompiTariffs(): void {
    this.isLoadingTariffs = true;
    this.wompiTariffService.getWompiTariffs().subscribe({
      next: (response: ResponseAPI<WompiTariff[]>) => {
        if (response.data && response.data.length > 0) {
          // Tomar la primera tarifa encontrada
          const firstTariff = response.data[0];
          this.wompiTariffs = {
            tarifa: firstTariff.tarifa,
            comision: firstTariff.comision,
            iva: firstTariff.iva
          };
          this.currentTariffId = firstTariff.id || null;
        } else {
          // Si no hay tarifas, crear una nueva
          this.createInitialTariff();
        }
        this.isLoadingTariffs = false;
      },
      error: (error) => {
        console.error('Error al cargar las tarifas Wompi:', error);
        this.notificationService.showError('Error al cargar las tarifas de Wompi');
        this.isLoadingTariffs = false;
      }
    });
  }

  createInitialTariff(): void {
    const initialTariff = {
      tarifa: 3.4,
      comision: 900,
      iva: 19
    };

    this.wompiTariffService.createWompiTariff(initialTariff).subscribe({
      next: (response: ResponseAPI<WompiTariff>) => {
        if (response.data) {
          this.wompiTariffs = {
            tarifa: response.data.tarifa,
            comision: response.data.comision,
            iva: response.data.iva
          };
          this.currentTariffId = response.data.id || null;
          this.notificationService.showSuccess('Éxito', 'Tarifas iniciales creadas correctamente');
        }
      },
      error: (error) => {
        console.error('Error al crear las tarifas iniciales:', error);
        this.notificationService.showError('Error al crear las tarifas iniciales');
      }
    });
  }

  updateWompiTariffs(): void {
    if (!this.currentTariffId) {
      this.notificationService.showError('No se encontró el ID de la tarifa para actualizar');
      return;
    }

    this.isUpdatingTariffs = true;

    const updatedTariff = {
      tarifa: this.wompiTariffs.tarifa,
      comision: this.wompiTariffs.comision,
      iva: this.wompiTariffs.iva
    };

    this.wompiTariffService.updateWompiTariff(this.currentTariffId, updatedTariff).subscribe({
      next: (response: ResponseAPI<WompiTariff>) => {
        this.notificationService.showSuccess('Éxito', 'Tarifas de Wompi actualizadas correctamente');
        this.isUpdatingTariffs = false;
      },
      error: (error) => {
        console.error('Error al actualizar las tarifas Wompi:', error);
        this.notificationService.showError('Error al actualizar las tarifas de Wompi');
        this.isUpdatingTariffs = false;
      }
    });
  }

  loadPayments(searchTerm?: string): void {
    this.isLoading = true;
    this.paymentService.getPayments(searchTerm).subscribe({
      next: (response: ResponseAPI<PaymentModel[]>) => {
        this.payments = response.data || [];
        this.filteredPayments = [...this.payments];
        this.totalItems = this.filteredPayments.length;
        this.updatePagination();
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.notificationService.showError('Error al cargar los pagos');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  onSearchInputChange(event: any) {
    this.searchTerm = event.target.value;
    // Realizar búsqueda en tiempo real con debounce
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.performSearch();
    }, 500); // Esperar 500ms después de que el usuario deje de escribir
  }

  onSearch() {
    this.performSearch();
  }

  private searchTimeout: any;

  performSearch() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.loadPayments(this.searchTerm.trim() || undefined);
  }

  filterPayments() {
    // Este método ya no es necesario ya que la búsqueda se hace en el servidor
    // Mantenemos la funcionalidad local como respaldo
    if (!this.searchTerm.trim()) {
      this.filteredPayments = [...this.payments];
      this.totalItems = this.filteredPayments.length;
      this.currentPage = 1;
      this.updatePagination();
      return;
    }

    this.filteredPayments = this.payments.filter(payment =>
      payment.pagador?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      payment.numero_transaccion?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      payment.estado?.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
    this.totalItems = this.filteredPayments.length;
    this.currentPage = 1;
    this.updatePagination();
  }

  // Método para mostrar el detalle del pago
  viewPaymentDetail(payment: PaymentModel) {
    this.selectedPayment = payment;
    this.showPaymentDetail = true;
  }

  // Método para volver al listado de pagos
  backToPaymentHistory() {
    this.showPaymentDetail = false;
    this.selectedPayment = null;
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
    }); // Esto devuelve DD/MM/YYYY
  }

  getStatusColor(estado: string): string {
    switch (estado) {
      case 'PAGADO':
      case 'Completado':
        return 'bg-green-100 text-green-800';
      case 'PENDIENTE':
      case 'Pendiente':
        return 'bg-orange-100 text-orange-800';
      case 'RECHAZADA':
      case 'RECHAZADO':
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  // Métodos de paginación
  updatePagination(): void {
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    this.updatePaginatedPayments();
  }

  updatePaginatedPayments(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedPayments = this.filteredPayments.slice(startIndex, endIndex);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.updatePaginatedPayments();
    }
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    this.updatePagination();
  }

  getPaginationArray(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
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

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
}
