import { Component, HostListener, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LoginService } from '../../core/services/login.service';
import { User } from '../../core/models/User';
import { StorageServices } from '../../core/services/storage.services';
import { MenuService, MenuItem } from '../../core/services/menu.service';
import { Subscription } from 'rxjs';
import {Menu} from '../../core/models/Menu';

@Component({
  selector: 'app-sidebar-ayo',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './sidebar-ayo.component.html'
})
export class SidebarAyoComponent implements OnInit, OnDestroy {

  currentUser: User | null = null;
  private userSubscription: Subscription = new Subscription();
  @Output() sidebarClose = new EventEmitter<void>();
  menuItems: Menu[] = [];

  constructor(
    private router: Router,
    private loginService: LoginService,
    private menuService: MenuService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.loadMenuItems();
    this.checkAuthentication();
  }

  loadMenuItems() {
    const user = StorageServices.getCurrentUser();

    this.menuService.listAyo().subscribe({
      next: (response) => {
        this.menuItems = response.data;
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
    this.loginService.logout().subscribe({
      next: () => {
        StorageServices.clearAllSession();
        this.router.navigate(['/login-ayo']);
      },
    });
  }

  getSidebarKey(name?: string): string {
    const v = (name || '').toLowerCase().trim();
    if (v === 'dasboard' || v === 'dashboard') return 'sidebar_ayo.dashboard';
    if (v === 'reuniones' || v === 'meetings') return 'sidebar_ayo.meetings';
    if (v === 'avance' || v === 'progress') return 'sidebar_ayo.progress';
    if (v === 'certificados' || v === 'certificates') return 'sidebar_ayo.certificates';
    if (v === 'nomina docente' || v === 'nómina docente' || v === 'teacher payroll' || v === 'payroll') return 'sidebar_ayo.teacherPayroll';
    if (v === 'calificacion' || v === 'calificación' || v === 'rating' || v === 'grading' || v === 'grade') return 'sidebar_ayo.rating';
    return '';
  }

  getSidebarLabel(name?: string): string {
    const key = this.getSidebarKey(name);
    if (!key) return name || '';
    const value = this.translate.instant(key);
    return value && value !== key ? value : (name || '');
  }
}
