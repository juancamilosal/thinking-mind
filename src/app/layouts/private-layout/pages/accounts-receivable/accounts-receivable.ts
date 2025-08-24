import {Component, OnInit, ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
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
  activeTab: 'pending' | 'paid' = 'pending';
  accounts: AccountReceivable[] = [];
  isLoading = false;
  pendingAccounts: AccountReceivable[] = [];
  paidAccounts: AccountReceivable[] = [];
  total: TotalAccounts;

  constructor(
    private accountService: AccountReceivableService,
    private cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit(): void {
    this.loadAccounts();
    this.totalAccounts();
  }

  protected loadAccounts(): void {
    this.isLoading = true;
    this.accountService.searchAccountReceivable().subscribe({
      next: (response) => {
        if (response.data) {
          this.pendingAccounts = response.data.filter(account =>
            account.estado === 'PENDIENTE' || account.estado === 'pendiente'
          );
          this.paidAccounts = response.data.filter(account =>
            account.estado === 'PAGADO' || account.estado === 'pagado'
          );
          this.updateAccounts();
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  totalAccounts = (): void => {
    this.accountService.totalAccounts().subscribe(data => {
      this.total = data.data;
    })
  }

  openForm() {
    console.log('openForm() ejecutado');
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
  }

  getFilteredAccounts(): AccountReceivable[] {
    return this.activeTab === 'pending' ? this.pendingAccounts : this.paidAccounts;
  }

  onAccountCreated(account: AccountReceivable) {
    // Después de crear la cuenta, recargar los datos
    this.loadAccounts();
    this.closeForm();
  }

  setActiveTab(tab: 'pending' | 'paid') {
    this.activeTab = tab;
    this.updateAccounts();
  }

  private updateAccounts() {
    this.accounts = this.activeTab === 'pending' ? this.pendingAccounts : this.paidAccounts;
  }


  getTotalPending(): number {
    return this.pendingAccounts.reduce((total, account) => total + (account.saldo || 0), 0);
  }

  // Mantener esta versión - usa 'fecha_limite' en lugar de 'dueDate' y 'saldo' en lugar de 'amount'
  getTotalOverdue(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.pendingAccounts
      .filter(account => account.fecha_limite < today)
      .reduce((total, account) => total + (account.saldo || 0), 0);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  // Mantener esta versión - usa 'estado' en lugar de 'status' y establece saldo a 0
  markAsPaid(accountId: string) {
    const accountIndex = this.pendingAccounts.findIndex(acc => acc.id === accountId);
    if (accountIndex !== -1) {
      const account = this.pendingAccounts[accountIndex];
      account.estado = 'pagado';
      account.saldo = 0; // Al marcar como pagado, el saldo se vuelve 0
      this.paidAccounts.push(account);
      this.pendingAccounts.splice(accountIndex, 1);
      this.updateAccounts();
    }
  }

  deleteAccount(accountId: string) {
    if (this.activeTab === 'pending') {
      this.pendingAccounts = this.pendingAccounts.filter(acc => acc.id !== accountId);
    } else {
      this.paidAccounts = this.paidAccounts.filter(acc => acc.id !== accountId);
    }
    this.updateAccounts();
  }

  viewDetail(account: AccountReceivable) {
    this.selectedAccount = account;
    this.showDetail = true;
  }

  backToList() {
    this.showDetail = false;
    this.selectedAccount = null;
  }

  // Agregar este método después de loadAccounts()
  refreshAccountDetail() {
    console.log('Refrescando datos del componente padre...');

    // Recargar todos los datos desde el servidor
    this.loadAccounts();

    // Después de cargar, actualizar la cuenta seleccionada
    setTimeout(() => {
      if (this.selectedAccount) {
        const updatedAccount = [...this.pendingAccounts, ...this.paidAccounts]
          .find(account => account.id === this.selectedAccount!.id);

        if (updatedAccount) {
          console.log('Cuenta actualizada encontrada:', updatedAccount);
          this.selectedAccount = updatedAccount;
          this.cdr.detectChanges(); // Forzar detección de cambios
        }
      }
    }, 100); // Pequeño delay para asegurar que los datos se carguen
  }
}
