import { Component, HostListener, OnInit, AfterViewInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { HeaderComponent } from '../../components/header/header.component';
import { NgClass, isPlatformBrowser } from "@angular/common";
import { NotificationModalComponent, NotificationData } from '../../components/notification-modal/notification-modal';
import { ConfirmationModalComponent, ConfirmationData } from '../../components/confirmation-modal/confirmation-modal';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmationService } from '../../core/services/confirmation.service';

@Component({
  selector: 'app-private-layout-ayo',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, NotificationModalComponent, ConfirmationModalComponent, NgClass],
  templateUrl: './private-layout-ayo.html'
})
export class PrivateLayoutAyo implements OnInit, AfterViewInit {

  isSidebarOpen = false;
  windowWidth = 0;
  isBrowser = false;
  isMobileSidebarOpen = false;
  hasInitialized = false;
  isDesktop = false;

  // Propiedades para el modal de notificaciones
  isNotificationVisible = false;
  currentNotification: NotificationData | null = null;

  // Propiedades para el modal de confirmación
  isConfirmationVisible = false;
  currentConfirmation: ConfirmationData | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.windowWidth = window.innerWidth;
      this.isDesktop = this.windowWidth >= 768;
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

  ngAfterViewInit() {
    // Evita transiciones en el primer render para que no parezca
    // que el sidebar "se cierra" al abrir la aplicación
    this.hasInitialized = true;
    if (this.isBrowser) {
      this.cdr.detectChanges();
    }
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

  onToggleSidebar() {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
    // Forzar detección de cambios para asegurar que el estado se refleje inmediatamente en mobile
    if (this.isBrowser) {
      this.cdr.detectChanges();
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (this.isBrowser) {
      this.windowWidth = window.innerWidth;
      this.isDesktop = this.windowWidth >= 768;
      this.isSidebarOpen = this.windowWidth >= 640;
      // Actualizar vista en cambios de tamaño de ventana
      this.cdr.detectChanges();
    }
  }
}
