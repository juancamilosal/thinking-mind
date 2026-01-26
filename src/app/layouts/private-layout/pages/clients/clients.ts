import {AfterViewInit, Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators, ReactiveFormsModule} from '@angular/forms';

import {ClientService} from '../../../../core/services/client.service';
import {Client} from '../../../../core/models/Clients';
import {FormClient} from './form-client/form-client';
import {ClientDetail} from './client-detail/client-detail';
import {NotificationService} from '../../../../core/services/notification.service';
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [ReactiveFormsModule, FormClient, ClientDetail, AppButtonComponent],
  templateUrl: './clients.html'
})
export class Clients implements OnInit {
  showForm = false;
  showDetail = false;
  editMode = false;
  selectedClient: Client | null = null;
  clients: Client[] = [];
  isLoading = false;
  searchTerm = '';
  private searchTimeout: any;
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 15, 20, 50];
  Math = Math; // Para usar Math.min en el template
  
  constructor(
    private fb: FormBuilder, 
    private clientServices: ClientService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadClientsPage();
  }

  // Métodos de paginación
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadClientsPage();
    }
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    this.loadClientsPage();
  }

  loadClientsPage(): void {
    this.isLoading = true;
    const searchMethod = this.searchTerm.trim() ? 
      this.clientServices.searchClient(this.searchTerm, this.currentPage, this.itemsPerPage) :
      this.clientServices.getAllClients(this.currentPage, this.itemsPerPage);
    
    searchMethod.subscribe({
      next: (response) => {
        this.clients = response.data;
        this.totalItems = response.meta?.filter_count || response.data.length;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar los clientes:', error);
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

  searchClient() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadClientsPage();
    }, 300);
  }

  onSearch() {
    this.searchClient();
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    this.searchClient();
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.editMode = false;
    this.selectedClient = null;
  }

  viewClient(client: Client) {
    this.selectedClient = client;
    this.showDetail = true;
  }

  editClient(client: Client) {
    this.selectedClient = client;
    this.editMode = true;
    this.showForm = true;
    this.showDetail = false;
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedClient = null;
  }

  onClientUpdated() {
    this.loadClientsPage();
    this.toggleForm();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

}
