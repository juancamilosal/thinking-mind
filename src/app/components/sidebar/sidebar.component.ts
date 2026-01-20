import { Component, HostListener, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';

import { LoginService } from '../../core/services/login.service';
import { User } from '../../core/models/User';
import { StorageServices } from '../../core/services/storage.services';
import { MenuService, MenuItem } from '../../core/services/menu.service';
import { Subscription } from 'rxjs';
import {Menu} from '../../core/models/Menu';

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
    this.menuService.list().subscribe({
      next: (response) => {
        this.menuItems = response.data.filter(item => item.activo);
      },
      error: (error) => {
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

  logout() {
    const user = StorageServices.getCurrentUser();
    const isAyoRole = user?.role === 'ca8ffc29-c040-439f-8017-0dcb141f0fd3';

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
