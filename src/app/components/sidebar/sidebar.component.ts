import { Component, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LoginService } from '../../core/services/login.service';


@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  isSidebarOpen = false;

  constructor(private router: Router, private loginService: LoginService) {}

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar() {
    this.isSidebarOpen = false;
  }

  logout() {
    this.loginService.logout().subscribe({
      next: () => {
        // Limpiar tokens y datos de usuario
        localStorage.clear();
        sessionStorage.clear();
        // Redirigir al login
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Error al cerrar sesión:', error);
        // Aún así limpiar datos y redirigir al login en caso de error
        localStorage.clear();
        sessionStorage.clear();
        this.router.navigate(['/login']);
      }
    });
  }

  menuItems = [
    { path: '/private/clients', icon: 'users', label: 'Clientes' },
    { path: '/private/students', icon: 'student', label: 'Estudiantes' },
    { path: '/private/schools', icon: 'building', label: 'Colegios' },
    { path: '/private/accounts-receivable', icon: 'cash', label: 'Cuentas por Cobrar' },
    { path: '/private/payments', icon: 'payment', label: 'Pagos' },
    { path: '/private/courses', icon: 'book', label: 'Cursos' },
  ];
}
