import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../../../../core/services/attendance.service';
import { StorageServices } from '../../../../core/services/storage.services';
import { Attendance } from '../../../../core/models/Attendance';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-attendance-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.css']
})
export class AttendancePageComponent implements OnInit {

  attendanceList: Attendance[] = [];
  isLoading = false;
  currentPage = 1;
  limit = 10;
  totalItems = 0;

  // Filters
  startDate: string = '';
  endDate: string = '';
  attendanceStatus: string = 'all'; // 'all', 'present', 'absent'
  searchQuery: string = '';

  constructor(
    private attendanceService: AttendanceService,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadAttendances();
  }

  loadAttendances(): void {
    const user = StorageServices.getCurrentUser()
    if (!user || !user.id) {
      this.notificationService.showError('Error', 'No se pudo identificar al usuario.');
      return;
    }

    this.isLoading = true;

    const filter: any = { estudiante_id: user.id };

    if (this.startDate || this.endDate) {
      filter.fecha = {};
      if (this.startDate) {
        filter.fecha._gte = this.startDate;
      }
      if (this.endDate) {
        filter.fecha._lte = this.endDate;
      }
    }

    if (this.attendanceStatus !== 'all') {
      filter.asiste = this.attendanceStatus === 'present';
    }

    const sort = '-fecha';
    const fields = '*,programa_ayo_id.*,programa_ayo_id.id_nivel.*';

    this.attendanceService.getAttendances(this.currentPage, this.limit, this.searchQuery, filter, sort, fields).subscribe({
      next: (response) => {
        this.attendanceList = response.data || [];
        this.totalItems = response.meta?.total_count || 0;
        this.isLoading = false;
      },
      error: () => {
        this.notificationService.showError('Error', 'No se pudieron cargar las asistencias.');
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadAttendances();
  }

  resetFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.attendanceStatus = 'all';
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadAttendances();
  }

  getStars(score: number | undefined): any[] {
    if (!score) return [];
    // Create an array with 'score' elements to iterate over
    return Array(Number(score)).fill(0);
  }

}
