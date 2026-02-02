import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';
import { Roles } from '../../../../core/const/Roles';

@Component({
  selector: 'app-session-expired',
  standalone: true,
  imports: [CommonModule, AppButtonComponent],
  templateUrl: './session-expired.html'
})
export class SessionExpiredComponent {
  
  constructor(private router: Router) {}

  loginAgain() {
    const lastRole = typeof localStorage !== 'undefined' ? localStorage.getItem('last_user_role') : null;
    const isAyoRole = lastRole === Roles.STUDENT || lastRole === Roles.TEACHER;

    if (isAyoRole) {
      this.router.navigate(['/login-ayo']);
    } else {
      this.router.navigate(['/login']);
    }
  }
}