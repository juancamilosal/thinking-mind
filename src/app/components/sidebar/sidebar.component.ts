import {Component, ElementRef, EventEmitter, HostListener, Output} from '@angular/core';
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

  constructor(private eRef: ElementRef) {
  }

  toggleSidebar = () => {
    this.isOpen = !this.isOpen;
    this.sidebarStateChange.emit(this.isOpen);
  }

  onMenuItemClick = ()=> {
    this.isOpen = false;
    this.sidebarStateChange.emit(false);
  }

  @HostListener('document:click', ['$event'])
  clickOutside= (event: Event)=> {
    if (this.isOpen && !this.eRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
      this.sidebarStateChange.emit(false);
    }
  }
}
