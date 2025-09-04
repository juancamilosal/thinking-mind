import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {User} from '../../../../../../core/models/User';
import { NotificationService } from '../../../../../../core/services/notification.service';

@Component({
  selector: 'app-rector-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rector-detail.html'
})
export class RectorDetail implements OnInit {
  @Input() rector: User | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<User>();
  @Output() delete = new EventEmitter<string>();

  constructor(
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // No necesitamos cargar colegios para directus_users
  }

  onClose() {
    this.close.emit();
  }

  onEdit() {
    if (this.rector) {
      this.edit.emit(this.rector);
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
