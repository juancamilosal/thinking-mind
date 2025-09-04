import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormRector } from './form-rector/form-rector';
import { RectorDetail } from './rector-detail/rector-detail';
import { FormAdmin } from './admin/form-admin/form-admin';
import { AdminDetail } from './admin/admin-detail/admin-detail';
import { UserService } from '../../../../core/services/user.service';
import { SchoolService } from '../../../../core/services/school.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { User } from '../../../../core/models/User';
import { School } from '../../../../core/models/School';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, FormRector, RectorDetail, FormAdmin, AdminDetail],
  templateUrl: './users.html'
})
export class Users implements OnInit {
  selectedRole = '';
  showForm = false;
  showDetail = false;
  editMode = false;
  selectedRector: User | null = null;
  selectedAdmin: User | null = null;
  rectores: User[] = [];
  admins: User[] = [];
  isLoading = false;
  searchTerm = '';
  schools: { [key: number]: string } = {};
  private searchTimeout: any;

  constructor(
    private userService: UserService,
    private schoolService: SchoolService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSchools();
    // Cargar datos iniciales si hay un rol seleccionado
    if (this.selectedRole === 'rector') {
      this.loadRectores();
    } else if (this.selectedRole === 'administrador') {
      this.loadAdministradores();
    }
    this.searchRector(undefined, false);
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

  onRoleChange(): void {
    this.showForm = false;
    this.showDetail = false;
    this.editMode = false;
    this.selectedRector = null;
    this.selectedAdmin = null;

    // Cargar datos según el rol seleccionado
    if (this.selectedRole === 'rector') {
      this.loadRectores();
    } else if (this.selectedRole === 'administrador') {
      this.loadAdministradores();
    }
  }

  loadRectores(): void {
    this.isLoading = true;
    // Usar el roleId específico para rectores
    this.userService.getUsersByRole('a4ed6390-5421-46d1-b81e-5cad06115abc').subscribe({
      next: (response) => {
        this.rectores = response.data || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading rectores:', error);
        this.notificationService.showError('Error', 'No se pudieron cargar los rectores');
        this.isLoading = false;
      }
    });
  }

  loadAdministradores(): void {
    this.isLoading = true;
    // Usar el roleId específico para administradores
    this.userService.getUsersByRole('ca89252c-6b5c-4f51-a6e4-34ab4d0e2a02').subscribe({
      next: (response) => {
        this.admins = response.data || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading administradores:', error);
        this.notificationService.showError('Error', 'No se pudieron cargar los administradores');
        this.isLoading = false;
      }
    });
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.editMode = false;
    this.selectedRector = null;
    this.selectedAdmin = null;
  }

  searchRector(searchTerm?: string, showErrorNotification: boolean = true) {
    this.isLoading = true;

    // Usar el servicio para buscar rectores
    this.userService.getUsersByRole('a4ed6390-5421-46d1-b81e-5cad06115abc', searchTerm).subscribe({
      next: (response) => {
        this.rectores = response.data || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error searching rectores:', error);
        if (showErrorNotification) {
          this.notificationService.showError('Error', 'No se pudieron buscar los rectores');
        }
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.searchRector(this.searchTerm);
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.searchRector(this.searchTerm);
    }, 500);
  }

  viewRector(rector: User) {
    this.selectedRector = rector;
    this.showDetail = true;
  }

  editRector(rector: User) {
    this.selectedRector = rector;
    this.editMode = true;
    this.showForm = true;
    this.showDetail = false;
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedRector = null;
    this.selectedAdmin = null;
  }

  onRectorCreated(rector: User) {
    this.rectores.push(rector);
    this.showForm = false;
    this.selectedRector = null;
  }

  onRectorUpdated(rector: User) {
    const index = this.rectores.findIndex(r => r.id === rector.id);
    if (index !== -1) {
      this.rectores[index] = rector;
    }
    this.showForm = false;
    this.editMode = false;
    this.selectedRector = null;
  }

  onRectorDeleted(rector: User) {
    this.rectores = this.rectores.filter(r => r.id !== rector.id);
    this.selectedRector = null;
    this.showForm = false;
  }

  // Métodos para Administradores
  viewAdminDetail(admin: User) {
    this.selectedAdmin = admin;
  }

  viewAdmin(admin: User) {
    this.selectedAdmin = admin;
    this.showDetail = true;
  }

  editAdmin(admin: User) {
    this.selectedAdmin = admin;
    this.editMode = true;
    this.showForm = true;
    this.showDetail = false;
  }

  createAdmin() {
    this.selectedAdmin = null;
    this.editMode = false;
    this.showForm = true;
  }

  onAdminCreated(admin: User) {
    this.admins.push(admin);
    this.showForm = false;
    this.selectedAdmin = null;
  }

  onAdminUpdated(admin: User) {
    const index = this.admins.findIndex(a => a.id === admin.id);
    if (index !== -1) {
      this.admins[index] = admin;
    }
    this.showForm = false;
    this.selectedAdmin = null;
    this.editMode = false;
  }

  onAdminDeleted(admin: User) {
    this.admins = this.admins.filter(a => a.id !== admin.id);
    this.selectedAdmin = null;
    this.showForm = false;
    this.showDetail = false;
    this.editMode = false;
  }



  closeForm() {
    this.showForm = false;
    this.editMode = false;
    this.selectedRector = null;
    this.selectedAdmin = null;
  }
}
