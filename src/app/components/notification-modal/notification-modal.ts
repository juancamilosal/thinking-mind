import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export class NotificationData {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number; // duración en milisegundos, opcional
  onClose?: () => void; // Callback opcional al cerrar
  hideDefaultButton?: boolean; // Ocultar el botón "Entendido" por defecto
}

@Component({
  selector: 'app-notification-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-modal.html',
  styleUrl: './notification-modal.css'
})
export class NotificationModalComponent {
  @Input() isVisible: boolean = false;
  @Input() notification: NotificationData | null = null;
  @Output() close = new EventEmitter<void>();

  ngOnChanges() {
    if (this.isVisible && this.notification?.duration) {
      setTimeout(() => {
        this.closeModal();
      }, this.notification.duration);
    }
  }

  closeModal() {
    if (this.notification?.onClose) {
      this.notification.onClose();
    }
    this.isVisible = false;
    this.close.emit();
  }

  getIconClass(): string {
    switch (this.notification?.type) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'info':
      default:
        return 'text-blue-500';
    }
  }

  getBackgroundClass(): string {
    switch (this.notification?.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  }

  getIcon(): string {
    switch (this.notification?.type) {
      case 'success':
        return 'M5 13l4 4L19 7';
      case 'error':
        return 'M6 18L18 6M6 6l12 12';
      case 'warning':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z';
      case 'info':
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }
}
