import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.css']
})
export class NotFoundComponent {
  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}
