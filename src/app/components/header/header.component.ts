import { Component, OnInit, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoginService } from '../../core/services/login.service';
import { StorageServices } from '../../core/services/storage.services';
import { TokenRefreshService } from '../../core/services/token-refresh.service';
import { Roles } from '../../core/const/Roles';
import { TranslateService } from '@ngx-translate/core';

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
  imports: [FormsModule],
  templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit {
  currentUser: CurrentUser | null = null;
  @Output() toggleSidebar = new EventEmitter<void>();
  isUserMenuOpen = false;
  selectedAyoLanguage: string = 'ES';

  constructor(
    private elementRef: ElementRef,
    private router: Router,
    private loginService: LoginService,
    private tokenRefreshService: TokenRefreshService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.loadUserFromSessionStorage();
    const tree = this.router.parseUrl(this.router.url);
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('ayo_language') : null;
    const langParam = tree.queryParams['lang'] ? String(tree.queryParams['lang']).toUpperCase() : null;
    const lang = (stored || langParam || 'ES').toUpperCase();
    if (lang === 'EN' || lang === 'FR' || lang === 'ES') {
      this.selectedAyoLanguage = lang;
    }
    const code = this.selectedAyoLanguage === 'EN' ? 'en' : this.selectedAyoLanguage === 'FR' ? 'fr' : 'es';
    this.translate.use(code);
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

    // If we have first and last name, use them
    if (this.currentUser.first_name && this.currentUser.last_name) {
      const firstInitial = this.currentUser.first_name.charAt(0) || '';
      const lastInitial = this.currentUser.last_name.charAt(0) || '';
      return (firstInitial + lastInitial).toUpperCase();
    }

    // Otherwise, use first two letters of email
    if (this.currentUser.email) {
      return this.currentUser.email.substring(0, 2).toUpperCase();
    }

    return '';
  }

  onToggleSidebar() {
    this.toggleSidebar.emit();
  }

  onChangeLanguage(lang: string) {
    this.selectedAyoLanguage = lang;
    const code = lang === 'EN' ? 'en' : lang === 'FR' ? 'fr' : 'es';
    this.translate.use(code);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ayo_language', lang);
    }
    const tree = this.router.parseUrl(this.router.url);
    tree.queryParams = { ...tree.queryParams, lang };
    this.router.navigateByUrl(tree);
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

    const user = StorageServices.getCurrentUser();
    const isAyoRole = user?.role === Roles.STUDENT || user?.role === Roles.TEACHER;

    // Asegurar que last_user_role esté actualizado antes de borrar la sesión
    if (user?.role && typeof localStorage !== 'undefined') {
      localStorage.setItem('last_user_role', user.role);
    }

    this.loginService.logout().subscribe({
      next: () => {
        StorageServices.clearAllSession();
        if (isAyoRole) {
          this.router.navigate(['/login-ayo']);
        } else {
          this.router.navigate(['/login']);
        }
      },
      error: (error) => {
        console.error('Error al cerrar sesión:', error);
        // Incluso si hay error, limpiamos la sesión y redirigimos
        StorageServices.clearAllSession();
        if (isAyoRole) {
          this.router.navigate(['/login-ayo']);
        } else {
          this.router.navigate(['/login']);
        }
      }
    });
  }
}
