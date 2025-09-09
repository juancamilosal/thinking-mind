import {AfterViewInit, Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators, ReactiveFormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ClientService} from '../../../../core/services/client.service';
import {Client} from '../../../../core/models/Clients';
import {FormClient} from './form-client/form-client';
import {ClientDetail} from './client-detail/client-detail';
import {NotificationService} from '../../../../core/services/notification.service';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormClient, ClientDetail],
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
  totalPages = 1;
  paginatedClients: Client[] = [];
  itemsPerPageOptions = [10, 25, 50, 100];
  
  constructor(
    private fb: FormBuilder, 
    private clientServices: ClientService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.searchClient();
  }

  // Pagination methods
  updatePagination(): void {
    this.totalPages = Math.ceil(this.clients.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
    this.updatePaginatedClients();
  }

  updatePaginatedClients(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedClients = this.clients.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedClients();
    }
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    this.updatePagination();
  }

  getPageNumbers(): number[] {
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

  toggleForm() {
    this.showForm = !this.showForm;
    this.editMode = false;
    this.selectedClient = null;
  }

  searchClient(searchTerm?: string) {
    this.isLoading = true;
    this.clientServices.searchClient(searchTerm).subscribe({
      next: (data) => {
        this.clients = data.data;
        this.currentPage = 1;
        this.updatePagination();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading clients:', error);
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.searchClient(this.searchTerm.trim() || undefined);
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    
    // Limpiar timeout anterior
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Establecer nuevo timeout para búsqueda automática
    this.searchTimeout = setTimeout(() => {
      this.searchClient(this.searchTerm.trim() || undefined);
    }, 500); // 500ms de delay
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
    this.searchClient();
    this.toggleForm();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }
  
  // Utility method for Math functions in template
  Math = Math;
}
