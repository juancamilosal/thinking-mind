import { Component, HostListener, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { NgClass, isPlatformBrowser } from "@angular/common";
import { NotificationModalComponent, NotificationData } from '../../components/notification-modal/notification-modal';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NgClass, NotificationModalComponent],
  templateUrl: './private-layout.html'
})
export class PrivateLayout implements OnInit {

  isSidebarOpen = false;
  windowWidth = 0;
  isBrowser = false;
  
  // Propiedades para el modal de notificaciones
  isNotificationVisible = false;
  currentNotification: NotificationData | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private notificationService: NotificationService
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
  }
  
  onNotificationClose() {
    this.notificationService.hideNotification();
  }

  @HostListener('window:resize')
  onResize() {
    if (this.isBrowser) {
      this.windowWidth = window.innerWidth;
      this.isSidebarOpen = this.windowWidth >= 640;
    }
  }
}
