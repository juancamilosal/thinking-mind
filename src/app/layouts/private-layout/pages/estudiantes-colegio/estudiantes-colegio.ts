import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentService } from '../../../../core/services/student.service';
import { SchoolService } from '../../../../core/services/school.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import { Student } from '../../../../core/models/Student';
import { School } from '../../../../core/models/School';
import { AccountReceivable } from '../../../../core/models/AccountReceivable';
import { Client } from '../../../../core/models/Clients';
import { NotificationService } from '../../../../core/services/notification.service';
import { StudentDetail } from '../students/student-detail/student-detail';

interface StudentAccountReceivable {
  student: Student;
  accountsReceivable: AccountReceivable[];
  totalAmount: number;
  totalPending: number;
}

@Component({
  selector: 'app-estudiantes-colegio',
  standalone: true,
  imports: [CommonModule, StudentDetail],
  templateUrl: './estudiantes-colegio.html'
})
export class EstudiantesColegio implements OnInit, OnDestroy {
  students: Student[] = [];
  school: School | null = null;
  studentAccountsReceivable: StudentAccountReceivable[] = [];
  filteredStudentAccounts: StudentAccountReceivable[] = [];
  totalAccountsCount: number = 0;
  isLoading = false;
  schoolId: string = '';
  searchTerm = '';
  showDetail = false;
  selectedStudent: Student | null = null;
  showStudentModal = false;
  private searchTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private accountReceivableService: AccountReceivableService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.schoolId = params['schoolId'];
      if (this.schoolId) {
        this.loadSchoolInfo();
        this.loadStudents();
      }
    });
  }

  loadSchoolInfo(): void {
    this.schoolService.getSchoolById(this.schoolId).subscribe({
      next: (response) => {
        this.school = response.data;
      },
      error: (error) => {
        this.notificationService.showError(
          'Error',
          'Error al cargar la información del colegio'
        );
      }
    });
  }

  loadStudents(): void {
    this.isLoading = true;
    if (this.school && this.school.estudiante_id) {
      this.students = this.school.estudiante_id;
      this.processStudentAccountsReceivable();
      this.isLoading = false;
    } else {
      this.studentService.getStudentsBySchool(this.schoolId).subscribe({
        next: (response) => {
          this.students = response.data;
          this.processStudentAccountsReceivable();
          this.isLoading = false;
        },
        error: (error) => {
          this.notificationService.showError(
            'Error',
            'Error al cargar los estudiantes del colegio'
          );
          this.isLoading = false;
        }
      });
    }
  }

  processStudentAccountsReceivable(): void {
    this.studentAccountsReceivable = [];
    
    this.students.forEach(student => {
      if (student.acudiente && typeof student.acudiente === 'object') {
        const client = student.acudiente as Client;
        if (client.cuentas_cobrar && client.cuentas_cobrar.length > 0) {
          const studentAccounts = client.cuentas_cobrar.filter(account => 
            account.estudiante_id === student.id
          ).map(account => ({
            ...account,
            pin_entregado: account.pin_entregado || 'NO'
          }));
          
          if (studentAccounts.length > 0) {
            const totalAmount = studentAccounts.reduce((sum, account) => sum + account.monto, 0);
            const totalPending = studentAccounts.filter(account => account.estado === 'PENDIENTE').length;
            
            this.studentAccountsReceivable.push({
              student: student,
              accountsReceivable: studentAccounts,
              totalAmount: totalAmount,
              totalPending: totalPending
            });
          }
        }
      }
    });
    
    this.filteredStudentAccounts = [...this.studentAccountsReceivable];
    this.updateTotalAccountsCount();
  }

  onSearchInputChange(event: any): void {
    this.searchTerm = event.target.value;
    
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    this.searchTimeout = setTimeout(() => {
      this.searchStudents();
    }, 500);
  }

  searchStudents(): void {
    if (!this.searchTerm.trim()) {
      this.filteredStudentAccounts = [...this.studentAccountsReceivable];
      return;
    }

    const term = this.searchTerm.toLowerCase().trim();
    this.filteredStudentAccounts = this.studentAccountsReceivable.filter(studentAccount => {
      const student = studentAccount.student;
      const fullName = `${student.nombre} ${student.apellido}`.toLowerCase();
      const document = `${student.tipo_documento} ${student.numero_documento}`.toLowerCase();
      
      return fullName.includes(term) || 
             document.includes(term) ||
             student.nombre.toLowerCase().includes(term) ||
             student.apellido.toLowerCase().includes(term) ||
             student.numero_documento.includes(term);
    });
    this.updateTotalAccountsCount();
  }

  onSearch(): void {
    this.searchStudents();
  }

  viewStudent(student: Student, account?: any): void {
    // Cargar información completa del estudiante
    if (student.id) {
      this.studentService.getStudentById(student.id).subscribe({
        next: (response) => {
          this.selectedStudent = response.data;
          // Agregar la información de la cuenta si está disponible
          if (account) {
            (this.selectedStudent as any).accountInfo = account;
          }
          this.showStudentModal = true;
        },
        error: (error) => {
          // Si falla la carga completa, usar los datos disponibles
          this.selectedStudent = student;
          // Agregar la información de la cuenta si está disponible
          if (account) {
            (this.selectedStudent as any).accountInfo = account;
          }
          this.showStudentModal = true;
        }
      });
    } else {
      this.selectedStudent = student;
      // Agregar la información de la cuenta si está disponible
      if (account) {
        (this.selectedStudent as any).accountInfo = account;
      }
      this.showStudentModal = true;
    }
  }

  closeStudentModal(): void {
    this.showStudentModal = false;
    this.selectedStudent = null;
  }

  closeDetail(): void {
    this.showDetail = false;
    this.selectedStudent = null;
  }

  editStudent(student: Student): void {
    this.closeDetail();
  }

  goBack(): void {
    this.router.navigate(['/private/list-schools']);
  }

  updateTotalAccountsCount(): void {
    this.totalAccountsCount = this.filteredStudentAccounts.reduce((total, studentAccount) => {
      return total + studentAccount.accountsReceivable.length;
    }, 0);
  }

  updatePinEntregado(account: any, event: any): void {
    const isChecked = event.target.checked;
    const newValue = isChecked ? 'SI' : 'NO';
    account.pin_entregado = newValue;

    this.accountReceivableService.updateAccountReceivable(account.id, { pin_entregado: newValue })
      .subscribe({
        next: (response) => {
          // Sin notificación modal
        },
        error: (error) => {
          console.error('Error updating pin_entregado:', error);
          account.pin_entregado = isChecked ? 'NO' : 'SI';
          this.notificationService.showError('Error', 'No se pudo actualizar el estado del PIN');
        }
      });
  }

  isPinEntregado(account: any): boolean {
    return account.pin_entregado === 'SI' || account.pin_entregado === true;
  }

  getPinEntregadoText(account: any): string {
    return this.isPinEntregado(account) ? 'SI' : 'NO';
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }
}