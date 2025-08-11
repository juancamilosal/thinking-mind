import {Component, HostListener, OnInit} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import {NgClass} from "@angular/common";

@Component({
  selector: 'app-private-layout',
  standalone: true,
    imports: [RouterOutlet, SidebarComponent, NgClass],
  templateUrl: './private-layout.html'
})
export class PrivateLayout implements OnInit {

  isSidebarOpen = false;
  windowWidth = 0;

  constructor() {}

  ngOnInit() {
    this.windowWidth = window.innerWidth;
    this.isSidebarOpen = this.windowWidth >= 640;
  }

  @HostListener('window:resize')
  onResize() {
    this.windowWidth = window.innerWidth;
  }
}
