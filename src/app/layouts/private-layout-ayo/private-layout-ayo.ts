import { Component, HostListener, OnInit, AfterViewInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from '../../components/header/header.component';
import { NgClass, isPlatformBrowser, registerLocaleData } from "@angular/common";
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';
import { NotificationModalComponent, NotificationData } from '../../components/notification-modal/notification-modal';
import { ConfirmationModalComponent, ConfirmationData } from '../../components/confirmation-modal/confirmation-modal';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import {SidebarAyoComponent} from '../../components/sidebar-ayo/sidebar-ayo.component';
import { TokenRefreshService } from '../../core/services/token-refresh.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-private-layout-ayo',
  standalone: true,
  imports: [RouterOutlet, SidebarAyoComponent, HeaderComponent, NotificationModalComponent, ConfirmationModalComponent, NgClass, TranslateModule],
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
    private tokenRefreshService: TokenRefreshService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    registerLocaleData(localeEs);
    registerLocaleData(localeFr);
    // Start token refresh service to ensure session stays active
    if (this.isBrowser) {
        this.tokenRefreshService.startTokenRefreshService();
    }

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

    const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('ayo_language') : null;
    if (storedLang) {
      const code = storedLang === 'EN' ? 'en' : storedLang === 'FR' ? 'fr' : 'es';
      this.translate.use(code);
    } else {
      this.translate.use('es');
      if (typeof localStorage !== 'undefined') localStorage.setItem('ayo_language', 'ES');
    }
    // Asegurar que ?lang siempre esté presente en rutas privadas AYO
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const urlTree = this.router.parseUrl(event.urlAfterRedirects || event.url);
        const currentLangParam = urlTree.queryParams['lang'];
        const hasLang = !!currentLangParam;
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ayo_language') : null;
        const lang = (currentLangParam && (String(currentLangParam).toUpperCase())) || (stored === 'EN' || stored === 'FR' || stored === 'ES' ? stored : 'ES');
        const isPrivateAyo = (urlTree.root.children['primary']?.segments[0]?.path || '').startsWith('private-ayo');
        if (isPrivateAyo && !hasLang) {
          urlTree.queryParams = { ...urlTree.queryParams, lang };
          this.router.navigateByUrl(urlTree, { replaceUrl: true });
        }
        const code = lang === 'EN' ? 'en' : lang === 'FR' ? 'fr' : 'es';
        this.translate.use(code);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('ayo_language', lang);
        }
      }
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
