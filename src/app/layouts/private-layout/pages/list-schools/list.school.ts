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
  isRector = false;
  private searchTimeout: any;
  
  // Propiedades de paginación
  currentPage = 1;
  itemsPerPage = 15;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [10, 15, 25, 50];
  
  // Hacer Math disponible en el template
  Math = Math;

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
        this.isRector = true;
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
    this.schoolService.getAllSchools(this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        this.schools = response.data;
        this.totalItems = response.meta?.total_count || 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
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
    this.currentPage = 1; // Resetear a la primera página al cambiar búsqueda

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
    this.schoolService.searchSchool(this.searchTerm, this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        this.schools = response.data;
        this.totalItems = response.meta?.total_count || 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
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
    this.currentPage = 1; // Resetear a la primera página al buscar
    this.searchSchools();
  }

  // Métodos de paginación
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      if (this.searchTerm) {
        this.searchSchools();
      } else {
        this.loadSchools();
      }
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    // Ajustar el inicio si estamos cerca del final
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    if (this.searchTerm) {
      this.searchSchools();
    } else {
      this.loadSchools();
    }
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
