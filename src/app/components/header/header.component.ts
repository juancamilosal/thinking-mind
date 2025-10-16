import { Component, OnInit, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';

import { Router } from '@angular/router';
import { LoginService } from '../../core/services/login.service';
import { StorageServices } from '../../core/services/storage.services';
import { TokenRefreshService } from '../../core/services/token-refresh.service';

class CurrentUser {
  email: string;
  first_name: string;
  id: string;
  last_name: string;
  role: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit {
  currentUser: CurrentUser | null = null;
  @Output() toggleSidebar = new EventEmitter<void>();
  isUserMenuOpen = false;

  constructor(
    private elementRef: ElementRef, 
    private router: Router, 
    private loginService: LoginService,
    private tokenRefreshService: TokenRefreshService
  ) {}

  ngOnInit() {
    this.loadUserFromSessionStorage();
  }

  private loadUserFromSessionStorage(): void {
    try {
      this.currentUser = StorageServices.getCurrentUser();
    } catch (error) {
      console.error('Error al cargar usuario desde sessionStorage:', error);
    }
  }

  getInitials(): string {
    if (!this.currentUser) return '';
    const firstInitial = this.currentUser.first_name?.charAt(0) || '';
    const lastInitial = this.currentUser.last_name?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase();
  }

  onToggleSidebar() {
    this.toggleSidebar.emit();
  }

  toggleUserMenu() {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu() {
    this.isUserMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.isUserMenuOpen) {
      const target = event.target as HTMLElement;
      const userMenuElement = this.elementRef.nativeElement.querySelector('[data-user-menu]');
      if (userMenuElement && !userMenuElement.contains(target)) {
        this.isUserMenuOpen = false;
      }
    }
  }

  logout() {
    // Detener el servicio de renovación de tokens antes del logout
    this.tokenRefreshService.stopTokenRefreshService();
    
    this.loginService.logout().subscribe({
      next: () => {
        StorageServices.clearAllSession();
        window.location.href = '/login';
      },
      error: (error) => {
        console.error('Error al cerrar sesión:', error);
        // Incluso si hay error, limpiamos la sesión y redirigimos
        StorageServices.clearAllSession();
        window.location.href = '/login';
      }
    });
  }
}
