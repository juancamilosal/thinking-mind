import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { REPORT_TYPE } from '../../../../core/const/ReportType';
import { PaymentRecord } from '../../../../core/models/AccountReceivable';
import { PaymentService } from '../../../../core/services/payment.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
//Para descargas
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface EnrollReportData {
  schoolName: string;
  courseName: string;
  studentCount: number;
}

@Component({
  selector: 'app-reports',
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './reports.html',
  standalone: true
})

export class Reports {
  reportForm!: FormGroup;
  REPORT_TYPE = REPORT_TYPE;
  payments: PaymentRecord[] = [];
  enrollReportData: EnrollReportData[] = [];
  reportGenerated: boolean = false;
  showDownloadOptions: boolean = false;

  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService,
    private paymentService: PaymentService,
    private accountReceivableService: AccountReceivableService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm=(): void => {
    this.reportForm = this.fb.group({
      reportType: ['', Validators.required],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required]
    });
  }

  // Función para generar el reporte basado en el tipo seleccionado
  generateReport(): void {
     if (this.reportForm.invalid) {
    this.notificationService.showWarning('Por favor, completa todos los campos del formulario.', '');
    return;
    }
    this.reportGenerated = true;
    const { reportType, startDate, endDate } = this.reportForm.value;

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

  // Generar reporte de pagos dentro del rango de fechas
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
        this.notificationService.showError('Error loading payments');
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
      this.notificationService.showError('Error al cargar las inscripciones');
    }
  });
}

  clearForm(): void {
    this.reportForm.reset();
    this.payments = [];
    this.enrollReportData = [];
    this.reportGenerated = false;
    this.showDownloadOptions = false;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
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

  const doc = new jsPDF();
  const reportType = this.reportForm.value.reportType;
  const startDate = this.formatDate(this.reportForm.value.startDate);
  const endDate = this.formatDate(this.reportForm.value.endDate);

  // Add title
  doc.setFontSize(20);
  doc.text('Reporte Generado', 14, 22);

  // Add date range
  doc.setFontSize(12);
  doc.text(`Período: ${startDate} - ${endDate}`, 14, 35);

  if (reportType === 'CARTERA' && this.payments.length > 0) {
    // Payment Report PDF
    const tableData = this.payments.map(payment => [
      payment.pagador,
      this.formatCurrency(payment.valor),
      this.formatDate(payment.fecha_pago),
      payment.estado
    ]);

    // Add total row
    const total = this.calculateTotal();
    tableData.push(['', '', 'Total Recaudado:', this.formatCurrency(total)]);

    autoTable(doc, {
      head: [['Pagador', 'Valor', 'Fecha de Pago', 'Estado']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] }, // Blue color
      didDrawCell: (data) => {
        // Style the total row
        if (data.row.index === tableData.length - 1) {
          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
        }
      }
    });

    doc.save(`Reporte_Cartera_${new Date().toISOString().split('T')[0]}.pdf`);

  } else if (reportType === 'INSCRIPCIONES' && this.enrollReportData.length > 0) {
    // Enrollment Report PDF
    const tableData = this.enrollReportData.map(item => [
      item.schoolName,
      item.courseName,
      item.studentCount.toString()
    ]);

    // Add total row
    const totalStudents = this.getTotalEnrolledStudents();
    tableData.push(['', 'Total de Estudiantes:', totalStudents.toString()]);

    autoTable(doc, {
      head: [['Colegio', 'Curso', 'Nº de Estudiantes']],
      body: tableData,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [139, 92, 246] }, // Purple color
      didDrawCell: (data) => {
        // Style the total row
        if (data.row.index === tableData.length - 1) {
          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
        }
      }
    });

    doc.save(`Reporte_Inscripciones_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  this.notificationService.showSuccess('Reporte PDF descargado exitosamente','');
}

  getTotalEnrolledStudents(): number {
  return this.enrollReportData.reduce((total, item) => total + item.studentCount, 0);
}

/*
  downloadExcel(): void {
  this.showDownloadOptions = false;

  const reportType = this.reportForm.value.reportType;
  const startDate = this.formatDate(this.reportForm.value.startDate);
  const endDate = this.formatDate(this.reportForm.value.endDate);

  if (reportType === 'CARTERA' && this.payments.length > 0) {
    // Payment Report Excel
    const worksheetData = [
      ['Reporte de Cartera'],
      [`Período: ${startDate} - ${endDate}`],
      [], // Empty row
      ['Pagador', 'Valor', 'Fecha de Pago', 'Estado']
    ];

    // Add payment data
    this.payments.forEach(payment => {
      worksheetData.push([
        payment.pagador,
        payment.valor,
        this.formatDate(payment.fecha_pago),
        payment.estado
      ]);
    });

    // Add total row
    worksheetData.push([]);
    worksheetData.push(['', '', 'Total Recaudado:', this.calculateTotal()]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Pagador
      { wch: 15 }, // Valor
      { wch: 15 }, // Fecha
      { wch: 12 }  // Estado
    ];

    // Apply styles to header
    worksheet['A1'] = { ...worksheet['A1'], s: { font: { bold: true, sz: 16 } } };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Cartera');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Reporte_Cartera_${new Date().toISOString().split('T')[0]}.xlsx`);

  } else if (reportType === 'INSCRIPCIONES' && this.enrollReportData.length > 0) {
    // Enrollment Report Excel
    const worksheetData = [
      ['Reporte de Inscripciones'],
      [`Período: ${startDate} - ${endDate}`],
      [], // Empty row
      ['Colegio', 'Curso', 'Nº de Estudiantes']
    ];

    // Add enrollment data
    this.enrollReportData.forEach(item => {
      worksheetData.push([
        item.schoolName,
        item.courseName,
        item.studentCount
      ]);
    });

    // Add total row
    worksheetData.push([]);
    worksheetData.push(['', 'Total de Estudiantes:', this.getTotalEnrolledStudents()]);

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 30 }, // Colegio
      { wch: 25 }, // Curso
      { wch: 20 }  // Nº de Estudiantes
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Inscripciones');

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Reporte_Inscripciones_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  this.notificationService.showSuccess('Reporte Excel descargado exitosamente','');
  } */
}
