import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  payments: Payment[] = [];
  filteredPayments: Payment[] = [];
  searchTerm: string = '';
  isLoading: boolean = false;

  ngOnInit() {
    this.loadPayments();
  }

  loadPayments() {
    this.isLoading = true;
    // Simular carga de datos - aquí irían los datos reales
    setTimeout(() => {
      this.payments = [];
      this.filteredPayments = this.payments;
      this.isLoading = false;
    }, 1000);
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
      this.filteredPayments = this.payments;
      return;
    }

    this.filteredPayments = this.payments.filter(payment =>
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
    switch (estado) {
      case 'Completado':
        return 'text-green-600 bg-green-100';
      case 'Pendiente':
        return 'text-yellow-600 bg-yellow-100';
      case 'Cancelado':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }
}