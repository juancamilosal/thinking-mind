import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../../core/services/payment.service';
import { WompiTariffService, WompiTariff } from '../../../../core/services/wompi-tariff.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ResponseAPI } from '../../../../core/models/ResponseAPI';
import {PaymentModel} from '../../../../core/models/AccountReceivable';
import { PaymentDetailComponent } from '../accounts-receivable/payment-detail/payment-detail';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [FormsModule, PaymentDetailComponent],
  templateUrl: './payments.html',
  styleUrl: './payments.scss'
})
export class Payments implements OnInit, OnDestroy {
  payments: PaymentModel[] = [];
  searchTerm: string = '';
  isLoading: boolean = false;
  selectedPayment: PaymentModel | null = null;
  showPaymentDetail: boolean = false;

  // Propiedades para filtros de fecha
  startDate: string = '';
  endDate: string = '';

  // Propiedades de paginación Directus
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 15, 20, 50];
  Math = Math; // Para usar Math.min en el template



  // Propiedades para las tarifas Wompi
  wompiTariffs: WompiTariff = {
    tarifa: 0,
    comision: 0,
    iva: 0,
    retencion_fuente: 0
  };
  isLoadingTariffs: boolean = false;
  isUpdatingTariffs: boolean = false;
  currentTariffId: number | null = null;
  
  // Propiedad para el acordeón
  isAccordionOpen: boolean = false;

  constructor(
    private paymentService: PaymentService,
    private wompiTariffService: WompiTariffService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadPaymentsPage();
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
            iva: firstTariff.iva,
            retencion_fuente: firstTariff.retencion_fuente
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
      iva: 19,
      retencion_fuente: 1.5
    };

    this.wompiTariffService.createWompiTariff(initialTariff).subscribe({
      next: (response: ResponseAPI<WompiTariff>) => {
        if (response.data) {
          this.wompiTariffs = {
            tarifa: response.data.tarifa,
            comision: response.data.comision,
            iva: response.data.iva,
            retencion_fuente: response.data.retencion_fuente
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
      iva: this.wompiTariffs.iva,
      retencion_fuente: this.wompiTariffs.retencion_fuente
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

  loadPaymentsPage(): void {
    this.isLoading = true;
    this.paymentService.getPayments(
      this.currentPage,
      this.itemsPerPage,
      this.searchTerm.trim() || undefined,
      this.startDate || undefined,
      this.endDate || undefined
    ).subscribe({
      next: (response: ResponseAPI<PaymentModel[]>) => {
        this.payments = response.data || [];
        // Usar filter_count cuando hay filtros aplicados, sino total_count
        this.totalItems = response.meta?.filter_count || response.meta?.total_count || 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
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

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadPaymentsPage();
    }
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    this.loadPaymentsPage();
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
    this.currentPage = 1;
    this.loadPaymentsPage();
  }

  private searchTimeout: any;

  performSearch() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.currentPage = 1;
    this.loadPaymentsPage();
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

  // Métodos para filtros de fecha
  onDateFilterChange(): void {
    this.currentPage = 1;
    this.loadPaymentsPage();
  }

  clearDateFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;
    this.loadPaymentsPage();
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

  // Método para alternar el acordeón
  toggleAccordion(): void {
    this.isAccordionOpen = !this.isAccordionOpen;
  }
}
