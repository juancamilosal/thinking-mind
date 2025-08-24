import { Component, HostListener, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { NgClass, isPlatformBrowser } from "@angular/common";
import { NotificationModalComponent, NotificationData } from '../../components/notification-modal/notification-modal';
import { ConfirmationModalComponent, ConfirmationData } from '../../components/confirmation-modal/confirmation-modal';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmationService } from '../../core/services/confirmation.service';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NgClass, NotificationModalComponent, ConfirmationModalComponent],
  templateUrl: './private-layout.html'
})
export class PrivateLayout implements OnInit {

  isSidebarOpen = false;
  windowWidth = 0;
  isBrowser = false;
  
  // Propiedades para el modal de notificaciones
  isNotificationVisible = false;
  currentNotification: NotificationData | null = null;
  
  // Propiedades para el modal de confirmación
  isConfirmationVisible = false;
  currentConfirmation: ConfirmationData | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.windowWidth = window.innerWidth;
      this.isSidebarOpen = this.windowWidth >= 640;
    }
    
    // Suscribirse a las notificaciones
    this.notificationService.notification$.subscribe(notification => {
      this.currentNotification = notification;
    });
    
    this.notificationService.isVisible$.subscribe(isVisible => {
      this.isNotificationVisible = isVisible;
    });
    
    // Suscribirse a las confirmaciones
    this.confirmationService.confirmation$.subscribe(confirmation => {
      this.currentConfirmation = confirmation;
    });
    
    this.confirmationService.isVisible$.subscribe(isVisible => {
      this.isConfirmationVisible = isVisible;
    });
  }
  
  onNotificationClose() {
    this.notificationService.hideNotification();
  }
  
  onConfirmationConfirm() {
    this.confirmationService.confirm();
  }
  
  onConfirmationCancel() {
    this.confirmationService.cancel();
  }

  @HostListener('window:resize')
  onResize() {
    if (this.isBrowser) {
      this.windowWidth = window.innerWidth;
      this.isSidebarOpen = this.windowWidth >= 640;
    }
  }
}
