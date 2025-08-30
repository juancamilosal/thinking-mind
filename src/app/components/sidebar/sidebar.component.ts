import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
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
  isSidebarOpen = false;
  currentUser: User | null = null;
  private userSubscription: Subscription = new Subscription();

  constructor(private router: Router, private loginService: LoginService) {}

  ngOnInit() {

  }

  ngOnDestroy() {
    this.userSubscription.unsubscribe();
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar() {
    this.isSidebarOpen = false;
  }

  logout() {
    this.loginService.logout().subscribe({
      next: () => {
        console.log('Logout exitoso');
        localStorage.clear();
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Error al cerrar sesión:', error);
        // Incluso si hay error, limpiamos el localStorage y redirigimos
        localStorage.clear();
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
    { path: '/private/reports', icon: 'chart-bar', label: 'Reportes' }
  ];
}
