import { Component, HostListener, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoginService } from '../../core/services/login.service';
import { User } from '../../core/models/User';
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
    { path: '/private/rectores', icon: 'academic-cap', label: 'Rectores' },
    { path: '/private/accounts-receivable', icon: 'cash', label: 'Cuentas por Cobrar' },
    { path: '/private/payments', icon: 'payment', label: 'Pagos' },
    { path: '/private/courses', icon: 'book', label: 'Cursos' },
    { path: '/private/reports', icon: 'chart-bar', label: 'Reportes' },
    { path: '/private/list-schools', icon: 'list', label: 'Listado' }
  ];

  constructor(private router: Router, private loginService: LoginService) {}

  ngOnInit() {
    this.checkUserRole();
  }

  checkUserRole() {
    const userData = sessionStorage.getItem('current_user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.role === 'a4ed6390-5421-46d1-b81e-5cad06115abc') {
        this.menuItems = [
          { path: '/private/dashboard', icon: 'home', label: 'Dashboard' },
          { path: '/private/list-schools', icon: 'list', label: 'Listado' }
        ];
      }
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
        localStorage.clear();
        sessionStorage.clear();
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Error al cerrar sesión:', error);
        // Incluso si hay error, limpiamos el localStorage y sessionStorage y redirigimos
        localStorage.clear();
        sessionStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }

}
