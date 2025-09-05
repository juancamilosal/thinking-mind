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
  activeTab: 'pending' | 'paid' = 'pending';
  accounts: AccountReceivable[] = [];
  isLoading = false;
  isLoadingTotals = false;
  pendingAccounts: AccountReceivable[] = [];
  paidAccounts: AccountReceivable[] = [];
  total: TotalAccounts;

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
    this.isLoading = true;
    this.accountService.searchAccountReceivable().subscribe({
      next: (response) => {
        if (response.data) {
          this.pendingAccounts = response.data.filter(account =>
            account.estado === 'PENDIENTE' || account.estado === 'pendiente'
          );
          this.paidAccounts = response.data.filter(account =>
            account.estado === 'PAGADO' || account.estado === 'pagado' || account.estado === 'PAGADA'
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
    return this.activeTab === 'pending' ? this.pendingAccounts : this.paidAccounts;
  }

  onAccountCreated(account: AccountReceivable) {
    this.loadAccounts();
    this.totalAccounts();
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

  markAsPaid(accountId: string) {
    const accountIndex = this.pendingAccounts.findIndex(acc => acc.id === accountId);
    if (accountIndex !== -1) {
      const account = this.pendingAccounts[accountIndex];
      account.estado = 'PAGADA';
      account.saldo = 0;
      this.paidAccounts.push(account);
      this.pendingAccounts.splice(accountIndex, 1);
      this.updateAccounts();
    }
    this.loadAccounts();
    this.totalAccounts();
  }

  deleteAccount(accountId: string) {
    if (this.activeTab === 'pending') {
      this.pendingAccounts = this.pendingAccounts.filter(acc => acc.id !== accountId);
    } else {
      this.paidAccounts = this.paidAccounts.filter(acc => acc.id !== accountId);
    }
    this.updateAccounts();
    this.loadAccounts();
    this.totalAccounts(); // ← Y aquí
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

  refreshAccountDetail() {
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
