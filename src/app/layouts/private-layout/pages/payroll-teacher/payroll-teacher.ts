import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageServices } from '../../../../core/services/storage.services';
import { DashboardService } from '../../../../core/services/dashboard.service';

export interface PayrollSummary {
  valorPorHora: number;
  horasTrabajadasMes: number;
  pagoTotalMes: number;
}

export interface PaymentHistory {
  id: string;
  horasTrabajadas: number;
  valorPorHora: number;
  fechaPago: string;
  metodoPago: string;
  estado: 'Pagado' | 'Pendiente';
}

@Component({
  selector: 'app-payroll-teacher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payroll-teacher.html',
  styleUrl: './payroll-teacher.css'
})
export class PayrollTeacher implements OnInit {
  isLoading: boolean = true;
  currentDate = new Date();

  // Payroll Summary Data
  payrollSummary: PayrollSummary = {
    valorPorHora: 0,
    horasTrabajadasMes: 0,
    pagoTotalMes: 0
  };

  // Payment History Data
  paymentHistory: PaymentHistory[] = [];

  // Pagination properties
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 15, 20];
  Math = Math;

  constructor(
    private dashboardService: DashboardService
  ) {}

  ngOnInit(): void {
    this.loadPayrollData();
  }

  loadPayrollData(): void {
    this.isLoading = true;

    // Mock data for demonstration - Replace with actual API call when backend is ready
    setTimeout(() => {
      // Summary data
      this.payrollSummary = {
        valorPorHora: 50000,
        horasTrabajadasMes: 45,
        pagoTotalMes: 2250000
      };

      // Payment history data
      this.paymentHistory = [
        {
          id: '1',
          horasTrabajadas: 45,
          valorPorHora: 50000,
          fechaPago: '',
          metodoPago: 'TRANSFERENCIA',
          estado: 'Pendiente'
        },
        {
          id: '2',
          horasTrabajadas: 40,
          valorPorHora: 50000,
          fechaPago: '2025-12-25',
          metodoPago: 'TRANSFERENCIA',
          estado: 'Pagado'
        },
        {
          id: '3',
          horasTrabajadas: 42,
          valorPorHora: 50000,
          fechaPago: '2025-11-25',
          metodoPago: 'EFECTIVO',
          estado: 'Pagado'
        },
        {
          id: '4',
          horasTrabajadas: 38,
          valorPorHora: 45000,
          fechaPago: '2025-10-25',
          metodoPago: 'TRANSFERENCIA',
          estado: 'Pagado'
        },
        {
          id: '5',
          horasTrabajadas: 44,
          valorPorHora: 45000,
          fechaPago: '2025-09-25',
          metodoPago: 'TRANSFERENCIA',
          estado: 'Pagado'
        }
      ];

      this.totalItems = this.paymentHistory.length;
      this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
      this.isLoading = false;
    }, 800);

    // TODO: Replace with actual API call
    // this.dashboardService.getTeacherPayroll().subscribe({
    //   next: (response) => {
    //     this.payrollSummary = response.summary;
    //     this.paymentHistory = response.history;
    //     this.totalItems = this.paymentHistory.length;
    //     this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    //     this.isLoading = false;
    //   },
    //   error: (error) => {
    //     console.error('Error loading payroll data:', error);
    //     this.isLoading = false;
    //   }
    // });
  }

  // Pagination methods
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
    }
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
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

  getPaginatedHistory(): PaymentHistory[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.paymentHistory.slice(startIndex, endIndex);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  getEstadoBadgeClass(estado: string): string {
    return estado === 'Pagado'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
}
