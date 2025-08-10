import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html'
})
export class Sidebar {
  isOpen = false;
  menuItems = [
    { path: '/private/clients', icon: 'users', label: 'Clientes' },
    { path: '/private/schools', icon: 'building', label: 'Colegios' },
    { path: '/private/courses', icon: 'book', label: 'Cursos' },
    { path: '/private/accounts-receivable', icon: 'cash', label: 'Cuentas por Cobrar' }
  ];

  toggleSidebar() {
    this.isOpen = !this.isOpen;
  }
}
