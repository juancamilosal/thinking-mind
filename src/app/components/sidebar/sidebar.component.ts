import { Component, HostListener, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

import { LoginService } from '../../core/services/login.service';
import { User } from '../../core/models/User';
import { StorageServices } from '../../core/services/storage.services';
import { MenuService, MenuItem } from '../../core/services/menu.service';
import { Subscription } from 'rxjs';
import {Menu} from '../../core/models/Menu';
import { Roles } from '../../core/const/Roles';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent implements OnInit, OnDestroy {

  currentUser: User | null = null;
  private userSubscription: Subscription = new Subscription();
  @Output() sidebarClose = new EventEmitter<void>();
  menuItems: Menu[] = [];

  constructor(
    private router: Router,
    private loginService: LoginService,
    private menuService: MenuService
  ) {}

  ngOnInit() {
    this.loadMenuItems();
    this.checkAuthentication();
  }

  loadMenuItems() {
    const user = StorageServices.getCurrentUser();

    this.menuService.list(user?.role).subscribe({
      next: (response) => {
        console.log('Menu response:', response);
        this.menuItems = response.data.filter(item => item.activo);
        console.log('Filtered menu items:', this.menuItems);
      },
      error: (error) => {
        console.error('Error loading menu:', error);
      }
    });
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


  ngOnDestroy() {
    this.userSubscription.unsubscribe();
  }

  closeSidebar() {
    this.sidebarClose.emit();
  }

  // Get the appropriate route based on user role and menu item
  getRouteForMenuItem(item: Menu): string {
    const user = StorageServices.getCurrentUser();

    // If the menu item is "Reuniones", route based on user role
    if (item.nombre === 'Reuniones') {
      if (user?.role === Roles.TEACHER) {
        return '/private/teacher';
      } else if (user?.role === Roles.STUDENT) {
        return '/private/meet-student';
      }
    }

    // Default: use the route from the menu item
    return item.ruta;
  }

  logout() {
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
          window.location.href = '/login-ayo';
        } else {
          window.location.href = '/login';
        }
      },
      error: (error) => {
        StorageServices.clearAllSession();
        if (isAyoRole) {
          window.location.href = '/login-ayo';
        } else {
          window.location.href = '/login';
        }
      }
    });
  }

}
