import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormBuilder, FormsModule} from '@angular/forms';
import {PaymentService} from '../../../../core/services/payment.service';
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
  templateUrl: './payments.html'
})
export class Payments implements OnInit {
  payments: PaymentModel[] = [];
  filteredPayments: Payment[] = [];
  searchTerm: string = '';
  isLoading: boolean = false;

  // Variables para el detalle del pago
  selectedPayment: PaymentModel | null = null;
  showPaymentDetailView = false;

  constructor(private paymentService: PaymentService) {
  }

  ngOnInit() {
    this.getPayments();
  }

  getPayments = () => {
    this.isLoading = true;
    this.paymentService.getPayments().subscribe({
      next: (data) => {
        this.payments = data.data;
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        // Aquí puedes agregar manejo de errores con notificaciones
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  onSearchInputChange(event: any) {
    this.searchTerm = event.target.value;
    this.filterPayments();
  }

  onSearch() {
    this.filterPayments();
  }

  filterPayments() {
    if (!this.searchTerm.trim()) {
      this.payments = this.payments;
      return;
    }

    this.payments = this.payments.filter(payment =>
      payment.pagador.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      payment.estado.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  // Método para mostrar el detalle del pago
  viewPaymentDetail(payment: PaymentModel) {
    this.selectedPayment = payment;
    this.showPaymentDetailView = true;
  }

  // Método para volver al listado de pagos
  backToPaymentHistory() {
    this.showPaymentDetailView = false;
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
}
