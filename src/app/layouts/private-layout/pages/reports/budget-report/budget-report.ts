import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { BudgetService } from '../../../../../core/services/budget.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { Budget, PaymentRecord } from '../../../../../core/models/Budget';

@Component({
  selector: 'app-budget-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './budget-report.html'
})
export class BudgetReport implements OnInit {
  budgetData: Budget | null = null;
  loading: boolean = false;
  anio: number = 0;
  presupuesto: number = 0;
  id: string = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private budgetService: BudgetService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {

    this.route.queryParams.subscribe(params => {
      this.anio = Number(params['anio']);
      this.presupuesto = Number(params['presupuesto']);
      this.id = params['id'];

      if (this.anio && this.presupuesto && this.id) {
        this.loadBudgetReport();
      }
    });
  }

  loadBudgetReport(): void {
    this.loading = true;
    this.budgetService.getBudget(this.anio, this.presupuesto, this.id).subscribe({
      next: (response) => {
        this.budgetData = response.data;
        this.loading = false;
        console.log('Datos del informe:', this.budgetData);
      },
      error: (error) => {
        console.error('Error al cargar el informe:', error);
        this.notificationService.showError('Error', 'No se pudo cargar el informe del presupuesto');
        this.loading = false;
      }
    });
  }

  onRegresar(): void {
    this.router.navigate(['/private/presupuesto']);
  }

  navigateToAccountDetail(cuentaCobrarId: string): void {
    // Navegar a la página de detalles de cuentas por cobrar con el ID específico
    this.router.navigate(['/private/accounts-receivable'], {
      queryParams: { accountId: cuentaCobrarId }
    });
  }

  formatCurrency(amount: number | string): string {
    if (!amount) return '$0';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(numAmount);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'atrasado':
        return 'text-red-600 bg-red-100 px-3 py-1 rounded-full text-sm font-semibold';
      case 'en tiempo':
        return 'text-green-600 bg-green-100 px-3 py-1 rounded-full text-sm font-semibold';
      case 'adelantado':
        return 'text-blue-600 bg-blue-100 px-3 py-1 rounded-full text-sm font-semibold';
      default:
        return 'text-gray-600 bg-gray-100 px-3 py-1 rounded-full text-sm font-semibold';
    }
  }

  getProgressPercentage(): number {
    if (!this.budgetData) return 0;
    const meta = this.budgetData.monto_meta;
    const recaudado = this.budgetData.recaudado;
    return meta > 0 ? (recaudado / meta) * 100 : 0;
  }
}