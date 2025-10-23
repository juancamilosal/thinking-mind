import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormRector } from './rector/form-rector/form-rector';
import { RectorDetail } from './rector/rector-detail/rector-detail';
import { FormAdmin } from './admin/form-admin/form-admin';
import { AdminDetail } from './admin/admin-detail/admin-detail';
import { FormUser } from './form-user/form-user';
import { UserService } from '../../../../core/services/user.service';
import { SchoolService } from '../../../../core/services/school.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RoleService, Role } from '../../../../core/services/role.service';
import { User } from '../../../../core/models/User';


@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, FormRector, RectorDetail, FormAdmin, AdminDetail, FormUser],
  templateUrl: './users.html'
})
export class Users implements OnInit {
  selectedRole = '';
  showForm = false;
  showDetail = false;
  editMode = false;
  selectedRector: User | null = null;
  selectedAdmin: User | null = null;
  selectedUser: User | null = null;
  rectores: User[] = [];
  admins: User[] = [];
  allUsers: User[] = [];
  roles: Role[] = [];
  filteredUsers: User[] = [];
  isLoading = false;
  searchTerm = '';
  schools: { [key: number]: string } = {};
  private searchTimeout: any;

  constructor(
    private userService: UserService,
    private schoolService: SchoolService,
    private notificationService: NotificationService,
    private roleService: RoleService
  ) {}

  ngOnInit(): void {
    this.loadSchools();
    this.loadRoles();
    this.loadAllUsers();
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

  getSchoolName(schoolId: number | string): string {
    const id = typeof schoolId === 'string' ? parseInt(schoolId, 10) : schoolId;
    return this.schools[id] || 'N/A';
  }

  getRoleName(roleId: string): string {
    const role = this.roles.find(r => r.id === roleId);
    return role ? role.name : 'Usuario';
  }

  getSelectedRole(): Role | null {
    return this.roles.find(r => r.id === this.selectedRole) || null;
  }

  onRoleChange(): void {
    this.showForm = false;
    this.showDetail = false;
    this.editMode = false;
    this.selectedRector = null;
    this.selectedAdmin = null;

    // Filtrar usuarios según el rol seleccionado
    if (this.selectedRole) {
      this.filteredUsers = this.allUsers.filter(user => user.role === this.selectedRole);
    } else {
      this.filteredUsers = [];
    }

    // Mantener compatibilidad con el código existente
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
    this.selectedUser = null;
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
    this.selectedUser = null;
  }

  onRectorCreated(rector: User) {
    this.showForm = false;
    this.selectedRector = null;
    // Refrescar la tabla de rectores desde el servidor
    this.loadRectores();
  }

  onRectorUpdated(rector: User) {
    this.showForm = false;
    this.editMode = false;
    this.selectedRector = null;
    // Refrescar la tabla de rectores desde el servidor
    this.loadRectores();
  }

  onRectorDeleted(rector: User) {
    this.selectedRector = null;
    this.showForm = false;
    // Refrescar la tabla de rectores desde el servidor
    this.loadRectores();
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
    this.showForm = false;
    this.selectedAdmin = null;
    // Refrescar la tabla de administradores desde el servidor
    this.loadAdministradores();
  }

  onAdminUpdated(admin: User) {
    this.showForm = false;
    this.selectedAdmin = null;
    this.editMode = false;
    // Refrescar la tabla de administradores desde el servidor
    this.loadAdministradores();
  }

  onAdminDeleted(admin: User) {
    this.selectedAdmin = null;
    this.showForm = false;
    this.showDetail = false;
    this.editMode = false;
    // Refrescar la tabla de administradores desde el servidor
    this.loadAdministradores();
  }



  closeForm() {
    this.showForm = false;
    this.editMode = false;
    this.selectedRector = null;
    this.selectedAdmin = null;
    this.selectedUser = null;
  }

  loadRoles(): void {
    this.roleService.getAllRoles().subscribe({
      next: (response) => {
        this.roles = response.data;
      },
      error: (error) => {
        console.error('Error loading roles:', error);
        this.notificationService.showError(
          'Error al cargar roles',
          'No se pudieron cargar los roles. Inténtalo nuevamente.'
        );
      }
    });
  }

  loadAllUsers(): void {
    this.isLoading = true;
    this.userService.getAllUsers().subscribe({
      next: (response) => {
        this.allUsers = response.data || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading all users:', error);
        this.notificationService.showError('Error', 'No se pudieron cargar todos los usuarios');
        this.isLoading = false;
      }
    });
  }

  // Métodos para el formulario genérico de usuarios
  onUserCreated(user: User): void {
    this.showForm = false;
    this.selectedUser = null;
    // Recargar la lista de usuarios filtrados
    this.onRoleChange();
  }

  onUserUpdated(user: User): void {
    this.showForm = false;
    this.editMode = false;
    this.selectedUser = null;
    // Recargar la lista de usuarios filtrados
    this.onRoleChange();
  }

  onUserDeleted(user: User): void {
    this.selectedUser = null;
    this.showForm = false;
    // Recargar la lista de usuarios filtrados
    this.onRoleChange();
  }

  // Métodos para editar usuarios de la tabla filtrada
  editUser(user: User): void {
    this.selectedUser = user;
    this.editMode = true;
    this.showForm = true;
    this.showDetail = false;
  }
}
