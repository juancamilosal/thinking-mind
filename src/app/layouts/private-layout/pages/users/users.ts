import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { forkJoin, of, Observable } from 'rxjs';
import { switchMap, map, catchError, shareReplay, startWith } from 'rxjs/operators';
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
import { AppButtonComponent } from '../../../../components/app-button/app-button.component';


@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, FormRector, RectorDetail, FormAdmin, AdminDetail, FormUser, AppButtonComponent],
  templateUrl: './users.html'
})
export class Users implements OnInit {
  selectedRole = '';
  showForm = false;
  showDetail = false;
  editMode = false;
  roleCounts: { [key: string]: Observable<number> } = {};
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
    private roleService: RoleService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    // Solo cargar roles al inicio
    this.loadRoles();
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
        
        // Mantener compatibilidad con arrays específicos
        if (this.selectedRole === 'a4ed6390-5421-46d1-b81e-5cad06115abc') { // rector
          this.rectores = this.filteredUsers;
        } else if (this.selectedRole === 'ca89252c-6b5c-4f51-a6e4-34ab4d0e2a02') { // administrador
          this.admins = this.filteredUsers;
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading users by role:', error);
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
    this.showForm = false;
    this.showDetail = false;
    this.editMode = false;
    this.selectedRector = null;
    this.selectedAdmin = null;
    this.selectedUser = null;

    // Limpiar datos anteriores
    this.filteredUsers = [];
    this.rectores = [];
    this.admins = [];

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
    this.showDetail = false;
    this.editMode = false;
    this.selectedRector = null;
    this.selectedAdmin = null;
    this.selectedUser = null;
    
    // Cargar colegios solo cuando se abre el formulario Y el rol seleccionado es rector
    if (this.showForm && this.selectedRole === 'a4ed6390-5421-46d1-b81e-5cad06115abc') {
      this.loadSchools();
    }
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
    
    // Cargar colegios cuando se va a editar
    this.loadSchools();
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedRector = null;
    this.selectedAdmin = null;
    this.selectedUser = null;
  }

  onRectorCreated(rector: User) {
    this.showForm = false;
    this.editMode = false;
    this.selectedRector = null;
    this.notificationService.showSuccess('Rector creado', 'El rector ha sido creado exitosamente');
    // Recargar usuarios del rol actual
    this.loadUsersByRole();
  }

  onRectorUpdated(rector: User) {
    this.showForm = false;
    this.editMode = false;
    this.selectedRector = null;
    this.notificationService.showSuccess('Rector actualizado', 'El rector ha sido actualizado exitosamente');
    // Recargar usuarios del rol actual
    this.loadUsersByRole();
  }

  onRectorDeleted(rector: User) {
    this.showForm = false;
    this.showDetail = false;
    this.editMode = false;
    this.selectedRector = null;
    this.notificationService.showSuccess('Rector eliminado', 'El rector ha sido eliminado exitosamente');
    // Recargar usuarios del rol actual
    this.loadUsersByRole();
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
    
    // No cargar colegios para administradores
    // this.loadSchools();
  }

  createAdmin() {
    this.selectedAdmin = null;
    this.editMode = false;
    this.showForm = true;
    this.showDetail = false;
    
    // No cargar colegios para administradores
    // this.loadSchools();
  }

  onAdminCreated(admin: User) {
    this.showForm = false;
    this.editMode = false;
    this.selectedAdmin = null;
    this.notificationService.showSuccess('Administrador creado', 'El administrador ha sido creado exitosamente');
    // Recargar usuarios del rol actual
    this.loadUsersByRole();
  }

  onAdminUpdated(admin: User) {
    this.showForm = false;
    this.editMode = false;
    this.selectedAdmin = null;
    this.notificationService.showSuccess('Administrador actualizado', 'El administrador ha sido actualizado exitosamente');
    // Recargar usuarios del rol actual
    this.loadUsersByRole();
  }

  onAdminDeleted(admin: User) {
    this.showForm = false;
    this.showDetail = false;
    this.editMode = false;
    this.selectedAdmin = null;
    this.notificationService.showSuccess('Administrador eliminado', 'El administrador ha sido eliminado exitosamente');
    // Recargar usuarios del rol actual
    this.loadUsersByRole();
  }



  closeForm() {
    this.showForm = false;
    this.editMode = false;
    this.selectedRector = null;
    this.selectedAdmin = null;
    this.selectedUser = null;
  }

  loadRoles(): void {
    this.isLoading = true;
    this.roleService.getAllRoles().subscribe({
      next: (response) => {
        this.roles = response.data;
        this.isLoading = false;
        
        // Configurar observables para cada rol
        this.roles.forEach(role => {
          this.roleCounts[role.id] = this.userService.getUsersCountByRole(role.id).pipe(
            map(res => (res?.meta?.filter_count ?? res?.meta?.total_count) || 0),
            catchError(err => {
              console.error(`Error loading count for role ${role.id}`, err);
              return of(0);
            }),
            startWith(0), // Valor inicial inmediato
            shareReplay(1) // Cachear el último valor
          );
        });
      },
      error: (error) => {
        console.error('Error loading roles data:', error);
        this.isLoading = false;
        this.notificationService.showError(
          'Error al cargar roles',
          'No se pudieron cargar los roles. Inténtalo nuevamente.'
        );
      }
    });
  }

  loadRoleCounts(): void {
    // Método obsoleto, reemplazado por la lógica en loadRoles
  }

  loadAllUsers(): void {
    this.isLoading = true;
    this.userService.getAllUsers().subscribe({
      next: (response) => {
        this.allUsers = response.data || [];
        // Actualizar la lista filtrada después de cargar todos los usuarios
        if (this.selectedRole) {
          this.filteredUsers = this.allUsers.filter(user => user.role === this.selectedRole);
        }
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
    
    // Cargar colegios solo si el usuario es rector
    if (user.role === 'a4ed6390-5421-46d1-b81e-5cad06115abc') {
      this.loadSchools();
    }
  }
}
