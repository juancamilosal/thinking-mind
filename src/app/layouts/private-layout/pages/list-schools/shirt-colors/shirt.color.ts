import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { StudentService } from '../../../../../core/services/student.service';
import { Student } from '../../../../../core/models/Student';
import { Client } from '../../../../../core/models/Clients';
import { AccountReceivable, PaymentModel } from '../../../../../core/models/AccountReceivable';


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
  willGoStudents: Student[] = [];
  gradeCategories: GradeCategory[] = [];
  isLoading = true;
  schoolId: string | null = null;
  schoolName: string | null = null;
  private statusCache: Map<string, string> = new Map();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private studentService: StudentService
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
    this.studentService.getStudentsByCourseName('WILL-GO').subscribe({
      next: (response) => {
        if (response.data && Array.isArray(response.data)) {
          let students = response.data;
          // Filter by schoolId if present
          if (this.schoolId) {
            const sid = String(this.schoolId);
            students = students.filter((student: any) => {
              // Prefer colegio_id as object, then as string, then school_id, then school?.id
              const colegioObjId = student.colegio_id && typeof student.colegio_id === 'object' ? student.colegio_id.id : undefined;
              const colegioStrId = student.colegio_id && typeof student.colegio_id === 'string' ? student.colegio_id : undefined;
              const schoolId = student.school_id;
              const schoolObjId = student.school && typeof student.school === 'object' ? student.school.id : undefined;
              return (
                String(colegioObjId) === sid ||
                String(colegioStrId) === sid ||
                String(schoolId) === sid ||
                String(schoolObjId) === sid
              );
            });
          }
          this.willGoStudents = students;
          this.processWillGoStudents();
        } else {
          console.error('No students data received or invalid format');
          this.willGoStudents = [];
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching WILL-GO students:', err);
        this.isLoading = false;
      }
    });
  }

  private getAccountCourseId(curso_id: any): string {
    return typeof curso_id === 'string' ? curso_id : curso_id?.id;
  }

  private getTotalPaid(pagos: PaymentModel[]): number {
    return pagos?.reduce((sum, pago) => sum + (pago.valor || 0), 0) || 0;
  }

  getEnrollmentStatus(student: Student): string {
    const cacheKey = `${student.id}-${student.curso_id?.id}`;
    const cachedStatus = this.statusCache.get(cacheKey);
    if (cachedStatus) {
      return cachedStatus;
    }
    const acudiente = student.acudiente;
    if (!acudiente || typeof acudiente === 'string') {
      this.statusCache.set(cacheKey, 'Sin estado');
      return 'Sin estado';
    }
    const clientAcudiente = acudiente as Client;
    if (!clientAcudiente.cuentas_cobrar || !Array.isArray(clientAcudiente.cuentas_cobrar)) {
      this.statusCache.set(cacheKey, 'Sin estado');
      return 'Sin estado';
    }
    const studentCourseId = student.curso_id?.id;
    if (!studentCourseId) {
      this.statusCache.set(cacheKey, 'Sin estado');
      return 'Sin estado';
    }
    const account = clientAcudiente.cuentas_cobrar.find((acc: AccountReceivable) => {
      const accountCourseId = this.getAccountCourseId(acc.curso_id);
      return accountCourseId === studentCourseId && acc.estudiante_id === student.id;
    });
    if (!account) {
      this.statusCache.set(cacheKey, 'Sin cuenta');
      return 'Sin cuenta';
    }
    const totalPaid = this.getTotalPaid(account.pagos);
    const totalAmount = account.monto || 0;
    let status: string;
    const hasValidFechaInscripcion = typeof account.fecha_inscripcion === 'string' && account.fecha_inscripcion.trim() !== '' && !isNaN(Date.parse(account.fecha_inscripcion));
    if (hasValidFechaInscripcion && account.estado === 'PAGADA') {
      status = 'Inscrito';
    } else if (totalPaid >= 50000) {
      status = 'Preinscrito';
    } else {
      status = 'Pendiente';
    }
    this.statusCache.set(cacheKey, status);
    return status;
  }

  processWillGoStudents(): void {
    const getGradeNumber = (gradeString: string | undefined): number => {
      if (!gradeString) return 0;
      const grade = parseInt(gradeString, 10);
      return isNaN(grade) ? 0 : grade;
    };
    this.willGoStudents.sort((a, b) => {
      const gradeA = getGradeNumber(a.grado);
      const gradeB = getGradeNumber(b.grado);
      return gradeA - gradeB;
    });
    this.gradeCategories = [
      { color: '#FFEB3B', colorName: 'amarillo', gradeRange: '1-3', count: 0, students: [] },
      { color: '#FF9800', colorName: 'naranja', gradeRange: '4', count: 0, students: [] },
      { color: '#4CAF50', colorName: 'verde', gradeRange: '5', count: 0, students: [] },
      { color: '#F44336', colorName: 'rojo', gradeRange: '6', count: 0, students: [] },
      { color: '#2196F3', colorName: 'azul', gradeRange: '7+', count: 0, students: [] }
    ];
    this.willGoStudents.forEach(student => {
      const gradeNumber = getGradeNumber(student.grado);
      if (gradeNumber > 0) {
        const categoryIndex = this.getGradeCategoryIndex(gradeNumber);
        if (categoryIndex !== -1) {
          this.gradeCategories[categoryIndex].students.push(student);
          this.gradeCategories[categoryIndex].count++;
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
