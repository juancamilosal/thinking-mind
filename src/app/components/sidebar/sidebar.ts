import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html'
})
export class Sidebar {
  menuItems = [
    { path: '/private/clients', icon: 'users', label: 'Clientes' },
    { path: '/private/schools', icon: 'building', label: 'Colegios' },
    { path: '/private/courses', icon: 'book', label: 'Cursos' },
    { path: '/private/accounts-receivable', icon: 'cash', label: 'Cuentas por Cobrar' }
  ];
}