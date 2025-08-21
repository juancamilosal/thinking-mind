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

  searchClient() {
    this.clientServices.searchClient().subscribe(data => {
      this.clients = data.data;
    });
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
