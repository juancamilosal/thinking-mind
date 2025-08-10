import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  @Output() sidebarStateChange = new EventEmitter<boolean>();
  isOpen = false;
  menuItems = [
    { path: '/private/clients', icon: 'users', label: 'Clientes' },
    { path: '/private/schools', icon: 'building', label: 'Colegios' },
    { path: '/private/courses', icon: 'book', label: 'Cursos' },
    { path: '/private/accounts-receivable', icon: 'cash', label: 'Cuentas por Cobrar' }
  ];

}
