import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormBuilder, FormsModule} from '@angular/forms';
import {PaymentService} from '../../../../core/services/payment.service';
import {PaymentRecord} from '../../../../core/models/AccountReceivable';
import { Router } from '@angular/router';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.html'
})
export class Payments implements OnInit {
  payments: PaymentRecord[] = [];
  filteredPayments: Payment[] = [];
  searchTerm: string = '';
  isLoading: boolean = false;

  constructor(private paymentService: PaymentService, private router: Router) {
  }


  ngOnInit() {
    this.getPayments();
  }

  getPayments = () => {
    this.paymentService.getPayments().subscribe(data => {
      this.payments = data.data;
    })
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  getStatusColor(estado: string): string {
    switch (estado.toUpperCase()) {
      case 'PAGADO':
        return 'text-green-600 bg-green-100';
      case 'PENDIENTE':
        return 'text-orange-600 bg-orange-100';
      case 'RECHAZADO':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  viewPaymentDetail(payment: PaymentRecord) {
    this.router.navigate(['/private/payment-detail'], {
      state: { payment: payment }
    });
  }
}
