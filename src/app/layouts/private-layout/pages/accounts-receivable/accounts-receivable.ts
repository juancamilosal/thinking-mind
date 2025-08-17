import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountReceivableFormComponent } from './account-receivable-form';
import { AccountReceivableDetailComponent } from './account-receivable-detail';
import {AccountReceivable} from '../../../../core/models/AccountReceivable';

@Component({
  selector: 'app-accounts-receivable',
  imports: [CommonModule, AccountReceivableFormComponent, AccountReceivableDetailComponent],
  templateUrl: './accounts-receivable.html',
  standalone: true
})
export class AccountsReceivable {
  showForm = false;
  showDetail = false;
  selectedAccount: AccountReceivable | null = null;
  activeTab: 'pending' | 'paid' = 'pending';
  accounts: AccountReceivable[] = [];

  // Datos de ejemplo
  pendingAccounts: AccountReceivable[] = [
    {
      id: 'AR-001',
      clientName: 'María García',
      clientEmail: 'maria@email.com',
      clientPhone: '3001234567',
      studentName: 'Luis Pérez',
      amount: 850000,
      description: 'Curso de Inglés Avanzado',
      dueDate: '2024-02-15',
      invoiceNumber: 'FAC-001',
      status: 'pending',
      createdDate: '2024-01-15'
    },
    {
      id: 'AR-002',
      clientName: 'Carlos López',
      clientEmail: 'carlos@email.com',
      clientPhone: '3009876543',
      studentName: 'Mariana Torres',
      amount: 750000,
      description: 'Curso de Matemáticas',
      dueDate: '2024-02-20',
      invoiceNumber: 'FAC-002',
      status: 'pending',
      createdDate: '2024-01-20'
    }
  ];

  paidAccounts: AccountReceivable[] = [
    {
      id: 'AR-003',
      clientName: 'Ana Rodríguez',
      clientEmail: 'ana@email.com',
      clientPhone: '3005555555',
      studentName: 'Juan Martínez',
      amount: 300000,
      description: 'Curso de Ciencias',
      dueDate: '2024-01-30',
      invoiceNumber: 'FAC-003',
      status: 'paid',
      createdDate: '2024-01-10'
    }
  ];

  constructor() {
    this.updateAccounts();
  }

  openForm() {
    console.log('openForm() ejecutado');
    this.showForm = true;
    console.log('showForm:', this.showForm);
  }

  closeForm() {
    this.showForm = false;
  }

  // Método que faltaba - requerido por el template
  getFilteredAccounts(): AccountReceivable[] {
    return this.activeTab === 'pending' ? this.pendingAccounts : this.paidAccounts;
  }

  // Método que faltaba - requerido por el template
  onAccountCreated(account: AccountReceivable) {
    // Generar un ID único
    account.id = 'AR-' + (Date.now().toString().slice(-3)).padStart(3, '0');
    account.status = 'pending';
    account.createdDate = new Date().toISOString().split('T')[0];
    
    this.pendingAccounts.push(account);
    this.updateAccounts();
    this.closeForm();
  }

  onFormSubmit(account: AccountReceivable) {
    this.pendingAccounts.push(account);
    this.updateAccounts();
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
    return this.pendingAccounts.reduce((total, account) => total + account.amount, 0);
  }

  getTotalOverdue(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.pendingAccounts
      .filter(account => account.dueDate < today)
      .reduce((total, account) => total + account.amount, 0);
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
      account.status = 'paid';
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
}
