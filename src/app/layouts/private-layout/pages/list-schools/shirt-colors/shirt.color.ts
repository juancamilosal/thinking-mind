import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AccountReceivableService } from '../../../../../core/services/account-receivable.service';
import { Student } from '../../../../../core/models/Student';
import { PaymentModel } from '../../../../../core/models/AccountReceivable';
import { map } from 'rxjs/operators';
import { ResponseAPI } from '../../../../../core/models/ResponseAPI';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { StudentService } from '../../../../../core/services/student.service';
import { CourseService } from '../../../../../core/services/course.service';
import { AccountReceivableService } from '../../../../../core/services/account-receivable.service';
import { Student } from '../../../../../core/models/Student';
import { Course } from '../../../../../core/models/Course';
import { Client } from '../../../../../core/models/Clients';
import { AccountReceivable } from '../../../../../core/models/AccountReceivable';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';


interface GradeCategory {
  gradeRange: string;
  colorName: string;
  color: string;
  count: number;
}

@Component({
  selector: 'app-shirt-colors',
  templateUrl: './shirt.color.html',
  standalone: true,
  imports: [CommonModule]
})

export class ShirtColor implements OnInit {
  gradeCategories: GradeCategory[] = [];
  isLoading = true;
  schoolId: string | null = null;
  schoolName: string | null = null;
  private _willGoStudents: Student[] = [];

  get willGoStudents(): Student[] {
    return this._willGoStudents;
  }

  constructor(
    private studentService: StudentService,
    private courseService: CourseService,
    private accountReceivableService: AccountReceivableService,
    private route: ActivatedRoute,
    private accountReceivableService: AccountReceivableService,
    private router: Router

  ) {}

  ngOnInit(): void {
    this.loadStudents();
  }


  loadWillGoStudents(): void {
    this.isLoading = true;

    const accountsQuery = this.accountReceivableService.getAllAccountsReceivable().pipe(
      map((response: ResponseAPI<any>) => {
        if (!response.data) return response;

        // Filter by school if schoolId is provided
        if (this.schoolId) {
          return {
            ...response,
            data: response.data.filter(account =>
              account.estudiante_id?.colegio_id?.id === this.schoolId
            )
          };
        }

        return response;
      })
    );

    accountsQuery.subscribe({
      next: (response) => {
        if (!response.data) {
          this.isLoading = false;
          return;
        }

        // Filter accounts for Will-Go courses
        const willGoAccounts = response.data.filter(account => {
          const courseName = account.curso_id?.nombre;
          return account.curso_id &&
                 typeof account.curso_id === 'object' &&
                 courseName &&
                 this.isWillGoCourse(courseName);
        });

        // Get unique students from accounts
        const studentsMap = new Map<string, Student>();

        willGoAccounts.forEach(account => {
          if (account.estudiante_id && typeof account.estudiante_id === 'object') {
            const student = account.estudiante_id;
            if (student.id) {
              // If we already have this student, keep the most recent account
              const existingStudent = studentsMap.get(student.id);
              if (!existingStudent ||
                  (account.fecha_inscripcion &&
                   (!existingStudent.accountInfo?.fecha_inscripcion ||
                    new Date(account.fecha_inscripcion) > new Date(existingStudent.accountInfo.fecha_inscripcion)))) {
                student.accountInfo = account;
                student.acudiente = account.cliente_id;
                studentsMap.set(student.id, student);
              }
            }
          }
        });

        this._willGoStudents = Array.from(studentsMap.values());
        this.processWillGoStudents();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  private getTotalPaid(pagos: PaymentModel[]): number {
    return pagos?.reduce((sum, pago) => sum + (pago.valor || 0), 0) || 0;
  }

  private calculateEnrollmentStatus(student: Student): string {
    const account = student.accountInfo;
    if (!account) {
      return 'Sin cuenta';
    }

    const validInscription = typeof account.fecha_inscripcion === 'string' &&
                            account.fecha_inscripcion.trim() !== '' &&
                            !isNaN(Date.parse(account.fecha_inscripcion));

    if (!validInscription) {
      return 'Sin inscripción';
    }

    const totalPaid = this.getTotalPaid(account.pagos || []);

    if (validInscription && account.estado === 'PAGADA') {
      return 'Inscrito';
    } else if (totalPaid >= 50000) {
      return 'Preinscrito';
    } else {
      return 'Pendiente';
    }
  }

  getEnrollmentStatus(student: Student): string {
    // Return cached status if available
    const cachedStatus = (student as any).enrollmentStatus;
    if (cachedStatus) {
      return cachedStatus;
    }

    // Calculate and cache the status
    const status = this.calculateEnrollmentStatus(student);
    (student as any).enrollmentStatus = status;
    return status;
  }

  private isWillGoCourse(courseName: string): boolean {
    if (!courseName) return false;

    const willGoVariants = [
      'will-go(estándar)',
      'will-go(segundo hermano)',
      'will-go(tercer hermano)',
      'will - go(estándar)',
      'will - go(segundo hermano)',
      'will - go(tercer hermano)',
      'will-go (estándar)',
      'will-go (segundo hermano)',
      'will-go (tercer hermano)',
      'will go',
      'will-go'
    ];

    const normalizedName = courseName.toLowerCase().trim();
    return willGoVariants.some(variant =>
      normalizedName.includes(variant) ||
      normalizedName === variant
    );
  }

  private processWillGoStudents(): void {
    // Pre-calculate enrollment status for all students
    this._willGoStudents.forEach(student => {
      student['enrollmentStatus'] = this.calculateEnrollmentStatus(student);
    });

    const getGradeNumber = (student: Student): number => {
      if (!student.grado) return 0;

      const gradeMatch = student.grado.match(/^\d+/);
      if (!gradeMatch) return 0;

      const grade = parseInt(gradeMatch[0], 10);
      return isNaN(grade) ? 0 : grade;
    };

    // Sort students by grade
    this._willGoStudents.sort((a, b) => {
      const gradeA = getGradeNumber(a);
      const gradeB = getGradeNumber(b);
      return gradeA - gradeB;
    });

    // Initialize grade categories
    this.gradeCategories = [
      { color: '#FFEB3B', colorName: 'amarillo', gradeRange: '1-3', count: 0, students: [] },
      { color: '#FF9800', colorName: 'naranja', gradeRange: '4', count: 0, students: [] },
      { color: '#4CAF50', colorName: 'verde', gradeRange: '5', count: 0, students: [] },
      { color: '#F44336', colorName: 'rojo', gradeRange: '6', count: 0, students: [] },
      { color: '#2196F3', colorName: 'azul', gradeRange: '7+', count: 0, students: [] }
    ];

    // Group students by grade category
    this.willGoStudents.forEach(student => {
      const gradeNumber = getGradeNumber(student);
      if (gradeNumber > 0) {
        const categoryIndex = this.getGradeCategoryIndex(gradeNumber);
        if (categoryIndex !== -1) {
          const category = this.gradeCategories[categoryIndex];
          category.students.push(student);
          category.count++;
        }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private isWillGoCourse(courseName: string): boolean {
    if (!courseName) {
      return false;
    }

    const willGoVariants = [
      'will-go(estándar)',
      'will-go(segundo hermano)',
      'will-go(tercer hermano)',
      'will - go(estándar)',
      'will - go(segundo hermano)',
      'will - go(tercer hermano)',
      'will-go (estándar)',
      'will-go (segundo hermano)',
      'will-go (tercer hermano)',
      'will go',
      'will-go'
    ];

    const normalizedName = courseName.toLowerCase().trim();
    return willGoVariants.some(variant =>
      normalizedName.includes(variant) ||
      normalizedName === variant
    );
  }

  onRegresar(): void {
    this.router.navigate(['/private/list-schools']);
  }

  getGradeColor(grade: string | undefined): string {
    if (!grade) return '#9E9E9E'; // Gray for undefined or empty grade

    // Extract the numeric part of the grade
    const numericGrade = parseInt(grade.replace(/[^0-9]/g, ''));

    if (isNaN(numericGrade)) return '#9E9E9E'; // Gray for invalid grade

    // New color scheme based on numeric grade
    if (numericGrade >= 1 && numericGrade <= 3) {
      return '#FFD700'; // Yellow for grades 1-3
    } else if (numericGrade === 4) {
      return '#FF9800'; // Orange for grade 4
    } else if (numericGrade === 5) {
      return '#4CAF50'; // Green for grade 5
    } else if (numericGrade === 6) {
      return '#F44336'; // Red for grade 6
    } else if (numericGrade >= 7) {
      return '#2196F3'; // Blue for grade 7 and above
    }

    return '#9E9E9E'; // Gray default
  }

  getGradeColorName(grade: string | undefined): string {
    if (!grade) return 'gray';

    // Extract the numeric part of the grade
    const numericGrade = parseInt(grade.replace(/[^0-9]/g, ''));

    if (isNaN(numericGrade)) return 'gray';

    // Color names based on numeric grade
    if (numericGrade >= 1 && numericGrade <= 3) {
      return 'yellow';
    } else if (numericGrade === 4) {
      return 'orange';
    } else if (numericGrade === 5) {
      return 'green';
    } else if (numericGrade === 6) {
      return 'red';
    } else if (numericGrade >= 7) {
      return 'blue';
    }

    return 'gray';
  }

  private updateGradeCategories(): void {
    // Map to store counts by numeric grade
    const gradeCounts = new Map<string, number>();

    // Count students by normalized grade number
    this.willGoStudents.forEach(student => {
      const grade = student.grado || 'No asignado';
      if (grade === 'No asignado') {
        gradeCounts.set(grade, (gradeCounts.get(grade) || 0) + 1);
        return;
      }

      // Extract the numeric part of the grade
      const match = grade.match(/\d+/);
      if (match) {
        const numericGrade = `Grado ${match[0]}`; // Convert to "Grado X" format
        gradeCounts.set(numericGrade, (gradeCounts.get(numericGrade) || 0) + 1);
      } else {
        gradeCounts.set(grade, (gradeCounts.get(grade) || 0) + 1);
      }
    });

    // Convert to GradeCategory array
    this.gradeCategories = Array.from(gradeCounts.entries())
      .map(([grade, count]) => ({
        gradeRange: grade,
        colorName: this.getGradeColorName(grade),
        color: this.getGradeColor(grade),
        count
      }))
      .sort((a, b) => {
        // Extract numbers for sorting
        const aMatch = a.gradeRange.match(/\d+/);
        const bMatch = b.gradeRange.match(/\d+/);

        // Handle special case for "No asignado"
        if (a.gradeRange === 'No asignado') return 1;
        if (b.gradeRange === 'No asignado') return -1;

        // Sort numerically if both have numbers
        if (aMatch && bMatch) {
          return parseInt(aMatch[0]) - parseInt(bMatch[0]);
        }
        return a.gradeRange.localeCompare(b.gradeRange);
      });
  }

  loadStudents(): void {
    this.loading = true;
    this.willGoStudents = [];
    this.willGoCourses = [];
    this.statusCache.clear();
    this.gradeCategories = [];

    const accountsSub = this.accountReceivableService.searchAccountReceivable()
      .subscribe({
        next: (response) => {
            if (!response.data) {
            console.warn('No accounts data in response');
            this.loading = false;
            return;
          }

          // Filter accounts with inscription date
          const accountsWithInscription = response.data.filter(account =>
            account.curso_id &&
            typeof account.curso_id === 'object' &&
            this.isWillGoCourse(account.curso_id.nombre || '')
          );

          // Get unique students from accounts
          const studentsMap = new Map<string, Student>();
          const courseIds = new Set<string>();

          accountsWithInscription.forEach(account => {
            if (account.estudiante_id && typeof account.estudiante_id === 'object') {
              const student = account.estudiante_id;
              studentsMap.set(student.id.toString(), student);
            }
            if (account.curso_id && typeof account.curso_id === 'object') {
              courseIds.add(account.curso_id.id);
            }
          });

          this.willGoStudents = Array.from(studentsMap.values());

          // Process each student
          this.willGoStudents.forEach(student => {

            // Find all accounts for this student
            const studentAccounts = accountsWithInscription.filter(acc =>
              acc.estudiante_id &&
              typeof acc.estudiante_id === 'object' &&
              acc.estudiante_id.id === student.id
            );

            const status = this.calculateStatusFromAccounts(studentAccounts);
            this.statusCache.set(student.id.toString(), status);
          });

          // Store courses for reference
          this.willGoCourses = accountsWithInscription
            .filter(acc => acc.curso_id && typeof acc.curso_id === 'object')
            .map(acc => acc.curso_id)
            .filter((course, index, self) =>
              index === self.findIndex(c => c.id === course.id)
            );

          this.updateGradeCategories();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error fetching accounts:', error);
          this.loading = false;
        }
      });

    this.subscriptions.push(accountsSub);
  }

  private calculateStatusFromAccounts(accounts: AccountReceivable[]): string {
    try {
      if (!accounts || accounts.length === 0) {
        return 'Sin cuenta';
      }

      // Check if any account is fully paid with inscription date
      const hasInscribed = accounts.some(account =>
        account.estado === 'PAGADA' &&
        account.fecha_inscripcion?.trim()
      );

      if (hasInscribed) {
        return 'Inscrito';
      }

      // Check if any account has at least 50000 paid
      const hasPreInscription = accounts.some(account => {
        const totalPaid = this.getTotalPaid(account.pagos);
        return totalPaid >= 50000;
      });

      if (hasPreInscription) {
        return 'Preinscrito';
      }

      return 'Pendiente';
    } catch (error) {
      console.error('Error calculating status from accounts:', error);
      return 'Sin estado';
    }
  }  calculateEnrollmentStatus(student: Student): string {
    try {


      if (!student.acudiente || typeof student.acudiente === 'string') {

        return 'Sin estado';
      }

      const acudiente = student.acudiente as Client;
      if (!acudiente.cuentas_cobrar || !Array.isArray(acudiente.cuentas_cobrar)) {

        return 'Sin estado';
      }

      // Find all accounts for this student that are Will-Go courses
      const willGoAccounts = acudiente.cuentas_cobrar.filter(acc => {
        const matchesStudent = acc.estudiante_id === student.id;
        const matchesCourse = this.willGoCourses.some(course => course.id === acc.curso_id?.id);

        return matchesStudent && matchesCourse;
      });


      if (willGoAccounts.length === 0) {
        return 'Sin cuenta';
      }

      // If there are multiple accounts, use the one with the most favorable status
      for (const account of willGoAccounts) {
        // If any account is fully paid and has inscription date, student is enrolled
        if (account.estado === 'PAGADA' &&
            typeof account.fecha_inscripcion === 'string' &&
            account.fecha_inscripcion.trim() !== '') {
          return 'Inscrito';
        }
      }

      // Check if any account has at least 50000 paid
      for (const account of willGoAccounts) {
        const totalPaid = this.getTotalPaid(account.pagos);
        if (totalPaid >= 50000) {
          return 'Preinscrito';
        }
      }

      // If we get here, student has an account but hasn't paid enough
      return 'Pendiente';
    } catch (error) {
      console.error('Error calculating enrollment status:', error);
      return 'Sin estado';
    }
  }

  private getTotalPaid(payments: any[] | undefined): number {
    if (!payments || !Array.isArray(payments)) {
      return 0;
    }
    return payments.reduce((total, payment) => {
      const amount = typeof payment.monto === 'number' ? payment.monto : 0;
      return total + amount;
    }, 0);
  }  getStatusClass(student: Student): string {
    const status = this.statusCache.get(student.id.toString());
    switch (status) {
      case 'Inscrito': return 'status-inscrito';
      case 'Preinscrito': return 'status-preinscrito';
      case 'Pendiente': return 'status-pendiente';
      case 'Sin cuenta': return 'status-sin-cuenta';
      default: return 'status-sin-estado';
    }
  }

  getStatus(student: Student): string {
    return this.statusCache.get(student.id.toString()) || 'Sin estado';
  }
}
