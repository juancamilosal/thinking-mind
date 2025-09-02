import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SchoolService } from '../../../../core/services/school.service';
import { School } from '../../../../core/models/School';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-list-schools',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './list.school.html'
})
export class ListSchool implements OnInit {
  schools: School[] = [];
  isLoading = false;
  searchTerm = '';
  currentDate = new Date();
  private searchTimeout: any;

  constructor(
    private schoolService: SchoolService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSchools();
  }

  loadSchools(): void {
    this.isLoading = true;
    
    // Verificar si el usuario es rector
    const userData = sessionStorage.getItem('current_user');
    if (userData) {
      const user = JSON.parse(userData);
      
      // Si es rector, filtrar por su colegio_id
      if (user.role === 'a4ed6390-5421-46d1-b81e-5cad06115abc' && user.colegio_id) {
        this.schoolService.getSchoolById(user.colegio_id).subscribe({
          next: (response) => {
            this.schools = [response.data]; // Mostrar solo su colegio
            this.isLoading = false;
          },
          error: (error) => {
            this.notificationService.showError(
              'Error',
              'Error al cargar el colegio'
            );
            this.isLoading = false;
          }
        });
        return;
      }
    }
    
    // Para otros usuarios, mostrar todos los colegios
    this.schoolService.getAllSchools().subscribe({
      next: (response) => {
        this.schools = response.data;
        this.isLoading = false;
      },
      error: (error) => {
        this.notificationService.showError(
          'Error',
          'Error al cargar los colegios'
        );
        this.isLoading = false;
      }
    });
  }

  onSearchInputChange(event: any): void {
    this.searchTerm = event.target.value;

    // Limpiar el timeout anterior si existe
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Establecer un nuevo timeout para la búsqueda
    this.searchTimeout = setTimeout(() => {
      this.searchSchools();
    }, 500); // Esperar 500ms después de que el usuario deje de escribir
  }

  searchSchools(): void {
    this.isLoading = true;
    this.schoolService.searchSchool(this.searchTerm).subscribe({
      next: (response) => {
        this.schools = response.data;
        this.isLoading = false;
      },
      error: (error) => {
        this.notificationService.showError(
          'Error',
          'Error al buscar colegios'
        );
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    this.searchSchools();
  }

  navigateToStudents(schoolId: string): void {
    this.router.navigate(['/private/students-school', schoolId]);
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
}
