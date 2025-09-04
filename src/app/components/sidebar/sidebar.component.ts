import { Component, HostListener, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoginService } from '../../core/services/login.service';
import { User } from '../../core/models/User';
import { StorageServices } from '../../core/services/storage.services';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  private userSubscription: Subscription = new Subscription();
  @Output() sidebarClose = new EventEmitter<void>();

  menuItems = [
    { path: '/private/dashboard', icon: 'home', label: 'Dashboard' },
    { path: '/private/clients', icon: 'users', label: 'Clientes' },
    { path: '/private/students', icon: 'student', label: 'Estudiantes' },
    { path: '/private/schools', icon: 'building', label: 'Colegios' },
    { path: '/private/users', icon: 'user-group', label: 'Usuarios' },
    { path: '/private/accounts-receivable', icon: 'cash', label: 'Cuentas por Cobrar' },
    { path: '/private/payments', icon: 'payment', label: 'Pagos' },
    { path: '/private/courses', icon: 'book', label: 'Cursos' },
    { path: '/private/reports', icon: 'chart-bar', label: 'Reportes' },
    { path: '/private/list-schools', icon: 'list', label: 'Listado' }
  ];

  constructor(private router: Router, private loginService: LoginService) {}

  ngOnInit() {
    this.checkAuthentication();
    this.checkUserRole();
  }

  checkAuthentication() {
    const accessToken = StorageServices.getAccessToken();
    const currentUser = StorageServices.getCurrentUser();

    if (!accessToken || !currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUser = currentUser;
  }

  checkUserRole() {
    const currentUser = StorageServices.getCurrentUser();
    if (currentUser && currentUser.role === 'a4ed6390-5421-46d1-b81e-5cad06115abc') {
      this.menuItems = [
        { path: '/private/dashboard', icon: 'home', label: 'Dashboard' },
        { path: '/private/list-schools', icon: 'list', label: 'Listado' }
      ];
    }
  }

  ngOnDestroy() {
    this.userSubscription.unsubscribe();
  }

  closeSidebar() {
    // Emite evento para cerrar el sidebar móvil
    this.sidebarClose.emit();
  }

  logout() {
    this.loginService.logout().subscribe({
      next: () => {
        StorageServices.clearAllSession();
        // Forzar recarga completa de la página para resetear todos los estados
        window.location.href = '/login';
      },
      error: (error) => {
        console.error('Error al cerrar sesión:', error);
        // Incluso si hay error, limpiamos la sesión y redirigimos
        StorageServices.clearAllSession();
        // Forzar recarga completa de la página para resetear todos los estados
        window.location.href = '/login';
      }
    });
  }

}
