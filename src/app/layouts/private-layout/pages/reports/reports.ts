import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { REPORT_TYPE } from '../../../../core/const/ReportType';
import { PaymentModel } from '../../../../core/models/AccountReceivable';
import { PaymentService } from '../../../../core/services/payment.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import {SchoolService} from '../../../../core/services/school.service';
import { AbstractControl, ValidationErrors } from '@angular/forms';

@Component({
  selector: 'app-reports',
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './reports.html',
  standalone: true
})

export class Reports {
  reportForm!: FormGroup;
  REPORT_TYPE = REPORT_TYPE;
  payments: PaymentModel[] = [];
  enrollReportData: any[] = [];
  reportGenerated: boolean = false;
  showDownloadOptions: boolean = false;
  schoolsData: any[] = [];
  loadingSchoolsData: boolean = false;

  // Propiedades de paginación para Cartera
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 15, 20, 50];
  Math = Math; // Para usar Math.min en el template

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private notificationService: NotificationService,
    private paymentService: PaymentService,
    private accountReceivableService: AccountReceivableService,
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm=(): void => {
    this.reportForm = this.fb.group({
      reportType: ['', [Validators.required]],
      startDate: [null],
      endDate: [null],
    }, { validators: this.dateRangeValidator });
  }

  onReportTypeChange(event: any) {
    const reportType = event.target.value;
    if (reportType === 'INSCRIPCIONES') {
      this.reportGenerated = true; // Mostrar la sección de resultados
      this.generateEnrollReport();
    } else if (reportType === 'CARTERA') {
      this.reportGenerated = true; // Mostrar la sección de resultados
      this.generatePaymentsReport(); // Sin fechas, trae todos los datos
      this.totalPayments();
    } else {
      this.reportGenerated = false; // Ocultar la sección de resultados si no es INSCRIPCIONES o CARTERA
      this.schoolsData = []; // Limpiar datos anteriores
      this.payments = []; // Limpiar datos de pagos
    }
  }

  // Función para generar el reporte basado en el tipo seleccionado
  generateReport(): void {
    const reportType = this.reportForm.get('reportType')?.value;

    if (!reportType) {
      this.notificationService.showWarning('Por favor, selecciona un tipo de reporte.', '');
      return;
    }

    this.reportGenerated = true;
    const { startDate, endDate } = this.reportForm.value;

    switch (reportType) {
    case 'CARTERA':
      this.generatePaymentsReport(startDate, endDate);
      break;
    case 'INSCRIPCIONES':
      this.generateEnrollReport(startDate, endDate);
      break;
    default:
      this.notificationService.showError('Tipo de reporte no válido.');
      this.reportGenerated = false;
    }
  }

  // Generar reporte de pagos
  private generatePaymentsReport(startDate?: string, endDate?: string): void {
    this.loadPaymentsPage(startDate, endDate);
  }

  private loadPaymentsPage(startDate?: string, endDate?: string): void {
    // Usar el servicio con filtros de Directus y paginación
    this.paymentService.getPayments(this.currentPage, this.itemsPerPage, undefined, startDate, endDate).subscribe({
      next: (response) => {
        this.payments = response.data;
        this.totalItems = response.meta?.filter_count || 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
      },
      error: (error) => {
        console.error('Error loading payments:', error);

        if (error.status === 401) {
          this.notificationService.showError(
            'Sesión expirada',
            'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
          );
        } else {
          this.notificationService.showError(
            'Error al cargar pagos',
            'No se pudieron cargar los datos de pagos. Inténtalo nuevamente.'
          );
        }
        this.payments = [];
        this.totalItems = 0;
        this.totalPages = 0;
      }
    });
  }



  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPaymentsPage();
    }
  }

  onItemsPerPageChange(event: any): void {
    this.itemsPerPage = parseInt(event.target.value);
    this.currentPage = 1;
    this.loadPaymentsPage();
  }

  getPaginationArray(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  calculateTotal(): number {
  return this.payments
    .filter(payment => payment.estado === 'PAGADO')
    .reduce((total, payment) => {
      const valorNeto = parseFloat(payment.valor_neto?.toString() || '0') || 0;
      return total + valorNeto;
    }, 0);
  }

// Generar reporte de inscripciones dentro del rango de fechas
private generateEnrollReport(startDate?: string, endDate?: string): void {
  this.loadingSchoolsData = true;
  this.accountReceivableService.getAccountsForReport(startDate, endDate).subscribe({
    next: (response) => {
      if (response && response.data && Array.isArray(response.data)) {
        // Agrupar datos por colegio y curso
        const schoolsMap = new Map<string, any>();

        response.data.forEach((item: any) => {
          const schoolName = item.colegio;

          if (!schoolsMap.has(schoolName)) {
            schoolsMap.set(schoolName, {
              id: schoolName,
              colegio: schoolName,
              cursos: new Map<string, any>(),
              expanded: false
            });
          }

          const school = schoolsMap.get(schoolName);

          item.cursos.forEach((curso: any) => {
            const courseId = curso.id;

            if (!school.cursos.has(courseId)) {
              school.cursos.set(courseId, {
                id: courseId,
                curso: curso.nombre,
                precio: curso.precio,
                sku: courseId,
                estudiantes: [],
                nuevos_hoy: 0,
                total_estudiantes: 0,
                expanded: false
              });
            }

            const courseData = school.cursos.get(courseId);

            // Agregar estudiante al curso
            const student = {
              id: curso.estudiante.id,
              nombre: curso.estudiante.nombre,
              apellido: curso.estudiante.apellido,
              tipo_documento: curso.estudiante.tipo_documento,
              numero_documento: curso.estudiante.numero_documento,
              fecha_creacion: curso.fecha_inscripcion,
              fecha_inscripcion: curso.fecha_inscripcion,
              saldo: curso.saldo
            };

            courseData.estudiantes.push(student);
            courseData.total_estudiantes = courseData.estudiantes.length;

            // Verificar si es estudiante nuevo hoy
            if (this.isStudentNewToday(student)) {
              courseData.nuevos_hoy++;
            }
          });
        });

        // Convertir Map a Array y agrupar cursos WILL-GO
        this.schoolsData = Array.from(schoolsMap.values()).map(school => {
          const cursosArray = Array.from(school.cursos.values()) as any[];
          const cursosAgrupados = this.groupWillGoCourses(cursosArray);

          return {
            ...school,
            cursos: cursosAgrupados
          };
        });

        // Comentado: No mostrar notificaciones modales
        // this.checkAndNotifyNewStudentsSimple();

      } else {
        console.error('Estructura de datos inesperada:', response);
        this.schoolsData = [];
      }

      this.loadingSchoolsData = false;
    },
    error: (error) => {
      console.error('Error al cargar datos de colegios:', error);
      this.notificationService.showError('Error al cargar los datos de inscripciones');
      this.loadingSchoolsData = false;
    }
  });
}

  clearForm(): void {
    this.reportForm.reset();
    this.payments = [];
    this.enrollReportData = [];
    this.schoolsData = [];
    this.reportGenerated = false;
    this.showDownloadOptions = false;
    this.loadingSchoolsData = false;
    // Reset pagination
    this.currentPage = 1;
    this.totalItems = 0;
    this.totalPages = 0;
  }

  navigateToPresupuesto(): void {
    this.router.navigate(['/private/presupuesto']);
  }

  // Método para agrupar cursos WILL-GO
  private groupWillGoCourses(cursos: any[]): any[] {
    const willGoVariants = ['WILL-GO (Estándar)', 'WILL-GO (Segundo hermano)', 'WILL-GO (Tercer hermano)', 'Will-Go'];
    const willGoCourses: any[] = [];
    const otherCourses: any[] = [];

    // Separar cursos WILL-GO de otros cursos
    cursos.forEach(curso => {
      const isWillGo = willGoVariants.some(variant =>
        curso.curso.toLowerCase().includes(variant.toLowerCase()) ||
        curso.curso.toLowerCase().includes('will-go') ||
        curso.curso.toLowerCase().includes('will go')
      );

      if (isWillGo) {
        willGoCourses.push(curso);
      } else {
        otherCourses.push(curso);
      }
    });

    // Si hay cursos WILL-GO, agruparlos
    if (willGoCourses.length > 0) {
      const groupedWillGo: any = {
        id: 'will-go-grouped',
        nombre: 'WILL - GO', // Agregado para Course
        codigo: 'WILL-GO', // Agregado para Course
        precio: willGoCourses[0].precio, // Usar el precio del primer curso
        sku: 'will-go-grouped',
        curso: 'WILL - GO',
        estudiantes: [],
        nuevos_hoy: 0,
        total_estudiantes: 0,
        expanded: false
      };

      // Combinar todos los estudiantes de los cursos WILL-GO
      willGoCourses.forEach(curso => {
        groupedWillGo.estudiantes.push(...curso.estudiantes);
        groupedWillGo.nuevos_hoy += curso.nuevos_hoy;
      });

      // Actualizar el total de estudiantes
      groupedWillGo.total_estudiantes = groupedWillGo.estudiantes.length;

      // Retornar otros cursos + el curso WILL-GO agrupado
      return [...otherCourses, groupedWillGo];
    }

    // Si no hay cursos WILL-GO, retornar todos los cursos como estaban
    return cursos;
  }

  toggleSchool(schoolIndex: number): void {
    this.schoolsData[schoolIndex].expanded = !this.schoolsData[schoolIndex].expanded;
  }

  toggleCourse(schoolIndex: number, courseIndex: number): void {
    this.schoolsData[schoolIndex].cursos[courseIndex].expanded = !this.schoolsData[schoolIndex].cursos[courseIndex].expanded;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Método para verificar si hay estudiantes nuevos hoy en un colegio
  hasNewStudentsToday(school: any): boolean {
    return school.cursos.some(curso => curso.nuevos_hoy > 0);
  }

  // Método para obtener el total de estudiantes nuevos hoy en un colegio
  getTotalNewStudentsToday(school: any): number {
    return school.cursos.reduce((total, curso) => total + curso.nuevos_hoy, 0);
  }

  // Método para verificar y notificar sobre nuevos estudiantes hoy (versión simple)
  checkAndNotifyNewStudentsSimple(): void {
    this.schoolsData.forEach(school => {
      const hasNewStudents = this.hasNewStudentsToday(school);
      if (hasNewStudents) {
        this.notificationService.showSuccess(
          `¡Nuevos estudiantes en ${school.colegio}!`,
          `Hay estudiantes nuevos inscritos hoy en este colegio.`
        );
      }
    });
  }

  // Método para verificar si un estudiante se inscribió hoy
  isStudentNewToday(student: any): boolean {
    if (!student.fecha_inscripcion) {
      return false;
    }

    // Usar solo la parte de la fecha (YYYY-MM-DD) para evitar problemas de zona horaria
    const today = new Date();
    const todayString = today.getFullYear() + '-' +
                       String(today.getMonth() + 1).padStart(2, '0') + '-' +
                       String(today.getDate()).padStart(2, '0');

    const isToday = student.fecha_inscripcion === todayString;
    return isToday;
  }

  // Método para obtener el total de estudiantes en un colegio
  getTotalStudentsInSchool(school: any): number {
    return school.cursos.reduce((total, curso) => total + curso.total_estudiantes, 0);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Bogota'
    }); // Esto devuelve DD/MM/YYYY
  }

  getStatusColor(estado: string): string {
    switch (estado) {
      case 'PAGADO':
      case 'Completado':
        return 'bg-green-100 text-green-800';
      case 'PENDIENTE':
      case 'Pendiente':
        return 'bg-orange-100 text-orange-800';
      case 'RECHAZADO':
      case 'RECHAZADA':
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusArrow(estado: number): string {
    switch (estado) {
      case 1:
        return '↑';
      case 2:
        return '↑';
      default:
        return '';
    }
  }

  toggleDownloadOptions(): void {
    this.showDownloadOptions = !this.showDownloadOptions;
  }

  downloadPDF(): void {
    this.showDownloadOptions = false;
    // TODO: Implement PDF download logic
    this.notificationService.showSuccess('Descargando reporte en PDF...','');
  }

  //Descargar Excel Inscripciones
  async downloadExcelIns(): Promise<void> {
    try {
      // Lazy load ExcelJS
      const ExcelJS = await import('exceljs');

      // Crear un nuevo libro de trabajo
      const workbook = new ExcelJS.Workbook();

      // Calcular totales
      const totalCourses = this.schoolsData.reduce((sum, school) => sum + school.cursos.length, 0);
      const totalStudents = this.schoolsData.reduce((sum, school) =>
        sum + school.cursos.reduce((courseSum, course) => courseSum + course.total_estudiantes, 0), 0
      );
      const totalNewToday = this.schoolsData.reduce((sum, school) =>
        sum + school.cursos.reduce((courseSum, course) => courseSum + course.nuevos_hoy, 0), 0
      );

      // Crear hoja de resumen
      const summarySheet = workbook.addWorksheet('Resumen');

      // Agregar datos de resumen
      summarySheet.addRow(['REPORTE DE INSCRIPCIONES POR COLEGIO Y CURSO']);
      summarySheet.addRow(['Fecha de generación:', new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })]);
      summarySheet.addRow(['']); // Línea vacía
      summarySheet.addRow(['RESUMEN GENERAL']);
      summarySheet.addRow(['Total de Colegios:', this.schoolsData.length]);
      summarySheet.addRow(['Total de Programas:', totalCourses]);
      summarySheet.addRow(['Total de Estudiantes:', totalStudents]);
      summarySheet.addRow(['Nuevos Estudiantes Hoy:', totalNewToday]);

      // Estilo para el título
      summarySheet.getCell('A1').font = { bold: true, size: 14 };
      summarySheet.getCell('A1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2F5597' }
      };
      summarySheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };

      // Crear hoja detallada
      const detailedSheet = workbook.addWorksheet('Detalle Completo');

      // Agregar título principal
      const titleRow = detailedSheet.addRow(['DETALLE COMPLETO POR COLEGIO']);
      titleRow.getCell(1).font = { bold: true, size: 16 };
      titleRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2F5597' }
      };
      titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      detailedSheet.addRow(['']); // Línea vacía

      // Agregar datos agrupados por colegio
      this.schoolsData.forEach(school => {
        // Calcular totales del colegio
        const totalStudentsInSchool = this.getTotalStudentsInSchool(school);
        const totalNewTodayInSchool = this.getTotalNewStudentsToday(school);
        const hasNewToday = totalNewTodayInSchool > 0;
        const statusIcon = hasNewToday ? '↑' : '=';

        // Agregar nombre del colegio con totales e icono
        const schoolInfo = `${school.colegio} | Total estudiantes: ${totalStudentsInSchool} | Nuevos hoy: ${totalNewTodayInSchool} ${statusIcon}`;
        const schoolTitleRow = detailedSheet.addRow([schoolInfo]);
        schoolTitleRow.getCell(1).font = { bold: true, size: 14 };
        schoolTitleRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE7E6E6' }
        };
        schoolTitleRow.getCell(1).font = { bold: true, size: 14, color: hasNewToday ? { argb: 'FF006100' } : { argb: 'FF808080' } };

        // Agregar encabezados para este colegio (sin SKU, precio, total estudiantes, nuevos hoy)
        const headers = [
          'Curso', 'Nombre Estudiante', 'Apellido Estudiante',
          'Tipo Documento', 'Número Documento', 'Fecha Inscripción', 'Nuevo Hoy'
        ];
        const headerRow = detailedSheet.addRow(headers);

        // Estilo para encabezados
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
          };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center' };
        });

        // Agregar cursos y estudiantes de este colegio
        school.cursos.forEach(course => {
          if (course.estudiantes && course.estudiantes.length > 0) {
            course.estudiantes.forEach(student => {
              const row = detailedSheet.addRow([
                course.curso,
                student.nombre,
                student.apellido,
                student.tipo_documento,
                student.numero_documento,
                student.fecha_creacion ? new Date(student.fecha_creacion).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : 'N/A',
                this.isStudentNewToday(student) ? 'SÍ' : 'NO'
              ]);

              // Aplicar color verde a estudiantes nuevos hoy
              if (this.isStudentNewToday(student)) {
                row.eachCell((cell) => {
                  cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFC6EFCE' } // Verde claro
                  };
                  cell.font = { color: { argb: 'FF006100' } }; // Verde oscuro para el texto
                });
              }
            });
          } else {
            // Si no hay estudiantes, mostrar solo la información del curso
            detailedSheet.addRow([
              course.curso,
              'Sin estudiantes',
              '',
              '',
              '',
              '',
              ''
            ]);
          }
        });

        // Agregar línea vacía entre colegios
        detailedSheet.addRow(['']);
      });

      // Crear una hoja por colegio
      this.schoolsData.forEach(school => {
        // Limpiar el nombre del colegio para usarlo como nombre de hoja
        const sheetName = school.colegio.replace(/[\[\]\*\/\\?:]/g, '').substring(0, 31);
        const schoolSheet = workbook.addWorksheet(sheetName);

        // Calcular totales del colegio
        const totalStudentsInSchool = this.getTotalStudentsInSchool(school);
        const totalNewTodayInSchool = this.getTotalNewStudentsToday(school);
        const hasNewToday = totalNewTodayInSchool > 0;
        const statusIcon = hasNewToday ? '↑' : '=';

        // Título del colegio con totales e icono
        const schoolTitle = `COLEGIO: ${school.colegio} | Total estudiantes: ${totalStudentsInSchool} | Nuevos hoy: ${totalNewTodayInSchool} ${statusIcon}`;
        const titleRow = schoolSheet.addRow([schoolTitle]);
        titleRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2F5597' }
        };
        titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleRow.getCell(1).alignment = { horizontal: 'center' };

        // Línea vacía
        schoolSheet.addRow(['']);

        // Encabezados (sin SKU, Total Estudiantes, Nuevos Hoy)
        const schoolHeaders = [
          'Curso', 'Precio',
          'Nombre Estudiante', 'Apellido', 'Tipo Doc', 'Número Doc', 'Fecha Inscripción'
        ];
        const schoolHeaderRow = schoolSheet.addRow(schoolHeaders);

        // Estilo para encabezados
        schoolHeaderRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
          };
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.alignment = { horizontal: 'center' };
        });

        // Agregar datos de cursos y estudiantes
        school.cursos.forEach(course => {
          if (course.estudiantes && course.estudiantes.length > 0) {
            course.estudiantes.forEach((student, index) => {
              const row = schoolSheet.addRow([
                index === 0 ? course.curso : '', // Solo mostrar el nombre del curso en la primera fila
                index === 0 ? course.precio : '',
                student.nombre,
                student.apellido,
                student.tipo_documento,
                student.numero_documento,
                student.fecha_creacion ? new Date(student.fecha_creacion).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : 'N/A'
              ]);

              // Aplicar color verde a estudiantes nuevos hoy
              if (this.isStudentNewToday(student)) {
                row.eachCell((cell) => {
                  cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFC6EFCE' } // Verde claro
                  };
                  cell.font = { color: { argb: 'FF006100' } }; // Verde oscuro para el texto
                });
              }
            });
          } else {
            schoolSheet.addRow([
              course.curso,
              course.precio,
              'Sin estudiantes inscritos',
              '',
              '',
              '',
              ''
            ]);
          }
          schoolSheet.addRow(['']); // Línea vacía entre cursos
        });
      });

      // Generar el archivo y descargarlo
      const fileName = `Reporte_Inscripciones_${new Date().toISOString().split('T')[0]}.xlsx`;

      workbook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        window.URL.revokeObjectURL(url);

        this.notificationService.showSuccess(
          'Excel descargado exitosamente',
          `El archivo ${fileName} se ha descargado correctamente.`
        );
      });

    } catch (error) {
      console.error('Error al generar Excel:', error);
      this.notificationService.showError(
        'Error al generar Excel',
        'No se pudo generar el archivo Excel. Inténtalo nuevamente.'
      );
    }
  }

  //Descargar Excel Cartera
  async downloadExcelCart(): Promise<void> {
    try{
      // Lazy load ExcelJS
      const ExcelJS = await import('exceljs');

      const workBook = new ExcelJS.Workbook();
      const worksheet = workBook.addWorksheet('Reporte de Cartera');

  // Get date range
  const startDate = this.formatDate(this.reportForm.value.startDate);
  const endDate = this.formatDate(this.reportForm.value.endDate);

  // Set up columns with widths
  worksheet.columns = [
    { header: 'Pagador', key: 'pagador', width: 30 },
    { header: 'Valor', key: 'valor', width: 20 },
    { header: 'Fecha de Pago', key: 'fecha_pago', width: 20 },
    { header: 'Estado', key: 'estado', width: 15 }
  ];

  // Add title row
  worksheet.mergeCells('A1:D1');
  const titleRow = worksheet.getRow(1);
  titleRow.values = ['Reporte de Cartera'];
  titleRow.font = { size: 16, bold: true, color: { argb: 'FF7C3AED' } }; // Purple color
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 30;

  // Add date range row
  worksheet.mergeCells('A2:D2');
  const dateRow = worksheet.getRow(2);
  dateRow.values = [`Período: ${startDate} - ${endDate}`];
  dateRow.font = { size: 12, italic: true };
  dateRow.alignment = { horizontal: 'center', vertical: 'middle' };
  dateRow.height = 25;

  // Add empty row
  worksheet.addRow([]);

  // Add header row (row 4)
  const headerRow = worksheet.getRow(4);
  headerRow.values = ['Pagador', 'Valor', 'Fecha de Pago', 'Estado'];
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7C3AED' } // Purple background
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 25;

  // Add borders to header
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add payment data
  let currentRow = 5;
  this.payments.forEach((payment, index) => {
    const row = worksheet.getRow(currentRow);
    row.values = [
      payment.pagador,
      payment.valor,
      this.formatDate(payment.fecha_pago),
      payment.estado
    ];

    // Format valor column as currency
    row.getCell(2).numFmt = '"$"#,##0.00';
    row.getCell(2).value = payment.valor; // Set as number, not string

    // Style based on status
    const statusCell = row.getCell(4);
    if (payment.estado === 'PAGADO') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1FAE5' } // Light green
      };
      statusCell.font = { color: { argb: 'FF065F46' }, bold: true }; // Dark green
    } else if (payment.estado === 'PENDIENTE') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' } // Light yellow
      };
      statusCell.font = { color: { argb: 'FF92400E' }, bold: true }; // Dark orange
    }

    // Add borders to all cells in the row
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle' };
    });

    currentRow++;
  });

  // Add empty row before total
  worksheet.addRow([]);
  currentRow++;

  // Add total row
  const totalRow = worksheet.getRow(currentRow);
  const total = this.calculateTotal();

  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  totalRow.getCell(1).value = 'Total Recaudado:';
  totalRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(4).value = total;
  totalRow.getCell(4).numFmt = '"$"#,##0.00';

  totalRow.font = { bold: true, size: 12 };
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' } // Gray background
  };
  totalRow.height = 25;

  // Add borders to total row
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'double' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Generate Excel file
  const fileName = `Reporte_Cartera_${new Date().toISOString().split('T')[0]}.xlsx`;

  workBook.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        window.URL.revokeObjectURL(url);
  this.notificationService.showSuccess(
          'Excel descargado exitosamente',
          `El archivo ${fileName} se ha descargado correctamente.`
        );
    });
  } catch (error) {
      console.error('Error al generar Excel:', error);
      this.notificationService.showError(
        'Error al generar Excel',
        'No se pudo generar el archivo Excel. Inténtalo nuevamente.'
      );
    }
  }


  //Validación rango de fechas
  dateRangeValidator(control: AbstractControl): ValidationErrors | null {
  const start = control.get('startDate');
  const end = control.get('endDate');

  if (start?.value && end?.value) {
    const startDate = new Date(start.value);
    const endDate = new Date(end.value);

    if (startDate > endDate) {
      return { dateRange: true };
    }
  }
  return null;
}

  formatPaymentMethod(method: string): string {
    if (method === 'CARD') {
      return 'TARJETA';
    }
    if (method === 'BANCOLOMBIA_TRANSFER') {
      return 'TRANSFERENCIA BANCOLOMBIA';
    }
    if (method === 'BANCOLOMBIA_COLLECT') {
      return 'CORRESPONSAL BANCARIO';
    }
    return method;
  }

  totalPayments(){
    this.paymentService.totalPayment().subscribe()
  }
}
