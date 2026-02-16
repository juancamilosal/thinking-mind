import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageServices } from '../../../../core/services/storage.services';
import { PayrollService } from '../../../../core/services/payroll.service';
import { TranslateModule } from '@ngx-translate/core';

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
  fecha_clase?: string;
  calificado_a_tiempo?: boolean;
}

@Component({
  selector: 'app-payroll-teacher',
  standalone: true,
  imports: [CommonModule, TranslateModule],
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
    private payrollService: PayrollService
  ) {}

  ngOnInit(): void {
    this.loadPayrollData();
  }

  loadPayrollData(): void {
    this.isLoading = true;
    const currentUser = StorageServices.getCurrentUser();
    const teacherId = currentUser?.id;

    if (!teacherId) {
      this.isLoading = false;
      return;
    }

    // Load summary for current month
    this.payrollService.getTeacherPayrollSummary(teacherId).subscribe({
      next: (summary) => {
        this.payrollSummary = summary;
      },
      error: (error) => {
        console.error('Error loading payroll summary:', error);
        this.payrollSummary = {
          valorPorHora: 0,
          horasTrabajadasMes: 0,
          pagoTotalMes: 0
        };
      }
    });

    // Load payment history
    this.loadPaymentHistory();
  }

  loadPaymentHistory(): void {
    const currentUser = StorageServices.getCurrentUser();
    const teacherId = currentUser?.id;

    if (!teacherId) {
      this.isLoading = false;
      return;
    }

    this.payrollService.getTeacherPayrollHistory(teacherId, this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        this.paymentHistory = response.data.map(record => ({
          id: record.id,
          horasTrabajadas: record.horasTrabajadas,
          valorPorHora: record.valorPorHora,
          fechaPago: record.fechaPago,
          metodoPago: record.metodoPago,
          estado: record.estado,
          fecha_clase: record.fecha_clase,
          calificado_a_tiempo: record.calificado_a_tiempo
        }));
        this.totalItems = response.meta?.filter_count || this.paymentHistory.length;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading payroll history:', error);
        this.paymentHistory = [];
        this.isLoading = false;
      }
    });
  }

  // Pagination methods
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadPaymentHistory();
    }
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    this.loadPaymentHistory();
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatHours(hours: number): string {
    return new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(hours);
  }

  getEstadoBadgeClass(estado: string): string {
    return estado === 'Pagado'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
}
