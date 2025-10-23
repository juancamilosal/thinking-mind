import {Component, OnInit, ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {AccountReceivableFormComponent} from './account-recevable-form/account-receivable-form';
import {AccountReceivableDetailComponent} from './accout-receivable-detail/account-receivable-detail';
import {AccountReceivable, TotalAccounts} from '../../../../core/models/AccountReceivable';
import {AccountReceivableService} from '../../../../core/services/account-receivable.service';

@Component({
  selector: 'app-accounts-receivable',
  imports: [CommonModule, FormsModule, AccountReceivableFormComponent, AccountReceivableDetailComponent],
  templateUrl: './accounts-receivable.html',
  standalone: true
})
export class AccountsReceivable implements OnInit {
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
    private route: ActivatedRoute
  ) {
  }

  ngOnInit(): void {
    // Obtener información del usuario desde sessionStorage
    const userData = sessionStorage.getItem('current_user');
    if (userData) {
      const user = JSON.parse(userData);
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
    
    this.totalAccounts();
    
    // Check for cuentaCobrarId query parameter
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
      limit: this.itemsPerPage
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
        
        // Si hay filtros aplicados y no hay resultados, mostrar 0
        // Si hay filtros aplicados y hay resultados, usar filter_count
        // Si no hay filtros aplicados, usar total_count
        if (this.hasActiveFilters()) {
          // Cuando hay filtros aplicados, usar filter_count o el length de los datos
          this.totalItems = response.meta?.filter_count || this.accounts.length;
        } else {
          // Cuando no hay filtros, usar total_count
          this.totalItems = response.meta?.total_count || 0;
        }
        
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
        this.totalItems = response.meta?.filter_count || this.accounts.length;
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
            this.loadRectorAccounts();
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
  // Método para limpiar filtros
  clearFilters(): void {
    this.filters = {
      colegio: '',
      fechaFinalizacion: '',
      estado: ''
    };
    this.searchTerm = '';
    this.currentPage = 1;
    
    // Si es rector, usar su método específico
    if (this.isRector && this.userColegioId) {
      this.loadRectorAccounts();
    } else {
      this.applyFilters();
    }
  }

  // Método para obtener la clase CSS del estado
  getEstadoClass(estado: string): string {
    switch (estado?.toUpperCase()) {
      case 'PENDIENTE':
        return 'bg-yellow-100 text-yellow-800';
      case 'PAGADA':
        return 'bg-green-100 text-green-800';
      case 'DEVOLUCION':
        return 'bg-purple-100 text-purple-800';
      case 'SALDO_0':
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

  // Métodos de paginación
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      // Siempre usar applyFilters para mantener consistencia en la paginación
      this.applyFilters();
    }
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value, 10);
    this.currentPage = 1; // Reset to first page when changing items per page
    
    // Si es rector, usar su método específico
    if (this.isRector && this.userColegioId) {
      this.loadRectorAccounts();
    } else {
      this.applyFilters();
    }
  }

  // Método para verificar si hay filtros activos (incluyendo búsqueda)
  // Nota: El filtro de estado vacío significa "Todos los estados" y NO cuenta como filtro activo
  private hasActiveFilters(): boolean {
    return !!(this.filters.colegio.trim() || this.filters.fechaFinalizacion || this.filters.estado.trim() || this.searchTerm.trim());
  }

  loadAccountsPage(): void {
    this.isLoading = true;
    const serviceCall = this.searchTerm.trim() 
      ? this.accountService.getAllAccountsReceivable(this.currentPage, this.itemsPerPage, this.searchTerm.trim())
      : this.accountService.getAllAccountsReceivable(this.currentPage, this.itemsPerPage);

    serviceCall.subscribe({
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

  private filterAccountsByStatus(): void {
    this.pendingAccounts = this.allAccounts.filter(account => account.estado === 'pending');
    this.paidAccounts = this.allAccounts.filter(account => account.estado === 'paid');
    this.refundAccounts = this.allAccounts.filter(account => account.estado === 'refund');
    this.zeroBalanceAccounts = this.allAccounts.filter(account => account.saldo === 0);
    
    // Actualizar las cuentas mostradas según la pestaña activa
    this.updateAccountsForActiveTab();
  }

  private loadAccountsByTab(tab: 'pending' | 'paid' | 'refund' | 'zero'): void {
    // Cargar cuentas filtradas por estado desde el servidor
    this.loadAccountsByStatus(tab);
  }

  setActiveTab(tab: 'pending' | 'paid' | 'refund' | 'zero') {
    this.activeTab = tab;
    this.currentPage = 1; // Resetear a la primera página
    this.loadAccountsByTab(tab);
  }

  totalAccounts = (): void => {
    this.isLoadingTotals = true;
    
    // Si es rector, filtrar totales por su colegio
    if (this.isRector && this.userColegioId) {
      this.accountService.totalAccounts(this.userColegioId).subscribe({
        next: (data) => {
          this.total = data.data;
          this.isLoadingTotals = false;
        },
        error: (error) => {
          console.error('Error al cargar totales:', error);
          this.isLoadingTotals = false;
        }
      });
    } else {
      this.accountService.totalAccounts().subscribe({
        next: (data) => {
          this.total = data.data;
          this.isLoadingTotals = false;
        },
        error: (error) => {
          console.error('Error al cargar totales:', error);
          this.isLoadingTotals = false;
        }
      });
    }
  }

  private updateAccountsForActiveTab(): void {
    let base: AccountReceivable[] = [];
    switch (this.activeTab) {
      case 'pending':
        base = this.pendingAccounts;
        break;
      case 'paid':
        base = this.paidAccounts;
        break;
      case 'refund':
        base = this.refundAccounts;
        break;
      case 'zero':
        base = this.zeroBalanceAccounts;
        break;
    }
    const term = this.searchTerm?.trim().toLowerCase();
    if (term) {
      // Ignorar pestaña activa: buscar en todos los estados
      const searchBase = this.allAccounts || [];
      this.accounts = searchBase.filter(acc => this.matchesSearch(acc, term));
    } else {
      this.accounts = base;
    }
  }

  openForm() {
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
  }

  getFilteredAccounts(): AccountReceivable[] {
    switch (this.activeTab) {
      case 'pending':
        return this.pendingAccounts;
      case 'paid':
        return this.paidAccounts;
      case 'refund':
        return this.refundAccounts;
      case 'zero':
        return this.zeroBalanceAccounts;
      default:
        return this.pendingAccounts;
    }
  }

  onAccountCreated(newAccount: AccountReceivable): void {
    // Agregar la nueva cuenta a la lista principal
    this.allAccounts.unshift(newAccount);
    
    // Refiltrar todas las cuentas
    this.filterAccountsByStatus();
    this.updatePagination();
    
    this.showForm = false;
    this.totalAccounts();
  }

  private loadAccountsByStatus(status: 'pending' | 'paid' | 'refund' | 'zero'): void {
    this.isLoading = true;
    
    // Si es rector, incluir su colegioId en la búsqueda
    const colegioId = this.isRector && this.userColegioId ? this.userColegioId : undefined;
    
    this.accountService.searchAccountReceivableByStatusWithPagination(
      status,
      this.currentPage,
      this.itemsPerPage,
      this.searchTerm || undefined,
      colegioId
    ).subscribe({
      next: (response) => {
        this.accounts = response.data;
        this.totalItems = response.meta?.filter_count || 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading accounts by status:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onSearchChange(term: string) {
    this.searchTerm = term;
    this.currentPage = 1; // Resetear a la primera página cuando se busca
    // Si hay filtros aplicados o término de búsqueda, usar applyFilters
    if (this.hasActiveFilters()) {
      this.applyFilters();
    } else {
      this.loadAllAccounts();
    }
  }

  onSearch(): void {
    this.currentPage = 1; // Resetear a la primera página
    
    // Si es rector, usar su método específico
    if (this.isRector && this.userColegioId) {
      this.loadRectorAccounts();
    } else {
      // Siempre usar applyFilters para mantener consistencia
      this.applyFilters();
    }
  }

  private fetchServerSearchByStatus(): void {
    this.isLoading = true;
    this.accountService.searchAccountReceivableByStatusWithPagination(
      this.activeTab,
      1,
      10,
      this.searchTerm || undefined
    ).subscribe({
      next: (response) => {
        this.accounts = response.data;
        this.totalItems = response.meta?.filter_count || 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.currentPage = 1;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error searching accounts by status:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getTotalPending(): number {
    // Sumar cuentas pendientes + cuentas con devolución (ya que las devoluciones se suman al pendiente)
    const pendingTotal = this.pendingAccounts.reduce((total, account) => total + (account.saldo || 0), 0);
    const refundTotal = this.refundAccounts.reduce((total, account) => total + (account.saldo || 0), 0);
    return pendingTotal + refundTotal;
  }

  getTotalOverdue(): number {
    const today = new Date().toISOString().split('T')[0];
    
    // Incluir cuentas pendientes vencidas
    const pendingOverdue = this.pendingAccounts
      .filter(account => account.fecha_finalizacion && account.fecha_finalizacion < today)
      .reduce((total, account) => total + (account.saldo || 0), 0);
    
    // Incluir cuentas con devolución vencidas (también forman parte del pendiente)
    const refundOverdue = this.refundAccounts
      .filter(account => account.fecha_finalizacion && account.fecha_finalizacion < today)
      .reduce((total, account) => total + (account.saldo || 0), 0);
    
    return pendingOverdue + refundOverdue;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  private fetchServerSearch(): void {
    this.isLoading = true;
    this.accountService.getAllAccountsReceivable(1, 10, this.searchTerm).subscribe({
      next: (response) => {
        // Reemplazar allAccounts con resultados del servidor para reflejar búsqueda
        this.allAccounts = response.data || [];
        this.filterAccountsByStatus();
        this.isLoading = false;
        this.updatePagination();
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  markAsPaid(accountId: string): void {
    if (confirm('¿Está seguro de que desea marcar esta cuenta como pagada?')) {
      const updateData = { estado: 'PAGADA', saldo: 0 };
      this.accountService.updateAccountReceivable(accountId, updateData).subscribe({
        next: (response) => {
          // Actualizar la cuenta en la lista principal
          const index = this.allAccounts.findIndex(account => account.id === accountId);
          if (index !== -1) {
            this.allAccounts[index] = { ...this.allAccounts[index], ...updateData };
          }
          
          // Refiltrar todas las cuentas
          this.filterAccountsByStatus();
          this.updatePagination();
          this.totalAccounts();
        },
        error: (error) => {
          console.error('Error al marcar como pagada:', error);
        }
      });
    }
  }

  deleteAccount(accountId: string): void {
    if (confirm('¿Está seguro de que desea eliminar esta cuenta por cobrar?')) {
      this.accountService.deleteAccountReceivable(accountId).subscribe({
        next: () => {
          // Eliminar la cuenta de la lista principal
          this.allAccounts = this.allAccounts.filter(account => account.id !== accountId);
          
          // Refiltrar todas las cuentas
          this.filterAccountsByStatus();
          this.updatePagination();
          this.totalAccounts();
          
          // Si la cuenta eliminada era la seleccionada, cerrar el detalle
          if (this.selectedAccount && this.selectedAccount.id === accountId) {
            this.backToList();
          }
        },
        error: (error) => {
          console.error('Error al eliminar la cuenta:', error);
        }
      });
    }
  }

  viewDetail(account: AccountReceivable) {
    this.selectedAccount = account;
    this.showDetail = true;
    this.cdr.detectChanges();
  }

  backToList() {
    this.showDetail = false;
    this.selectedAccount = null;
    // Mantener los filtros aplicados al regresar
    this.applyFilters();
    this.totalAccounts();
    this.cdr.detectChanges();
  }

  refreshAccountDetail(updatedAccount?: AccountReceivable) {
    if (updatedAccount) {
      // Actualizar la cuenta en la lista principal
      const index = this.allAccounts.findIndex(account => account.id === updatedAccount.id);
      if (index !== -1) {
        this.allAccounts[index] = updatedAccount;
      }
      
      // Refiltrar todas las cuentas
      this.filterAccountsByStatus();
      this.updatePagination();
      
      // Actualizar la cuenta seleccionada si coincide
      if (this.selectedAccount && this.selectedAccount.id === updatedAccount.id) {
        this.selectedAccount = updatedAccount;
      }
      
      this.cdr.detectChanges();
    } else {
      // Mantener la pestaña activa al refrescar
      this.loadAccountsByStatus(this.activeTab);
      setTimeout(() => {
        if (this.selectedAccount) {
          const updatedAccount = [...this.pendingAccounts, ...this.paidAccounts]
            .find(account => account.id === this.selectedAccount!.id);

          if (updatedAccount) {
            this.selectedAccount = updatedAccount;
            this.cdr.detectChanges();
          }
        }
      }, 100);
    }
  }
  
  // Pagination methods
  updatePagination() {
    this.totalPages = Math.ceil(this.accounts.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    this.updatePaginatedAccounts();
  }
  
  updatePaginatedAccounts() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    // Fixed: Changed paginatedAccounts to accounts since we're using server-side pagination
    // this.paginatedAccounts = this.accounts.slice(startIndex, endIndex);
  }
  
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      
      // Si es rector, usar su método específico
      if (this.isRector && this.userColegioId) {
        this.loadRectorAccounts();
      } else {
        this.applyFilters();
      }
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadAccountsByStatus(this.activeTab);
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadAccountsByStatus(this.activeTab);
    }
  }

  private matchesSearch(account: AccountReceivable, term: string): boolean {
    const t = term || '';
    const clientName = (account.clientName || '').toLowerCase();
    const studentName = (account.studentName || '').toLowerCase();

    let clientDoc = '';
    let clientNombre = '';
    let clientApellido = '';
    let studentNombre = '';
    let studentApellido = '';

    const clienteObj: any = account.cliente_id as any;
    if (clienteObj && typeof clienteObj === 'object') {
      clientDoc = (clienteObj.numero_documento || '').toLowerCase();
      clientNombre = (clienteObj.nombre || '').toLowerCase();
      clientApellido = (clienteObj.apellido || '').toLowerCase();
    }

    const estudianteObj: any = account.estudiante_id as any;
    if (estudianteObj && typeof estudianteObj === 'object') {
      studentNombre = (estudianteObj.nombre || '').toLowerCase();
      studentApellido = (estudianteObj.apellido || '').toLowerCase();
    }

    return (
      clientName.includes(t) ||
      studentName.includes(t) ||
      clientDoc.includes(t) ||
      clientNombre.includes(t) ||
      clientApellido.includes(t) ||
      studentNombre.includes(t) ||
      studentApellido.includes(t)
    );
  }

  private loadAndShowAccountDetail(accountId: string) {
    this.accountService.getAccountById(accountId).subscribe({
      next: (response) => {
        if (response.data) {
          this.selectedAccount = response.data;
          this.showDetail = true;
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error loading account details:', error);
      }
    });
  }
}
