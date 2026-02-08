import { Component, HostListener, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { LoginService } from '../../core/services/login.service';
import { User } from '../../core/models/User';
import { StorageServices } from '../../core/services/storage.services';
import { Roles } from '../../core/const/Roles';
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
    const user = StorageServices.getCurrentUser();

    this.menuService.list().subscribe({
      next: (response) => {
        let items = response.data.filter(item => item.activo);
        if (this.router.url.includes('/private-ayo')) {
             items = items.map(item => ({
                 ...item,
                 ruta: item.ruta.replace('/private/', '/private-ayo/')
             }));
        }

        this.menuItems = items;
      },
      error: (error) => {
        console.error('Error loading menu items:', error);
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
    const isAyoRole = user?.role === Roles.STUDENT || user?.role === Roles.TEACHER;

    // Asegurar que last_user_role esté actualizado antes de borrar la sesión
    if (user?.role && typeof localStorage !== 'undefined') {
      localStorage.setItem('last_user_role', user.role);
    }

    this.loginService.logout().subscribe({
      next: () => {
        StorageServices.clearAllSession();
        if (isAyoRole) {
          this.router.navigate(['/login-ayo']);
        } else {
          this.router.navigate(['/login']);
        }
      },
      error: (error) => {
        StorageServices.clearAllSession();
        if (isAyoRole) {
          this.router.navigate(['/login-ayo']);
        } else {
          this.router.navigate(['/login']);
        }
      }
    });
  }

}
