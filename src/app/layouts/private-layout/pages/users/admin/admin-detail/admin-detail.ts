import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {User} from '../../../../../../core/models/User';
import { NotificationService } from '../../../../../../core/services/notification.service';

@Component({
  selector: 'app-admin-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-detail.html'
})
export class AdminDetail implements OnInit {
  @Input() admin: User | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<User>();
  @Output() delete = new EventEmitter<string>();

  showDeleteModal = false;

  constructor(
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // No necesitamos cargar datos adicionales para administradores
  }

  onClose() {
    this.close.emit();
  }

  onEdit() {
    if (this.admin) {
      this.edit.emit(this.admin);
    }
  }

  onDelete() {
    if (this.admin && this.admin.id) {
      this.delete.emit(this.admin.id.toString());
    }
  }

  confirmDelete() {
    this.showDeleteModal = false;
    if (this.admin && this.admin.id) {
      this.delete.emit(this.admin.id.toString());
    }
  }

  capitalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }
}
