import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AccountReceivableService } from '../../../../../core/services/account-receivable.service';
import { Student } from '../../../../../core/models/Student';
import { PaymentModel } from '../../../../../core/models/AccountReceivable';
import { map } from 'rxjs/operators';
import { ResponseAPI } from '../../../../../core/models/ResponseAPI';

interface GradeCategory {
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
    private accountReceivableService: AccountReceivableService
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
