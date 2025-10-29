import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AccountReceivableService } from '../../../../../core/services/account-receivable.service';
import { SchoolWithPaymentsService } from '../../../../../core/services/school-with-payments.service';
import { Student } from '../../../../../core/models/Student';
import { PaymentModel } from '../../../../../core/models/AccountReceivable';
import { map } from 'rxjs/operators';
import { ResponseAPI } from '../../../../../core/models/ResponseAPI';

class GradeCategory {
  color: string;
  colorName: string;
  gradeRange: string;
  count: number;
  students: Student[];
}

@Component({
  selector: 'app-shirt-colors',
  standalone: true,
  imports: [CommonModule],

  templateUrl: './shirt.color.html'
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
    private router: Router,
    private route: ActivatedRoute,
    private accountReceivableService: AccountReceivableService,
    private schoolWithPaymentsService: SchoolWithPaymentsService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.schoolId = params['schoolId'] || null;
      this.schoolName = params['schoolName'] || null;
      this.loadWillGoStudents();
    });
  }

  loadWillGoStudents(): void {
    this.isLoading = true;

    // Use the same service as list.school component to get accounts with proper filtering
    // This service already filters for: saldo > 0, es_inscripcion = FALSE, and current year
    const currentYear = new Date().getFullYear().toString();

    let accountsQuery;
    if (this.schoolId) {
      // If filtering by specific school
      accountsQuery = this.schoolWithPaymentsService.getAccountsWithPaymentsBySchool(
        this.schoolId,
        1,
        9999,
        currentYear
      );
    } else {
      // Get all accounts
      accountsQuery = this.schoolWithPaymentsService.getAccountsWithPayments(
        1,
        9999,
        '',
        currentYear
      );
    }

    accountsQuery.subscribe({
      next: (response) => {
        if (!response.data) {
          this.isLoading = false;
          return;
        }

        // Apply the same date filtering logic as list.school component
        const todayForDateFilter = new Date();
        todayForDateFilter.setHours(0, 0, 0, 0);

        const filteredAccountsByDate = response.data.filter(account => {
          if (account.fecha_finalizacion) {
            const fechaFinalizacion = new Date(account.fecha_finalizacion);
            fechaFinalizacion.setHours(0, 0, 0, 0);

            // Show only if fecha_finalizacion is today or later (hasn't passed)
            return fechaFinalizacion >= todayForDateFilter;
          }
          // If no fecha_finalizacion, show the account
          return true;
        });

        // Filter the date-filtered accounts for Will-Go courses
        const willGoAccounts = filteredAccountsByDate.filter(account => {
          // Handle different possible structures for curso_id
          const course = account.curso_id;
          let courseName = '';

          if (course) {
            if (typeof course === 'object' && course.nombre) {
              courseName = course.nombre;
            } else if (typeof course === 'string') {
              courseName = course;
            } else if (course.nombre) {
              courseName = course.nombre;
            }
          }

          const isWillGo = courseName && this.isWillGoCourse(courseName);

          return isWillGo;
        });



        // Get unique students from accounts
        const studentsMap = new Map<string, Student>();

        willGoAccounts.forEach(account => {
          // Handle different possible structures for estudiante_id
          let student = null;

          if (account.estudiante_id && typeof account.estudiante_id === 'object') {
            student = account.estudiante_id;
          } else if (account.estudiante_id) {
            // If estudiante_id is just an ID string, we need to construct a basic student object
            student = {
              id: account.estudiante_id,
              nombre: account.nombre || '',
              apellido: account.apellido || '',
              grado: account.grado || '',
              tipo_documento: account.tipo_documento || '',
              numero_documento: account.numero_documento || ''
            };
          }

          if (student && (student.id || account.estudiante_id)) {
            const studentId = student.id || account.estudiante_id;

            // Create a composite key using student ID + name to better handle duplicates
            const compositeKey = `${studentId}_${(student.nombre || '').trim()}_${(student.apellido || '').trim()}`;

            // If we already have this student, keep the most recent account
            const existingStudent = studentsMap.get(compositeKey);
            if (!existingStudent ||
                (account.fecha_inscripcion &&
                 (!existingStudent.accountInfo?.fecha_inscripcion ||
                  new Date(account.fecha_inscripcion) > new Date(existingStudent.accountInfo.fecha_inscripcion)))) {

              // Ensure student has all necessary properties
              student.accountInfo = account;
              student.acudiente = account.cliente_id;
              student.id = studentId;

              // Handle colegio_id assignment from multiple possible sources
              if (!student.colegio_id) {
                student.colegio_id = account.estudiante_id?.colegio_id ||
                                    account.colegio_id ||
                                    { id: account.colegio_id };
              }

              studentsMap.set(compositeKey, student);
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
      'will go (estándar)',
      'will go (segundo hermano)',
      'will go (tercer hermano)',
      'will go',
      'will-go',
      'willgo',
      'will go estándar',
      'will-go estándar',
      'will go segundo hermano',
      'will-go segundo hermano',
      'will go tercer hermano',
      'will-go tercer hermano',
      // Additional variations that might be in the database
      'will go estandar',
      'will-go estandar',
      'curso will go',
      'curso will-go',
      'programa will go',
      'programa will-go'
    ];

    const normalizedName = courseName.toLowerCase().trim()
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .replace(/[()]/g, '') // Remove parentheses for more flexible matching
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove accents for matching

    // Check exact matches first
    if (willGoVariants.some(variant => {
      const normalizedVariant = variant.toLowerCase().replace(/[()]/g, '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return normalizedName === normalizedVariant ||
             normalizedName.includes(normalizedVariant);
    })) {
      return true;
    }

    // More flexible pattern matching for "will go" or "will-go" variants
    const willGoPattern = /will[\s-]*go/i;
    return willGoPattern.test(courseName);
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
      }
    });
  }

  getGradeCategoryIndex(grade: number): number {
    if (grade >= 1 && grade <= 3) return 0;
    if (grade === 4) return 1;
    if (grade === 5) return 2;
    if (grade === 6) return 3;
    if (grade >= 7) return 4;
    return -1;
  }

  getGradeColor(grade: string | undefined): string {
    const gradeNumber = parseInt(grade || '0', 10);
    if (gradeNumber >= 1 && gradeNumber <= 3) return '#FFEB3B';
    if (gradeNumber === 4) return '#FF9800';
    if (gradeNumber === 5) return '#4CAF50';
    if (gradeNumber === 6) return '#F44336';
    if (gradeNumber >= 7) return '#2196F3';
    return '#9E9E9E';
  }

  getGradeColorName(grade: string | undefined): string {
    const gradeNumber = parseInt(grade || '0', 10);
    if (gradeNumber >= 1 && gradeNumber <= 3) return 'yellow';
    if (gradeNumber === 4) return 'orange';
    if (gradeNumber === 5) return 'green';
    if (gradeNumber === 6) return 'red';
    if (gradeNumber >= 7) return 'blue';
    return 'gray';
  }

  onRegresar(): void {
    this.router.navigate(['/private/list-schools']);
  }
}
