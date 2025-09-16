import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SchoolService } from '../../../../core/services/school.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import { School } from '../../../../core/models/School';
import { AccountReceivable } from '../../../../core/models/AccountReceivable';
import { NotificationService } from '../../../../core/services/notification.service';

interface SchoolWithAccounts {
  school: School;
  accountsCount: number;
  studentsCount: number;
  totalAmount: number;
  accounts: AccountReceivable[];
}

@Component({
  selector: 'app-list-schools',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './list.school.html'
})


export class ListSchool implements OnInit {
  schoolsWithAccounts: SchoolWithAccounts[] = [];
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
    private accountReceivableService: AccountReceivableService,
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
        this.loadAccountsForSchool(user.colegio_id);
        return;
      }
    }

    // Para otros usuarios, cargar todas las cuentas por cobrar
    this.loadAllAccountsReceivable();
  }

  private loadAllAccountsReceivable(): void {
    this.accountReceivableService.searchAccountReceivable().subscribe({
      next: (response) => {
        this.processAccountsReceivable(response.data);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar cuentas:', error);
        this.notificationService.showError(
          'Error',
          'Error al cargar las cuentas por cobrar'
        );
        this.isLoading = false;
      }
    });
  }

  private loadAccountsForSchool(schoolId: string): void {
    this.accountReceivableService.searchAccountReceivable('', schoolId).subscribe({
      next: (response) => {
        this.processAccountsReceivable(response.data);
        this.isLoading = false;
      },
      error: (error) => {
        this.notificationService.showError(
          'Error',
          'Error al cargar las cuentas del colegio'
        );
        this.isLoading = false;
      }
    });
  }

  private processAccountsReceivable(accounts: AccountReceivable[]): void {
    // Filtrar solo las cuentas que tengan fecha de inscripción
    const accountsWithInscription = accounts.filter(account =>
      account.fecha_inscripcion && account.fecha_inscripcion.trim() !== ''
    );

    // Agrupar por colegio
    const schoolsMap = new Map<string, SchoolWithAccounts>();

    accountsWithInscription.forEach(account => {
      // Verificar que el account tenga la estructura esperada
      if (account.estudiante_id && typeof account.estudiante_id === 'object') {
        const student = account.estudiante_id;
        
        // Verificar que el estudiante tenga colegio_id
        if (student.colegio_id && typeof student.colegio_id === 'object') {
          const school = student.colegio_id;
          const schoolId = school.id;

          if (!schoolsMap.has(schoolId)) {
            schoolsMap.set(schoolId, {
              school: school,
              accountsCount: 0,
              studentsCount: 0,
              totalAmount: 0,
              accounts: []
            });
          }

          const schoolData = schoolsMap.get(schoolId)!;
          schoolData.accounts.push(account);
          schoolData.accountsCount++;
          schoolData.totalAmount += account.monto;
        }
      }
    });

    // Calcular estudiantes únicos por colegio
    schoolsMap.forEach((schoolData, schoolId) => {
      const uniqueStudents = new Set();
      schoolData.accounts.forEach(account => {
        if (account.estudiante_id && typeof account.estudiante_id === 'object') {
          uniqueStudents.add(account.estudiante_id.id);
        }
      });
      schoolData.studentsCount = uniqueStudents.size;
    });

    this.schoolsWithAccounts = Array.from(schoolsMap.values());
    
    this.totalItems = this.schoolsWithAccounts.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
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

    if (this.isRector) {
      // Si es rector, buscar solo en su colegio
      const userData = sessionStorage.getItem('current_user');
      if (userData) {
        const user = JSON.parse(userData);
        this.loadAccountsForSchool(user.colegio_id);
      }
    } else {
      // Para otros usuarios, buscar en todas las cuentas por cobrar
      this.accountReceivableService.searchAccountReceivable(this.searchTerm).subscribe({
        next: (response) => {
          this.processAccountsReceivable(response.data);
          this.isLoading = false;
        },
        error: (error) => {
          this.notificationService.showError(
            'Error',
            'Error al buscar cuentas por cobrar'
          );
          this.isLoading = false;
        }
      });
    }
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

  navigateToShirts(): void {
    this.router.navigate(['/private/shirt-colors']);
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

}
