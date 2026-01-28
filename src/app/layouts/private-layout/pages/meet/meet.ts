import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-meet-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meet.html',
  styleUrl: './meet.css'
})
export class MeetComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
