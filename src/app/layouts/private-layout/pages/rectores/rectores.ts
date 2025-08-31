import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RectorService } from '../../../../core/services/rector.service';
import { SchoolService } from '../../../../core/services/school.service';
import { Rector } from '../../../../core/models/Rector';
import { FormRector } from './form-rector/form-rector';
import { RectorDetail } from './rector-detail/rector-detail';
import { NotificationService } from '../../../../core/services/notification.service';
import { StorageServices } from '../../../../core/services/storage.services';

@Component({
  selector: 'app-rectores',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormRector, RectorDetail],
  templateUrl: './rectores.html'
})
export class Rectores implements OnInit {
  showForm = false;
  showDetail = false;
  editMode = false;
  selectedRector: Rector | null = null;
  rectores: Rector[] = [];
  isLoading = false;
  searchTerm = '';
  schools: { [key: number]: string } = {};
  private searchTimeout: any;

  constructor(
    private fb: FormBuilder,
    private rectorService: RectorService,
    private schoolService: SchoolService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSchools();
    this.searchRector();
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

  toggleForm() {
    this.showForm = !this.showForm;
    this.editMode = false;
    this.selectedRector = null;
  }

  searchRector(searchTerm?: string) {
    this.isLoading = true;
    this.rectorService.searchRector(searchTerm).subscribe({
      next: (data) => {
        this.rectores = data.data;
        this.isLoading = false;
      },
      error: (error) => {
        if (error.status === 403) {
          this.notificationService.showError(
            'Error de Autenticación',
            'No tienes permisos para acceder a esta información. Por favor, inicia sesión nuevamente.'
          );
        }

        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.searchRector(this.searchTerm.trim() || undefined);
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }


    this.searchTimeout = setTimeout(() => {
      this.searchRector(this.searchTerm.trim() || undefined);
    }, 500);
  }

  viewRector(rector: Rector) {
    this.selectedRector = rector;
    this.showDetail = true;
  }

  editRector(rector: Rector) {
    this.selectedRector = rector;
    this.editMode = true;
    this.showForm = true;
    this.showDetail = false;
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedRector = null;
  }

  onRectorUpdated() {
    this.searchRector();
    this.toggleForm();
  }
}
