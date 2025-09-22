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
import { StudentAccountReceivable, CourseWithStudents } from '../../../../core/models/SchoolModels';

@Component({
  selector: 'app-students-school',
  standalone: true,
  imports: [CommonModule, StudentDetail],
  templateUrl: './students-school.html'
})
export class StudentsSchool implements OnInit, OnDestroy {
  students: Student[] = [];
  school: School | null = null;
  studentAccountsReceivable: StudentAccountReceivable[] = [];
  filteredStudentAccounts: StudentAccountReceivable[] = [];
  coursesWithStudents: CourseWithStudents[] = [];
  filteredCourses: CourseWithStudents[] = [];
  totalAccountsCount: number = 0;
  isLoading = false;
  schoolId: string = '';
  searchTerm = '';
  showDetail = false;
  selectedStudent: Student | null = null;
  showStudentModal = false;
  private searchTimeout: any;

  // Propiedades para estudiantes nuevos hoy
  schoolNewStudentsToday: number = 0;
  schoolNewStudentNames: string[] = [];
  showSchoolNewStudentAlert: boolean = false;

  // Propiedad para controlar el modo de vista
  viewMode: 'accordion' | 'cards' = 'accordion';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private accountReceivableService: AccountReceivableService,
    private notificationService: NotificationService
  ) {}

  goToShirtColor(): void {
    if (this.school) {
      // Pass both id and name for flexibility
      this.router.navigate(['/private/shirt-colors'], {
        queryParams: {
          schoolId: this.school.id,
          schoolName: this.school.nombre
        }
      });
    }
  }

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
    const coursesMap = new Map<string, CourseWithStudents>();

    // Resetear contadores de estudiantes nuevos
    this.schoolNewStudentsToday = 0;
    this.schoolNewStudentNames = [];

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

            // Detectar si es estudiante nuevo hoy con pago mayor a 50,000
            const isNewToday = this.isStudentNewToday(student, studentAccounts);

            const studentAccountReceivable = {
              student: student,
              accountsReceivable: studentAccounts,
              totalAmount: totalAmount,
              totalPending: totalPending
            };

            this.studentAccountsReceivable.push(studentAccountReceivable);

            // Si es estudiante nuevo hoy, agregarlo a los contadores del colegio
            if (isNewToday) {
              this.schoolNewStudentsToday++;
              this.schoolNewStudentNames.push(`${student.nombre} ${student.apellido}`);
            }

            // Agrupar por curso
            studentAccounts.forEach(account => {
              if (account.curso_id && typeof account.curso_id === 'object') {
                const courseId = account.curso_id.id;
                const courseName = account.curso_id.nombre;
                const coursePrice = account.curso_id.precio || '0';
                const courseSku = account.curso_id.sku || '';

                if (!coursesMap.has(courseId)) {
                  coursesMap.set(courseId, {
                    id: courseId,
                    nombre: courseName,
                    precio: coursePrice,
                    sku: courseSku,
                    students: [],
                    expanded: false,
                    totalStudents: 0,
                    totalAccounts: 0,
                    newStudentsToday: 0,
                    newStudentNames: []
                  });
                }

                const course = coursesMap.get(courseId)!;
                // Verificar si el estudiante ya está en este curso
                const existingStudent = course.students.find(s => s.student.id === student.id);
                if (!existingStudent) {
                  course.students.push(studentAccountReceivable);
                  course.totalStudents++;

                  // Si es estudiante nuevo hoy, agregarlo al contador del curso
                  if (isNewToday) {
                    course.newStudentsToday++;
                    course.newStudentNames.push(`${student.nombre} ${student.apellido}`);
                  }
                }
                course.totalAccounts++;
              }
            });
          }
        }
      }
    });

    this.coursesWithStudents = Array.from(coursesMap.values());
    this.filteredCourses = [...this.coursesWithStudents];
    this.filteredStudentAccounts = [...this.studentAccountsReceivable];
    this.updateTotalAccountsCount();

    // Mostrar alerta si hay estudiantes nuevos hoy
    this.showSchoolNewStudentAlert = this.schoolNewStudentsToday > 0;
  }

  isStudentNewToday(student: Student, accounts: AccountReceivable[]): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Verificar si tiene al menos una cuenta con fecha_inscripcion de hoy
    const hasNewInscriptionToday = accounts.some(account => {
      if (account.fecha_inscripcion) {
        const inscriptionDate = new Date(account.fecha_inscripcion);
        inscriptionDate.setHours(0, 0, 0, 0);
        const isInscribedToday = inscriptionDate.getTime() === today.getTime();
        return isInscribedToday;
      }
      return false;
    });

    return hasNewInscriptionToday;
  }

  dismissSchoolNewStudentAlert(): void {
    this.showSchoolNewStudentAlert = false;
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
      this.filteredCourses = [...this.coursesWithStudents];
      return;
    }

    const term = this.searchTerm.toLowerCase().trim();
    this.filteredCourses = this.coursesWithStudents.map(course => {
      const filteredStudents = course.students.filter(studentAccount => {
        const student = studentAccount.student;
        const fullName = `${student.nombre} ${student.apellido}`.toLowerCase();
        const document = `${student.tipo_documento} ${student.numero_documento}`.toLowerCase();

        return fullName.includes(term) ||
               document.includes(term) ||
               student.nombre.toLowerCase().includes(term) ||
               student.apellido.toLowerCase().includes(term) ||
               student.numero_documento.includes(term);
      });

      return {
        ...course,
        students: filteredStudents,
        totalStudents: filteredStudents.length,
        totalAccounts: filteredStudents.reduce((sum, s) => sum + s.accountsReceivable.length, 0)
      };
    }).filter(course => course.students.length > 0 || course.nombre.toLowerCase().includes(term));

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
          this.selectedStudent = student;
          if (account) {
            (this.selectedStudent as any).accountInfo = account;
          }
          this.showStudentModal = true;
        }
      });
    } else {
      this.selectedStudent = student;
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
    this.totalAccountsCount = this.filteredCourses.reduce((total, course) => {
      return total + course.totalAccounts;
    }, 0);
  }

  toggleCourse(courseIndex: number): void {
    this.filteredCourses[courseIndex].expanded = !this.filteredCourses[courseIndex].expanded;
  }

  // Método para cambiar el modo de vista
  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'accordion' ? 'cards' : 'accordion';
  }

  updatePinEntregado(account: any, event: any): void {
    const isChecked = event.target.checked;
    const newValue = isChecked ? 'SI' : 'NO';
    account.pin_entregado = newValue;

    this.accountReceivableService.updateAccountReceivable(account.id, { pin_entregado: newValue })
      .subscribe({
        next: (response) => {
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
