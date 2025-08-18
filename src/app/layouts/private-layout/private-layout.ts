import { Component, HostListener, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { isPlatformBrowser } from "@angular/common";

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './private-layout.html'
})
export class PrivateLayout implements OnInit {

  isSidebarOpen = false;
  windowWidth = 0;
  isBrowser = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.windowWidth = window.innerWidth;
      this.isSidebarOpen = this.windowWidth >= 640;
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (this.isBrowser) {
      this.windowWidth = window.innerWidth;
      this.isSidebarOpen = this.windowWidth >= 640;
    }
  }
}
