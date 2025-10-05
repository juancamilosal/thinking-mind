import {Component, OnInit, ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {AccountReceivableFormComponent} from './account-recevable-form/account-receivable-form';
import {AccountReceivableDetailComponent} from './accout-receivable-detail/account-receivable-detail';
import {AccountReceivable, TotalAccounts} from '../../../../core/models/AccountReceivable';
import {AccountReceivableService} from '../../../../core/services/account-receivable.service';

@Component({
  selector: 'app-accounts-receivable',
  imports: [CommonModule, AccountReceivableFormComponent, AccountReceivableDetailComponent],
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
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 25, 50];
  paginatedAccounts: AccountReceivable[] = [];

  constructor(
    private accountService: AccountReceivableService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {
  }

  ngOnInit(): void {
    this.loadAccounts();
    this.totalAccounts();
    
    // Check for cuentaCobrarId query parameter
    this.route.queryParams.subscribe(params => {
      const cuentaCobrarId = params['cuentaCobrarId'];
      if (cuentaCobrarId) {
        this.loadAndShowAccountDetail(cuentaCobrarId);
      }
    });
  }

  protected loadAccounts(): void {
    // Cargar todas las cuentas de una sola vez sin filtro de fecha
    this.isLoading = true;
    this.accountService.getAllAccountsReceivable().subscribe({
      next: (response) => {
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

  private filterAccountsByStatus(): void {
    // Filtrar todas las cuentas por estado en el frontend
    this.pendingAccounts = this.allAccounts.filter(account => account.estado === 'PENDIENTE');
    this.paidAccounts = this.allAccounts.filter(account => account.estado === 'PAGADA');
    this.refundAccounts = this.allAccounts.filter(account => account.estado === 'DEVOLUCION');
    this.zeroBalanceAccounts = this.allAccounts.filter(account => (account.saldo || 0) === 0);
    
    // Actualizar las cuentas mostradas según la pestaña activa
    this.updateAccountsForActiveTab();
  }

  private loadAccountsByTab(tab: 'pending' | 'paid' | 'refund' | 'zero'): void {
    // Si ya tenemos todas las cuentas cargadas, solo filtrar
    if (this.allAccounts.length > 0) {
      this.updateAccountsForActiveTab();
      this.updatePagination();
    } else {
      // Si no tenemos las cuentas cargadas, cargarlas primero
      this.loadAccounts();
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

  totalAccounts = (): void => {
    this.isLoadingTotals = true;
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

  setActiveTab(tab: 'pending' | 'paid' | 'refund' | 'zero') {
    this.activeTab = tab;
    this.loadAccountsByTab(tab);
  }

  onSearchChange(term: string) {
    this.searchTerm = term;
    // Búsqueda en Directus al escribir (como schools con debounce opcional)
    this.fetchServerSearch();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.fetchServerSearch();
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
    this.accountService.getAllAccountsReceivable(this.searchTerm).subscribe({
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
  }

  backToList() {
    this.showDetail = false;
    this.selectedAccount = null;
    this.loadAccounts();
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
      this.loadAccounts();
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
    this.paginatedAccounts = this.accounts.slice(startIndex, endIndex);
  }
  
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedAccounts();
    }
  }
  
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedAccounts();
    }
  }
  
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedAccounts();
    }
  }
  
  onItemsPerPageChange(event: any) {
    this.itemsPerPage = parseInt(event.target.value);
    this.currentPage = 1;
    this.updatePagination();
  }
  
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(1, this.currentPage - halfVisible);
      let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
      
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }
  
  // Utility method for Math functions in template
  Math = Math;

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
