import { Component, Input, Output, EventEmitter } from '@angular/core';

import { Client } from '../../../../../core/models/Clients';
import { AppButtonComponent } from '../../../../../components/app-button/app-button.component';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [AppButtonComponent],
  templateUrl: './client-detail.html'
})
export class ClientDetail {
  @Input() client: Client | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Client>();

  onClose() {
    this.close.emit();
  }

  onEdit() {
    if (this.client) {
      this.edit.emit(this.client);
    }
  }
}