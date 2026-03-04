import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { forkJoin, of, Observable } from 'rxjs';
import { switchMap, map, catchError, shareReplay, startWith } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { FormUser } from './form-user/form-user';
import { UserList } from './user-list/user-list';
import { UserService } from '../../../../core/services/user.service';
import { SchoolService } from '../../../../core/services/school.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RoleService, Role } from '../../../../core/services/role.service';
import { User } from '../../../../core/models/User';
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';


@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, FormUser, UserList, AppButtonComponent],
  templateUrl: './users.html'
})
export class Users implements OnInit {
  selectedRole = '';
  showForm = false;
  showDetail = false;
  editMode = false;
  selectedUser: User | null = null;
  allUsers: User[] = [];
  roles: Role[] = [];
  filteredUsers: User[] = [];
  isLoading = false;
  isLoadingRoles = false;
  searchTerm = '';
  roleSearchTerm = '';
  schools: { [key: number]: string } = {};
  private searchTimeout: any;
  private roleSearchTimeout: any;

  constructor(
    private userService: UserService,
    private schoolService: SchoolService,
    private notificationService: NotificationService,
    private roleService: RoleService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // Solo cargar roles al inicio
    this.loadRoles();
    this.loadSchools(); // Cargar escuelas para mostrar nombres en la tabla
  }

  selectRole(roleId: string): void {
    this.selectedRole = roleId;
    this.onRoleChange();
  }

  // Nuevo método para cargar usuarios por rol
  loadUsersByRole(): void {
    if (!this.selectedRole) return;

    this.isLoading = true;
    this.userService.getUsersByRole(this.selectedRole).subscribe({
      next: (response) => {
        this.filteredUsers = response.data || [];
        this.isLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Error', 'No se pudieron cargar los usuarios');
        this.isLoading = false;
      }
    });
  }

  loadSchools(): void {
    this.schoolService.getAllSchools().subscribe({
      next: (response) => {
        response.data.forEach(school => {
          this.schools[school.id!] = school.nombre;
        });
      }
    });
  }

  getSchoolName(schoolId: number | string): string {
    const id = typeof schoolId === 'string' ? parseInt(schoolId, 10) : schoolId;
    return this.schools[id] || 'N/A';
  }

  getCollegeName(colegio_id: any): string {
    if (!colegio_id) return 'N/A';

    // Si colegio_id es un objeto con la propiedad nombre
    if (typeof colegio_id === 'object' && colegio_id.nombre) {
      return colegio_id.nombre;
    }

    // Si colegio_id es solo un ID, buscar en el array de schools
    if (typeof colegio_id === 'string' || typeof colegio_id === 'number') {
      const id = typeof colegio_id === 'string' ? parseInt(colegio_id, 10) : colegio_id;
      return this.schools[id] || 'N/A';
    }

    return 'N/A';
  }

  getRoleName(roleId: string): string {
    const role = this.roles.find(r => r.id === roleId);
    return role ? role.name : 'Usuario';
  }

  getSelectedRole(): Role | null {
    return this.roles.find(r => r.id === this.selectedRole) || null;
  }

  onRoleChange(): void {
    // No mostrar formulario automáticamente al seleccionar rol
    this.showForm = false;
    this.showDetail = false;
    this.editMode = false;
    this.selectedUser = null;

    // Limpiar datos anteriores
    this.filteredUsers = [];

    // Solo cargar usuarios cuando se selecciona un rol
    if (this.selectedRole) {
      this.loadUsersByRole();
    }
  }

  getRoleImage(roleId: string): string {
    // Rector
    if (roleId === 'a4ed6390-5421-46d1-b81e-5cad06115abc') {
      return 'assets/icons/rector.png';
    }
    // Director Ejecutivo
    if (roleId === 'ad299f85-8137-4709-a3ad-beaeb579cdb3') {
      return 'assets/icons/ejecutivo.png';
    }
    // Administrador
    if (roleId === 'ca89252c-6b5c-4f51-a6e4-34ab4d0e2a02') {
      return 'assets/icons/director.png';
    }
    // Student
    if (roleId === 'ca8ffc29-c040-439f-8017-0dcb141f0fd3') {
      return 'assets/icons/estudiante.png';
    }
    // Teacher
    if (roleId === 'fe83d2f3-1b89-477d-984a-de3b56e12001') {
      return 'assets/icons/docente.png';
    }
    // Finanzas
    if (roleId === 'b9cf2164-22ab-4dc8-be5a-8a9420c82f1c') {
      return 'assets/icons/finanzas.png';
    }
    // Ventas
    if (roleId === 'b40cfe25-bd79-4d62-818b-6cf96674fc12') {
      return 'assets/icons/clients.png';
    }

    // Default
    return 'assets/icons/users.png';
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.showDetail = false;

    if (!this.showForm) {
        this.editMode = false;
        this.selectedUser = null;
    }
  }

  onSearch() {
    // Implementar búsqueda genérica si es necesario
    // Por ahora, filtrar localmente filteredUsers
    if (!this.searchTerm) {
        this.loadUsersByRole();
        return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredUsers = this.filteredUsers.filter(user =>
        (user.first_name && user.first_name.toLowerCase().includes(term)) ||
        (user.last_name && user.last_name.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term))
    );
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.onSearch();
    }, 500);
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedUser = null;
  }

  closeForm() {
    this.showForm = false;
    this.editMode = false;
    this.selectedUser = null;
  }

  loadRoles(): void {
    this.isLoadingRoles = true;
    this.roleService.getAllRoles(this.roleSearchTerm).subscribe({
      next: (response) => {
        this.roles = response.data;
        this.isLoadingRoles = false;
      },
      error: (error) => {
        console.error('Error loading roles data:', error);
        this.isLoadingRoles = false;
        this.notificationService.showError(
          'Error al cargar roles',
          'No se pudieron cargar los roles. Inténtalo nuevamente.'
        );
      }
    });
  }

  onRoleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.roleSearchTerm = target.value;

    if (this.roleSearchTimeout) {
      clearTimeout(this.roleSearchTimeout);
    }

    this.roleSearchTimeout = setTimeout(() => {
      this.loadRoles();
    }, 500);
  }

  // Métodos para el formulario genérico de usuarios
  onUserCreated(user: User): void {
    this.showForm = false;
    this.editMode = false;
    this.selectedUser = null;
    this.notificationService.showSuccess('Usuario creado', 'El usuario ha sido creado exitosamente');
    // Recargar usuarios del rol actual
    this.loadUsersByRole();
  }

  onUserUpdated(user: User): void {
    this.showForm = false;
    this.editMode = false;
    this.selectedUser = null;
    this.notificationService.showSuccess('Usuario actualizado', 'El usuario ha sido actualizado exitosamente');
    // Recargar usuarios del rol actual
    this.loadUsersByRole();
  }

  onUserDeleted(user: User): void {
    this.showForm = false;
    this.showDetail = false;
    this.editMode = false;
    this.selectedUser = null;
    this.notificationService.showSuccess('Usuario eliminado', 'El usuario ha sido eliminado exitosamente');
    // Recargar usuarios del rol actual
    this.loadUsersByRole();
  }

  // Métodos para editar usuarios de la tabla filtrada
  editUser(user: User): void {
    this.selectedUser = user;
    this.editMode = true;
    this.showForm = true;
    this.showDetail = false;
  }
}
