import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../../../../core/models/User';
import { Role } from '../../../../../core/services/role.service';
import { AppButtonComponent } from '../../../../../components/app-button/app-button.component';
import { Roles } from '../../../../../core/const/Roles';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, AppButtonComponent],
  templateUrl: './user-list.html'
})
export class UserList {
  @Input() filteredUsers: User[] = [];
  @Input() isLoading: boolean = false;
  @Input() selectedRole: string = '';
  @Input() rolesList: Role[] = []; // Para obtener el nombre del rol
  @Input() schools: { [key: number]: string } = {};
  
  @Output() editUser = new EventEmitter<User>();

  protected readonly roles = Roles;

  getRoleName(roleId: string): string {
    const role = this.rolesList.find(r => r.id === roleId);
    return role ? role.name : 'Usuario';
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

  onEditUser(user: User): void {
    this.editUser.emit(user);
  }
}
