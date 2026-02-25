import {Component, OnInit, ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {AccountReceivableFormComponent} from '../accounts-receivable/account-recevable-form/account-receivable-form';
import {AccountReceivableDetailAyoComponent} from './account-receivable-detail/account-receivable-detail';
import {AccountReceivable, TotalAccounts} from '../../../../core/models/AccountReceivable';
import {AccountReceivableService} from '../../../../core/services/account-receivable.service';
import {ConfirmationService} from '../../../../core/services/confirmation.service';
import {NotificationService} from '../../../../core/services/notification.service';
import { StorageServices } from '../../../../core/services/storage.services';
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';

@Component({
  selector: 'app-accounts-receivable-ayo',
  imports: [CommonModule, FormsModule, AccountReceivableFormComponent, AccountReceivableDetailAyoComponent, AppButtonComponent],
  templateUrl: './accounts-receivable-ayo.html',
  standalone: true
})
export class AccountsReceivableAyo implements OnInit {
  showForm = false;
  showDetail = false;
  selectedAccount: AccountReceivable | null = null;
  activeTab: 'pending' | 'paid' | 'refund' | 'zero' = 'pending';
  accounts: AccountReceivable[] = [];
  isLoading = false;
  isLoadingTotals = false;
  allAccounts: AccountReceivable[] = []; // Todas las cuentas cargadas una sola vez
  pendingAccounts: AccountReceivable[] = [];
  paidAccounts: AccountReceivable[] = [];
  refundAccounts: AccountReceivable[] = [];
  zeroBalanceAccounts: AccountReceivable[] = [];
  total: TotalAccounts;
  // Search
  searchTerm: string = '';

  // User role and colegio info
  userRole: string = '';
  userColegioId: string = '';
  isRector: boolean = false;

  // Filtros
  filters = {
    colegio: '',
    fechaFinalizacion: '',
    estado: ''
  };

  // Pagination properties
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 15, 20, 50];
  Math = Math; // Para usar Math.min en el template

  constructor(
    private accountService: AccountReceivableService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private confirmationService: ConfirmationService,
    private notificationService: NotificationService
  ) {
  }

  ngOnInit(): void {
    // Obtener información del usuario desde StorageServices
    const user = StorageServices.getCurrentUser();
    if (user) {
      this.userRole = user.role;
      this.userColegioId = user.colegio_id;
      this.isRector = user.role === 'a4ed6390-5421-46d1-b81e-5cad06115abc';
    }

    // Si es rector, cargar solo las cuentas de su colegio
    if (this.isRector && this.userColegioId) {
      this.loadRectorAccounts();
    } else {
      // Para otros usuarios, aplicar filtros normales
      this.applyFilters();
    }

    this.route.queryParams.subscribe(params => {
      const cuentaCobrarId = params['cuentaCobrarId'];
      if (cuentaCobrarId) {
        this.loadAndShowAccountDetail(cuentaCobrarId);
      }
    });
  }

  // Método para cargar todas las cuentas
  private loadAllAccounts(): void {
    this.isLoading = true;
    this.accountService.getAllAccountsReceivable(this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        this.accounts = response.data || [];
        this.totalItems = response.meta?.total_count || 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  // Método para manejar cambios en los filtros
  onFilterChange(): void {
    this.currentPage = 1; // Resetear a la primera página cuando se aplican filtros
    this.applyFilters();
  }

  // Método para aplicar filtros
  private applyFilters(): void {
    // Si es rector, usar su método específico
    if (this.isRector && this.userColegioId) {
      this.loadRectorAccounts();
      return;
    }

    this.isLoading = true;

    // Construir parámetros de filtro
    const filterParams: any = {
      page: this.currentPage,
      limit: this.itemsPerPage,
      es_programa_ayo: true // Filtro obligatorio para este componente
    };

    // Incluir el término de búsqueda si existe
    if (this.searchTerm.trim()) {
      filterParams.search = this.searchTerm.trim();
    }

    if (this.filters.colegio.trim()) {
      filterParams.colegio = this.filters.colegio.trim();
    }

    if (this.filters.fechaFinalizacion) {
      filterParams.fecha_finalizacion = this.filters.fechaFinalizacion;
    }

    if (this.filters.estado) {
      filterParams.estado = this.filters.estado;
    }

    // Llamar al servicio con los filtros
    this.accountService.getFilteredAccountsReceivable(filterParams).subscribe({
      next: (response) => {
        this.accounts = response.data || [];

        // Como siempre filtramos por es_programa_ayo, preferimos filter_count
        // Si filter_count viene definido, lo usamos. Si no, usamos total_count.
        this.totalItems = response.meta?.filter_count !== undefined 
          ? response.meta.filter_count 
          : (response.meta?.total_count || 0);

        // Calcular totalPages correctamente
        this.totalPages = this.totalItems > 0 ? Math.ceil(this.totalItems / this.itemsPerPage) : 0;

        // Si no hay resultados, resetear a página 1
        if (this.totalItems === 0) {
          this.currentPage = 1;
        }
        // Si la página actual es mayor que el total de páginas disponibles, ir a la primera página
        else if (this.currentPage > this.totalPages && this.totalPages > 0) {
          this.currentPage = 1;
          // Recargar con la página corregida
          setTimeout(() => {
            this.applyFilters();
          }, 0);
          return;
        }

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  // Método específico para cargar cuentas de rector (similar a list-schools)
  private loadRectorAccounts(): void {
    this.isLoading = true;

    // Usar searchAccountReceivable con el colegioId del rector
    this.accountService.searchAccountReceivable(
      this.currentPage,
      this.itemsPerPage,
      this.searchTerm || undefined,
      this.userColegioId
    ).subscribe({
      next: (response) => {
        this.accounts = response.data || [];
        this.totalItems = response.meta?.total_count || 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  // Método para verificar si hay filtros activos
  hasActiveFilters(): boolean {
    return !!(
      this.searchTerm.trim() ||
      this.filters.colegio.trim() ||
      this.filters.fechaFinalizacion ||
      this.filters.estado
    );
  }

  onSearch(): void {
    this.currentPage = 1; // Resetear a la primera página cuando se busca
    this.applyFilters();
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    if (term === '') {
      this.onSearch();
    }
  }

  onClearFilters(): void {
    this.searchTerm = '';
    this.filters = {
      colegio: '',
      fechaFinalizacion: '',
      estado: ''
    };
    this.currentPage = 1;
    this.applyFilters();
  }

  toggleForm() {
    this.showForm = !this.showForm;
  }

  openForm() {
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
  }

  onAccountCreated(account: AccountReceivable) {
    this.accounts.unshift(account);
    this.showForm = false;
    this.applyFilters(); // Recargar la lista
    
    // Mostrar notificación de éxito
    this.notificationService.showSuccess('Éxito', 'Cuenta por cobrar creada exitosamente');
  }

  loadAndShowAccountDetail(id: string) {
    this.isLoading = true;
    const fields = '*,cliente_id.*,estudiante_id.*,estudiante_id.colegio_id.*,pagos.*,pagos.responsable.*,curso_id.*';
    this.accountService.getAccountById(id, fields).subscribe({
      next: (response) => {
        if (response.data) {
          this.selectedAccount = response.data;
          this.showDetail = true;
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.notificationService.showError('Error', 'Error al cargar los detalles de la cuenta');
      }
    });
  }

  showAccountDetail(account: AccountReceivable) {
    this.selectedAccount = account;
    this.showDetail = true;
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedAccount = null;
    // Remove query param
    this.router.navigate([], {
      queryParams: {
        cuentaCobrarId: null
      },
      queryParamsHandling: 'merge'
    });
    this.applyFilters(); // Recargar para actualizar estados si hubo pagos
  }

  getEstadoClass(status: string): string {
    switch (status) {
      case 'PAGADA':
        return 'bg-green-100 text-green-800';
      case 'PENDIENTE':
        return 'bg-yellow-100 text-yellow-800';
      case 'VENCIDA':
        return 'bg-red-100 text-red-800';
      case 'ANULADA':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  // Método para obtener el texto del estado
  getEstadoText(estado: string): string {
    switch (estado?.toUpperCase()) {
      case 'PENDIENTE':
        return 'Pendiente';
      case 'PAGADA':
        return 'Pagada';
      case 'DEVOLUCION':
        return 'Devolución';
      case 'SALDO_0':
        return 'Saldo 0';
      default:
        return estado || 'N/A';
    }
  }

  // Métodos auxiliares para obtener información de objetos anidados
  getClientDocument(account: AccountReceivable): string {
    if (account.cliente_id && typeof account.cliente_id === 'object') {
      return (account.cliente_id as any).numero_documento || '';
    }
    return '';
  }

  getClientDocumentType(account: AccountReceivable): string {
    if (account.cliente_id && typeof account.cliente_id === 'object') {
      return (account.cliente_id as any).tipo_documento || '';
    }
    return '';
  }

  getStudentLastName(account: AccountReceivable): string {
    if (account.estudiante_id && typeof account.estudiante_id === 'object') {
      return (account.estudiante_id as any).apellido || '';
    }
    return '';
  }

  getStudentDocument(account: AccountReceivable): string {
    if (account.estudiante_id && typeof account.estudiante_id === 'object') {
      return (account.estudiante_id as any).numero_documento || '';
    }
    return '';
  }

  getStudentDocumentType(account: AccountReceivable): string {
    if (account.estudiante_id && typeof account.estudiante_id === 'object') {
      return (account.estudiante_id as any).tipo_documento || '';
    }
    return '';
  }

  viewDetail(account: AccountReceivable) {
    this.selectedAccount = account;
    this.showDetail = true;
  }

  deleteAccount(accountId: string): void {
    // Buscar la cuenta en la lista actual
    const account = this.accounts.find(acc => acc.id === accountId);
    if (!account) {
      this.notificationService.showError('Error', 'No se encontró la cuenta por cobrar.');
      return;
    }

    // Validar saldo
    if ((account.saldo || 0) > 0) {
      this.notificationService.showError('No se puede eliminar', 'No se puede eliminar la cuenta porque tiene saldo pendiente o pagos realizados.');
      return;
    }

    this.confirmationService.showConfirmation(
      {
        title: 'Eliminar cuenta por cobrar',
        message: '¿Estás seguro de que deseas eliminar esta cuenta? Esta acción no se puede deshacer.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      },
      () => {
        this.accountService.deleteAccountReceivable(accountId).subscribe({
          next: () => {
            this.accounts = this.accounts.filter(a => a.id !== accountId);
            this.totalItems--;
            this.notificationService.showSuccess('Cuenta eliminada', 'La cuenta por cobrar ha sido eliminada exitosamente.');
            
            if (this.selectedAccount && this.selectedAccount.id === accountId) {
              this.closeDetail();
            }
          },
          error: (error) => {
            console.error('Error al eliminar:', error);
            this.notificationService.showError('Error', 'No se pudo eliminar la cuenta.');
          }
        });
      }
    );
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  backToList() {
    this.closeDetail();
  }

  refreshAccountDetail() {
    if (this.selectedAccount) {
      this.loadAndShowAccountDetail(this.selectedAccount.id);
    }
  }

  // Pagination methods
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilters();
    }
  }

  onItemsPerPageChange(event: any): void {
    this.itemsPerPage = Number(event.target.value);
    this.currentPage = 1;
    this.applyFilters();
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
}
