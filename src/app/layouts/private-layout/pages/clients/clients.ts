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
  
  constructor(
    private fb: FormBuilder, 
    private clientServices: ClientService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.searchClient();
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
}
