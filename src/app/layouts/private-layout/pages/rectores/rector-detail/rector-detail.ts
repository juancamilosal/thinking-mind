import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Rector } from '../../../../../core/models/Rector';
import { RectorService } from '../../../../../core/services/rector.service';
import { SchoolService } from '../../../../../core/services/school.service';
import { NotificationService } from '../../../../../core/services/notification.service';

@Component({
  selector: 'app-rector-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rector-detail.html'
})
export class RectorDetail implements OnInit {
  @Input() rector: Rector | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Rector>();
  @Output() delete = new EventEmitter<number>();
  schools: { [key: number]: string } = {};

  constructor(
    private rectorService: RectorService,
    private schoolService: SchoolService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSchools();
  }

  loadSchools(): void {
    this.schoolService.getAllSchools().subscribe({
      next: (response) => {
        response.data.forEach(school => {
          this.schools[school.id!] = school.nombre;
        });
      },
      error: (error) => {
        console.error('Error loading schools:', error);
      }
    });
  }

  getSchoolName(schoolId: number): string {
    return this.schools[schoolId] || 'N/A';
  }

  onClose() {
    this.close.emit();
  }

  onEdit() {
    if (this.rector) {
      this.edit.emit(this.rector);
    }
  }

  capitalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }
}