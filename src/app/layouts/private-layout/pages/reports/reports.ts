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
import * as ExcelJS from 'exceljs';
import { start } from 'repl';
import { AbstractControl, ValidationErrors } from '@angular/forms';

interface EnrollReportData {
  schoolName: string;
  courseName: string;
  studentCount: number;
}

interface SchoolData {
  id: string;
  colegio: string;
  cursos: CourseData[];
  expanded?: boolean;
}

interface CourseData {
  id: string;
  curso: string;
  precio: string;
  sku: string;
  estudiantes: StudentData[];
  nuevos_hoy: number;
  total_estudiantes: number;
  expanded?: boolean;
}

interface StudentData {
  id: string;
  nombre: string;
  apellido: string;
  tipo_documento: string;
  numero_documento: string;
  fecha_creacion: string | null;
  fecha_inscripcion: string | null;
  saldo: number;
}

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
  enrollReportData: EnrollReportData[] = [];
  reportGenerated: boolean = false;
  showDownloadOptions: boolean = false;
  schoolsData: SchoolData[] = [];
  loadingSchoolsData: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private paymentService: PaymentService,
    private accountReceivableService: AccountReceivableService,
    private schoolService: SchoolService,
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

  // Función para generar el reporte basado en el tipo seleccionado
  generateReport(): void {
     if (this.reportForm.invalid) {
    this.notificationService.showWarning('Por favor, selecciona un tipo de reporte.', '');
    return;
    }
    this.reportGenerated = true;
    const { reportType, startDate, endDate } = this.reportForm.value;

    switch (reportType) {
    case 'CARTERA':
      this.generatePaymentsReport(startDate, endDate);
      break;
    case 'INSCRIPCIONES':
      this.loadSchoolsData();
      break;
    default:
      this.notificationService.showError('Tipo de reporte no válido.');
      this.reportGenerated = false;
    }
  }

  // Generar reporte de pagos
  private  generatePaymentsReport(startDate: string, endDate: string): void {
    this.paymentService.getPayments().subscribe({
      next: (data) => {
        this.payments = data.data.filter(payment => {
        const paymentDate = new Date(payment.fecha_pago);
        const start = new Date(startDate + 'T00:00:00Z');
        const end = new Date(endDate + 'T23:59:59.999Z');

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        return paymentDate >= start && paymentDate <= end;
      });
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
      }
    });
  }

  calculateTotal(): number {
  return this.payments
    .filter(payment => payment.estado === 'PAGADO')
    .reduce((total, payment) => total + payment.valor, 0);
  }

// Generar reporte de inscripciones dentro del rango de fechas
private generateEnrollReport(startDate: string, endDate: string): void {
  this.accountReceivableService.getAccountsForReport().subscribe({
    next: (response: any) => {
      const rawData = response.data || response;
      const paidAccounts = rawData.filter((account: any) => {
        if (!account.estudiante_id || typeof account.estudiante_id === 'string') return false;
        if (!account.pagos || account.pagos.length === 0) return false;

        return account.pagos.some((payment: any) => {
          const paymentDate = new Date(payment.fecha_pago);
          const start = new Date(startDate + 'T00:00:00Z');
          const end = new Date(endDate + 'T23:59:59.999Z');
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);

          return payment.estado === 'PAGADO' &&
                 paymentDate >= start &&
                 paymentDate <= end;
        });
      });

      const aggregationMap = new Map<string, EnrollReportData>();

      for (const account of paidAccounts) {
        const schoolName = account.estudiante_id?.colegio_id?.nombre ||
                          account.estudiante_id?.colegio_id?.nombre_colegio ||
                          'Sin Colegio';

        const courseName = account.curso_id?.nombre || 'Sin Curso';

        const key = `${schoolName}|${courseName}`;

        if (!aggregationMap.has(key)) {
          aggregationMap.set(key, {
            schoolName: schoolName,
            courseName: courseName,
            studentCount: 0
          });
        }

        aggregationMap.get(key)!.studentCount++;
      }

      this.enrollReportData = Array.from(aggregationMap.values());

      if (this.enrollReportData.length === 0) {
        this.notificationService.showWarning('No se encontraron inscripciones en el rango de fechas seleccionadas','');
      }
    },
    error: (error) => {
        console.error('Error loading enrollments:', error);

        if (error.status === 401) {
          this.notificationService.showError(
            'Sesión expirada',
            'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
          );
        } else {
          this.notificationService.showError(
            'Error al cargar inscripciones',
            'No se pudieron cargar los datos de inscripciones. Inténtalo nuevamente.'
          );
        }
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
  }

  navigateToPresupuesto(): void {
    this.router.navigate(['/private/presupuesto']);
  }

  loadSchoolsData(): void {
    this.loadingSchoolsData = true;
    this.schoolService.getListStudentBySchool().subscribe({
      next: (response: any) => {
        console.log('Response from service:', response);
        console.log('First school data:', response[0]);
        if (response[0] && response[0].cursos && response[0].cursos[0] && response[0].cursos[0].estudiantes) {
          console.log('First student data:', response[0].cursos[0].estudiantes[0]);
        }
        // El servicio retorna directamente el array, no dentro de una propiedad 'data'
        const schoolsArray = Array.isArray(response) ? response : response.data || [];
        this.schoolsData = schoolsArray.map((school: any) => ({
          ...school,
          expanded: false,
          cursos: school.cursos.map((curso: any) => {
            // Calcular estudiantes nuevos hoy para este curso
            const nuevosHoy = curso.estudiantes ? curso.estudiantes.filter((student: any) => {
              console.log('Checking student for nuevos hoy:', {
                nombre: student.nombre,
                fecha_inscripcion: student.fecha_inscripcion,
                raw_student: student
              });
              return this.isStudentNewToday({
                id: student.id,
                nombre: student.nombre,
                apellido: student.apellido,
                tipo_documento: student.tipo_documento,
                numero_documento: student.numero_documento,
                fecha_creacion: student.fecha_creacion,
                fecha_inscripcion: student.fecha_inscripcion,
                saldo: student.saldo || 0
              });
            }).length : 0;

            return {
              ...curso,
              expanded: false,
              nuevos_hoy: nuevosHoy
            };
          })
        }));
        console.log('Processed schoolsData:', this.schoolsData);
        this.loadingSchoolsData = false;
      },
      error: (error) => {
        console.error('Error loading schools data:', error);

        // Si es un error 401, el interceptor ya manejó la renovación del token
        // y reintentó la petición, así que este error significa que falló definitivamente
        if (error.status === 401) {
          this.notificationService.showError(
            'Sesión expirada',
            'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
          );
        } else {
          this.notificationService.showError(
            'Error al cargar datos',
            'No se pudieron cargar los datos de colegios. Inténtalo nuevamente.'
          );
        }

        this.loadingSchoolsData = false;
      }
    });
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
  hasNewStudentsToday(school: SchoolData): boolean {
    return school.cursos.some(curso => curso.nuevos_hoy > 0);
  }

  // Método para obtener el total de estudiantes nuevos hoy en un colegio
  getTotalNewStudentsToday(school: SchoolData): number {
    return school.cursos.reduce((total, curso) => total + curso.nuevos_hoy, 0);
  }

  // Método para verificar si un estudiante se inscribió hoy
  isStudentNewToday(student: StudentData): boolean {
    console.log('Checking if student has fecha_inscripcion:', student.fecha_inscripcion);
    if (!student.fecha_inscripcion) {
      return false;
    }

    // Usar solo la parte de la fecha (YYYY-MM-DD) para evitar problemas de zona horaria
    const today = new Date();
    const todayString = today.getFullYear() + '-' +
                       String(today.getMonth() + 1).padStart(2, '0') + '-' +
                       String(today.getDate()).padStart(2, '0');

    const isToday = student.fecha_inscripcion === todayString;

    console.log(`Checking student: ${student.nombre} ${student.apellido}`, {
      fecha_inscripcion: student.fecha_inscripcion,
      todayString: todayString,
      isToday
    });

    return isToday;
  }

  // Método para obtener el total de estudiantes en un colegio
  getTotalStudentsInSchool(school: SchoolData): number {
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
  downloadExcelIns(): void {
    try {
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
      summarySheet.addRow(['Total de Cursos:', totalCourses]);
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
  downloadExcelCart(): void {
    try{
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
}
