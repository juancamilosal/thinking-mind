import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';

@Component({
  selector: 'app-private-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './private-layout.html'
})
export class PrivateLayout {}
