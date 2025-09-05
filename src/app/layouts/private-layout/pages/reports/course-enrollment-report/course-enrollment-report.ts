import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

interface CourseEnrollmentData {
  courseId: string;
  courseName: string;
  coursePrice: string;
  accountsCount: number;
  totalEnrolledAmount: number;
  newStudentsToday: number;
  newStudentNames: string[];
  accounts: {
    accountId: string;
    studentName?: string;
    clientName?: string;
    amount: number;
    balance: number;
    paymentDate: string;
    paymentMethod: string;
    approvalNumber: string;
    isNewToday?: boolean;
  }[];
}

interface EnrollmentSummary {
  totalCourses: number;
  totalAccounts: number;
  totalEnrolledAmount: number;
  courses: CourseEnrollmentData[];
  newStudentsToday: number;
  newStudentNames: string[];
}

@Component({
  selector: 'app-course-enrollment-report',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './course-enrollment-report.html'
})
export class CourseEnrollmentReport implements OnInit {
  enrollmentData: EnrollmentSummary | null = null;
  loading: boolean = false;
  budgetData: any = null;
  showNewStudentAlert: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Obtener datos del estado de navegación o parámetros
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state) {
      this.budgetData = navigation.extras.state['budgetData'];
      this.generateEnrollmentReport();
    }
  }

  private generateEnrollmentReport(): void {
    if (!this.budgetData || !this.budgetData.listado_pagos) {
      return;
    }

    this.loading = true;
    
    // Filtrar solo pagos con estado PAGADO y que tengan cuenta_cobrar_id con curso
    const paidPayments = this.budgetData.listado_pagos.filter((pago: any) => 
      pago.estado === 'PAGADO' && 
      pago.cuenta_cobrar_id && 
      pago.cuenta_cobrar_id.curso_id &&
      pago.cuenta_cobrar_id.estado === 'PAGADA'
    );

    // Detectar estudiantes nuevos registrados hoy
    const today = new Date().toISOString().split('T')[0];
    const newStudentsToday = new Set<string>();
    
    // Agrupar por curso
    const courseMap = new Map<string, CourseEnrollmentData>();

    paidPayments.forEach((pago: any) => {
      const cuenta = pago.cuenta_cobrar_id;
      const curso = cuenta.curso_id;
      const estudiante = cuenta.estudiante_id;
      
      // Verificar si el estudiante es nuevo hoy (creado hoy con pago > 50,000)
      const isNewToday = estudiante && estudiante.created_at && 
        new Date(estudiante.created_at).toISOString().split('T')[0] === today &&
        pago.valor > 50000;
      
      if (isNewToday) {
        newStudentsToday.add(estudiante.id);
      }
      
      if (!courseMap.has(curso.id)) {
        courseMap.set(curso.id, {
          courseId: curso.id,
          courseName: curso.nombre,
          coursePrice: this.formatCurrency(parseFloat(curso.precio)),
          accountsCount: 0,
          totalEnrolledAmount: 0,
          newStudentsToday: 0,
          newStudentNames: [],
          accounts: []
        });
      }

      const courseData = courseMap.get(curso.id)!;
      courseData.accountsCount++;
      courseData.totalEnrolledAmount += pago.valor;
      
      // Si es estudiante nuevo, agregarlo a la lista del curso
      if (isNewToday && !courseData.newStudentNames.includes(`${estudiante.nombre || 'N/A'} ${estudiante.apellido || ''}`.trim())) {
        courseData.newStudentsToday++;
        courseData.newStudentNames.push(`${estudiante.nombre || 'N/A'} ${estudiante.apellido || ''}`.trim());
      }
      
      courseData.accounts.push({
        accountId: cuenta.id,
        studentName: `${cuenta.estudiante_id?.nombre || 'N/A'} ${cuenta.estudiante_id?.apellido || ''}`.trim(),
        clientName: `${cuenta.cliente_id?.nombre || 'N/A'} ${cuenta.cliente_id?.apellido || ''}`.trim(),
        amount: cuenta.monto,
        balance: cuenta.saldo,
        paymentDate: pago.fecha_pago,
        paymentMethod: pago.metodo_pago,
        approvalNumber: pago.numero_aprobacion,
        isNewToday: isNewToday
      });
    });

    // Convertir Map a array y calcular totales
    const courses = Array.from(courseMap.values());
    
    // Calcular totales globales de estudiantes nuevos
    const totalNewStudents = newStudentsToday.size;
    const allNewStudentNames = Array.from(newStudentsToday).map(studentId => {
      // Buscar el nombre del estudiante en los pagos
      const pago = paidPayments.find(p => p.cuenta_cobrar_id?.estudiante_id?.id === studentId);
      if (pago && pago.cuenta_cobrar_id?.estudiante_id) {
        const estudiante = pago.cuenta_cobrar_id.estudiante_id;
        return `${estudiante.nombre || 'N/A'} ${estudiante.apellido || ''}`.trim();
      }
      return 'N/A';
    });
    
    this.enrollmentData = {
      totalCourses: courses.length,
      totalAccounts: courses.reduce((sum, course) => sum + course.accountsCount, 0),
      totalEnrolledAmount: courses.reduce((sum, course) => sum + course.totalEnrolledAmount, 0),
      courses: courses.sort((a, b) => a.courseName.localeCompare(b.courseName)),
      newStudentsToday: totalNewStudents,
      newStudentNames: allNewStudentNames
    };

    // Mostrar alerta si hay estudiantes nuevos hoy
    this.showNewStudentAlert = totalNewStudents > 0;

    this.loading = false;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  goBack(): void {
    this.router.navigate(['/private/reports/budget-report'], {
      queryParams: {
        anio: this.budgetData?.anio,
        presupuesto: this.budgetData?.monto_meta,
        id: this.budgetData?.id
      }
    });
  }

  private detectNewStudentsToday(paidPayments: any[]): { newStudentsCount: number, newStudentNames: string[] } {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const newStudentsToday = new Set<string>();
    const newStudentNames: string[] = [];
    
    paidPayments.forEach((pago: any) => {
      const cuenta = pago.cuenta_cobrar_id;
      const estudiante = cuenta.estudiante_id;
      
      if (estudiante && estudiante.created_at) {
        const studentCreatedDate = new Date(estudiante.created_at).toISOString().split('T')[0];
        
        if (studentCreatedDate === todayString && !newStudentsToday.has(estudiante.id)) {
          newStudentsToday.add(estudiante.id);
          const studentName = `${estudiante.nombre || 'N/A'} ${estudiante.apellido || ''}`.trim();
          newStudentNames.push(studentName);
        }
      }
    });
    
    return {
      newStudentsCount: newStudentsToday.size,
      newStudentNames: newStudentNames
    };
  }

  dismissNewStudentAlert(): void {
    this.showNewStudentAlert = false;
  }

  exportReport(): void {
    if (!this.enrollmentData) return;

    let csvContent = "Curso,Precio del Curso,Cuentas Inscritas,Monto Total Inscrito\n";
    
    this.enrollmentData.courses.forEach(course => {
      csvContent += `"${course.courseName}","${course.coursePrice}",${course.accountsCount},"${this.formatCurrency(course.totalEnrolledAmount)}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `informe-cursos-inscritos-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}