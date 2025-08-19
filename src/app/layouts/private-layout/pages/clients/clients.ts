import {AfterViewInit, Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators, ReactiveFormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ClientService} from '../../../../core/services/client.service';
import {Client} from '../../../../core/models/Clients';
import {FormClient} from './form-client/form-client';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormClient],
  templateUrl: './clients.html'
})
export class Clients implements OnInit {
  showForm = false;
  clients: Client[] = [];
  constructor(private fb: FormBuilder, private clientServices: ClientService) {
  }

  ngOnInit(): void {
    this.searchClient();
  }

  toggleForm() {
    this.showForm = !this.showForm;
  }

  searchClient() {
    this.clientServices.searchClient().subscribe(data => {
      this.clients = data.data;
    });
  }
}
