import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router} from '@angular/router';
import {DOCUMENT_TYPE} from '../../../../core/const/DocumentTypeConst';
import {CourseService} from '../../../../core/services/course.service';
import {Course} from '../../../../core/models/Course';
import {AccountReceivableService} from '../../../../core/services/account-receivable.service';
import {ClientService} from '../../../../core/services/client.service';
import {SchoolService} from '../../../../core/services/school.service';
import {PaymentConfirmationComponent} from './payment-confirmation/payment-confirmation.component';
import {Client} from '../../../../core/models/Clients';
import {StudentService} from '../../../../core/services/student.service';
import {Student} from '../../../../core/models/Student';
import {School} from '../../../../core/models/School';
import {
  NotificationModalComponent,
  NotificationData
} from '../../../../components/notification-modal/notification-modal';
import {PaymentService} from '../../../../core/services/payment.service';
import {PaymentModel} from '../../../../core/models/AccountReceivable';
import {environment} from '../../../../../environments/environment';
import * as CryptoJS from 'crypto-js';

declare var WidgetCheckout: any;

@Component({
  selector: 'app-payment-record',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, PaymentConfirmationComponent, NotificationModalComponent],
  templateUrl: './payment-record.html',
  styleUrl: './payment-record.css'
})
export class PaymentRecord implements OnInit {
  paymentForm!: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;
  isSubmitting = false;
  courses: Course[] = [];
  schools: School[] = [];
  filteredSchools: School[] = [];

  isLoadingCourses = false;
  isLoadingSchools = false;
  isSchoolSelected = false;
  showConfirmation = false;
  isSearchingClient = false;

  // New properties for registered courses table
  showRegisteredCourses = false;
  clientData: any = null;
  registeredCourses: any[] = [];
  cliente: Client[];
  student: Student[];
  showAddCourseForm = false;

  // Properties for payments modal
  showPaymentsModal = false;
  selectedAccountData: any = null;
  selectedAccountPayments: PaymentModel[] = [];

  // Properties for payment modal
  showPaymentModal = false;
  paymentModalData: any = null;
  totalAmountToPay = 0;
  editablePaymentAmount = 0;

  // Variables para el modal de notificaciones
  showNotification: boolean = false;
  notificationData: NotificationData | null = null;

  constructor(
    private fb: FormBuilder,
    private courseService: CourseService,
    private accountReceivableService: AccountReceivableService,
    private clientService: ClientService,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private paymentService: PaymentService,
    private router: Router,
  ) {
  }

  ngOnInit(): void {
    this.initForm();
    this.loadCourses();
  }


  initForm(): void {
    this.paymentForm = this.fb.group({
      // Guardian fields
      guardianDocumentType: ['CC', [Validators.required]],
      guardianDocumentNumber: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^[0-9]+$/)]],
      guardianFirstName: ['', [Validators.required, Validators.minLength(2)]],
      guardianLastName: ['', [Validators.required, Validators.minLength(2)]],
      guardianPhoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      guardianEmail: ['', [Validators.required, Validators.email]],
      guardianAddress: ['', [Validators.required, Validators.minLength(10)]],

      // Student fields
      studentDocumentType: ['TI', [Validators.required]],
      studentDocumentNumber: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^[0-9]+$/)]],
      studentFirstName: ['', [Validators.required, Validators.minLength(2)]],
      studentLastName: ['', [Validators.required, Validators.minLength(2)]],
      studentGrado: ['', [Validators.required, Validators.minLength(1)]],
      studentSchool: ['', [Validators.required]],
      schoolSearchTerm: [''],

      // Course fields
      selectedCourse: ['', [Validators.required]],
      coursePrice: [{value: '', disabled: true}, [Validators.required]],
    });
  }

  onSubmit(): void {
    if (this.paymentForm.valid) {
      this.showConfirmation = true;
    } else {
      this.markFormGroupTouched(this.paymentForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  onGuardianFirstNameChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.paymentForm.get('guardianFirstName')?.setValue(value, {emitEvent: false});
  }

  onGuardianLastNameChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.paymentForm.get('guardianLastName')?.setValue(value, {emitEvent: false});
  }

  onStudentFirstNameChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.paymentForm.get('studentFirstName')?.setValue(value, {emitEvent: false});
  }

  onStudentLastNameChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.paymentForm.get('studentLastName')?.setValue(value, {emitEvent: false});
  }

  onStudentSchoolChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.paymentForm.get('studentSchool')?.setValue(value, {emitEvent: false});
  }

  onStudentGradoChange(event: any): void {
    const value = event.target.value.toUpperCase();
    this.paymentForm.get('studentGrado')?.setValue(value, {emitEvent: false});
  }

  onGuardianDocumentTypeChange(event: any): void {
    this.searchClientIfReady();
  }

  onGuardianDocumentNumberChange(event: any): void {
    this.searchClientIfReady();
  }

  onStudentDocumentTypeChange(event: any): void {
    this.searchStudentIfReady();
  }

  onStudentDocumentNumberChange(event: any): void {
    this.searchStudentIfReady();
  }

  private searchClientIfReady(): void {
    const documentType = this.paymentForm.get('guardianDocumentType')?.value;
    const documentNumber = this.paymentForm.get('guardianDocumentNumber')?.value;

    if (documentType && documentNumber && documentNumber.length >= 6) {
      this.searchClientPayment(documentType, documentNumber);
    } else {
      this.clearGuardianFields();
    }
  }

  private searchStudentIfReady(): void {
    const documentType = this.paymentForm.get('studentDocumentType')?.value;
    const documentNumber = this.paymentForm.get('studentDocumentNumber')?.value;

    if (documentType && documentNumber && documentNumber.length >= 6) {
      this.searchStudentPayment(documentType, documentNumber);
    }
  }

  private searchClientPayment(documentType: string, documentNumber: string): void {
    this.isSearchingClient = true;
    this.clientService.searchClientPayment(documentType, documentNumber).subscribe(data => {
      this.isSearchingClient = false;
      this.cliente = data.data;
      if (data.data.length > 0) {
        const client = data.data[0];
        this.clientData = client;
        this.fillGuardianFields(client);
        if (client.cuentas_cobrar && client.cuentas_cobrar.length > 0) {
          this.prepareRegisteredCoursesTable(client);
          this.showRegisteredCourses = true;
        } else {
          this.registeredCourses = [];
          this.showRegisteredCourses = false;
        }
      } else {
        this.clearGuardianFields();
        this.showRegisteredCourses = false;
        this.clientData = null;
        this.registeredCourses = [];
      }
    });
  }

  private searchStudentPayment(documentType: string, documentNumber: string): void {

    this.studentService.searchStudentPayment(documentType, documentNumber).subscribe(data => {
      this.student = data.data;

      if (data.data.length > 0) {
        this.fillStudentFields(this.student[0]);
      } else {
        this.clearStudentFields();
      }
    })
  }

  private fillGuardianFields(client: any): void {
    this.paymentForm.patchValue({
      guardianFirstName: client.nombre || '',
      guardianLastName: client.apellido || '',
      guardianPhoneNumber: client.celular || '',
      guardianEmail: client.email || '',
      guardianAddress: client.direccion || ''
    });
  }

  private fillStudentFields(student: any): void {
    this.paymentForm.patchValue({
      studentFirstName: student.nombre || '',
      studentLastName: student.apellido || '',
      studentGrado: student.grado || '',
      studentSchool: student.colegio || '',
    });

    // Verificar si el colegio viene como objeto o como ID
    let schoolId = null;
    let schoolName = '';

    if (student.colegio_id) {
      if (typeof student.colegio_id === 'object' && student.colegio_id.id) {
        // El colegio viene como objeto completo
        schoolId = student.colegio_id.id;
        schoolName = student.colegio_id.nombre || '';
      } else if (typeof student.colegio_id === 'string') {
        // El colegio viene como ID string
        schoolId = student.colegio_id;
      }
    }

    // Si tenemos el nombre del colegio directamente, usarlo
    if (schoolName) {
      this.paymentForm.get('schoolSearchTerm')?.setValue(schoolName);
      this.paymentForm.get('studentSchool')?.setValue(schoolId); // Establecer el ID en el campo requerido
      // NO establecer isSchoolSelected = true para permitir cambios
    }
    // Si solo tenemos el ID, buscar el nombre
    else if (schoolId) {
      this.schoolService.getSchoolById(schoolId).subscribe({
        next: (response) => {
          if (response.data) {
            this.paymentForm.get('schoolSearchTerm')?.setValue(response.data.nombre);
            this.paymentForm.get('studentSchool')?.setValue(schoolId); // Establecer el ID en el campo requerido
            // NO establecer isSchoolSelected = true para permitir cambios
          }
        },
        error: (error) => {
          console.error('❌ Error loading school name:', error);
        }
      });
    }
    // Si viene en el campo 'colegio' (compatibilidad hacia atrás)
    else if (student.colegio) {
      this.schoolService.getSchoolById(student.colegio).subscribe({
        next: (response) => {
          if (response.data) {
            this.paymentForm.get('schoolSearchTerm')?.setValue(response.data.nombre);
            this.paymentForm.get('studentSchool')?.setValue(student.colegio); // Establecer el ID en el campo requerido
            // NO establecer isSchoolSelected = true para permitir cambios
        }
        },
        error: (error) => {
          console.error('❌ Error loading school name from colegio field:', error);
        }
      });
    }
  }

  private clearGuardianFields(): void {
    this.paymentForm.patchValue({
      guardianFirstName: '',
      guardianLastName: '',
      guardianPhoneNumber: '',
      guardianEmail: '',
      guardianAddress: ''
    });
  }

  private clearStudentFields(): void {
    this.paymentForm.patchValue({
      studentFirstName: '',
      studentLastName: '',
      studentGrado: '',
      studentSchool: '',
      schoolSearchTerm: ''
    });
    this.filteredSchools = [];
    this.isSchoolSelected = false;
  }


  private prepareRegisteredCoursesTable(client: any): void {
    this.registeredCourses = [];
    if (client.cuentas_cobrar && client.estudiantes) {
      client.cuentas_cobrar.forEach((cuenta: any, index: number) => {
        const student = client.estudiantes.find((est: any) => est.id === cuenta.estudiante_id.id);

        // Calcular el saldo pendiente (Precio del Curso - Total Abonado)
        const coursePriceNumber = cuenta.monto || 0;
        const totalPaidNumber = cuenta.saldo || 0;
        const pendingBalanceNumber = coursePriceNumber - totalPaidNumber;

        const courseData = {
          id: cuenta.id,
          courseName: cuenta.curso_id?.nombre || 'N/A',
          studentName: student ? `${student.nombre} ${student.apellido}` : `${cuenta.estudiante_id.nombre} ${cuenta.estudiante_id.apellido}`,
          studentDocumentType: student ? student.tipo_documento : cuenta.estudiante_id.tipo_documento,
          studentDocumentNumber: student ? student.numero_documento : cuenta.estudiante_id.numero_documento,
          coursePrice: this.formatCurrency(coursePriceNumber), // Precio del curso
          coursePriceNumber: coursePriceNumber, // Valor numérico del precio
          balance: this.formatCurrency(totalPaidNumber), // Total abonado
          balanceNumber: totalPaidNumber, // Valor numérico del total abonado
          pendingBalance: this.formatCurrency(pendingBalanceNumber), // Saldo pendiente
          pendingBalanceNumber: pendingBalanceNumber, // Valor numérico del saldo pendiente
          status: cuenta.estado,
          courseId: cuenta.curso_id?.id,
          date: cuenta.created_at,
        };
        this.registeredCourses.push(courseData);
      });
    }
  }

  onViewPayments(courseData: any): void {

    const account = this.clientData?.cuentas_cobrar?.find((cuenta: any) =>
      cuenta.id === courseData.id
    );

    if (account) {
      this.selectedAccountData = courseData;
      this.selectedAccountPayments = account.pagos || [];
      this.showPaymentsModal = true;
    } else {
      console.error('No se encontró la cuenta para mostrar los pagos');
    }
  }

  closePaymentsModal(): void {
    this.showPaymentsModal = false;
    this.selectedAccountData = null;
    this.selectedAccountPayments = [];
  }

  printPaymentHistory(): void {
    if (!this.selectedAccountData || !this.selectedAccountPayments) {
      console.error('No hay datos para imprimir');
      return;
    }

    // Crear el contenido HTML para imprimir
    const printContent = this.generatePrintContent();

    // Crear una nueva ventana para imprimir
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();

      // Esperar a que se cargue el contenido y luego imprimir
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  private generatePrintContent(): string {
    const currentDate = new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let paymentsHtml = '';

    if (this.selectedAccountPayments && this.selectedAccountPayments.length > 0) {
      this.selectedAccountPayments.forEach((payment, index) => {
        paymentsHtml += `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px; text-align: center; font-family: monospace; font-size: 12px;">${payment.id}</td>
            <td style="padding: 12px; text-align: right; font-weight: bold; color: #059669;">$${payment.valor?.toLocaleString('es-CO') || 'N/A'}</td>
            <td style="padding: 12px; text-align: center;">${this.formatDateForPrint(payment.fecha_pago)}</td>
            <td style="padding: 12px; text-align: center;">${this.formatPaymentMethod(payment.metodo_pago)}</td>
            <td style="padding: 12px;">${payment.pagador || 'N/A'}</td>
            <td style="padding: 12px; text-align: center; font-family: monospace; font-size: 12px;">${payment.numero_transaccion || 'N/A'}</td>
            <td style="padding: 12px; text-align: center;">
              <span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;
                           background-color: ${payment.estado === 'PAGADO' ? '#d1fae5' : '#fee2e2'};
                           color: ${payment.estado === 'PAGADO' ? '#065f46' : '#991b1b'};">
                ${payment.estado}
              </span>
            </td>
          </tr>
        `;
      });
    } else {
      paymentsHtml = `
        <tr>
          <td colspan="7" style="padding: 20px; text-align: center; color: #6b7280;">
            No hay pagos registrados para este programa
          </td>
        </tr>
      `;
    }

    const totalPaid = this.selectedAccountPayments?.reduce((sum, payment) => {
      // Solo sumar pagos con estado PAGADO
      if (payment.estado === 'PAGADO') {
        return sum + (payment.valor || 0);
      }
      // Restar pagos con estado DEVOLUCION
      if (payment.estado === 'DEVOLUCION') {
        return sum - (payment.valor || 0);
      }
      return sum;
    }, 0) || 0;
    const pendingBalance = (this.selectedAccountData.coursePriceNumber || 0) - totalPaid;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Historial de Pagos - ${this.selectedAccountData.studentName}</title>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #374151;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
          }
          .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 5px;
          }
          .document-title {
            font-size: 18px;
            color: #374151;
            margin-bottom: 10px;
          }
          .print-date {
            font-size: 12px;
            color: #6b7280;
          }
          .student-info {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 25px;
            border-left: 4px solid #3b82f6;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .info-item {
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: bold;
            color: #374151;
            display: inline-block;
            min-width: 120px;
          }
          .info-value {
            color: #1f2937;
          }
          .payments-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .payments-table th {
            background-color: #3b82f6;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 13px;
          }
          .payments-table td {
            font-size: 13px;
            border-bottom: 1px solid #e5e7eb;
          }
          .payments-table tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .summary {
            background-color: #f0f9ff;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #bae6fd;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            text-align: center;
          }
          .summary-item {
            padding: 10px;
          }
          .summary-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .summary-value {
            font-size: 18px;
            font-weight: bold;
          }
          .total-course { color: #1f2937; }
          .total-paid { color: #059669; }
          .pending-balance { color: ${pendingBalance > 0 ? '#dc2626' : '#059669'}; }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Thinking Mind</div>
          <div class="document-title">Historial de Pagos</div>
          <div class="print-date">Generado el: ${currentDate}</div>
        </div>

        <div class="student-info">
          <div class="info-grid">
            <div>
              <div class="info-item">
                <span class="info-label">Estudiante:</span>
                <span class="info-value">${this.selectedAccountData.studentName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Programa:</span>
                <span class="info-value">${this.selectedAccountData.courseName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Estado:</span>
                <span class="info-value">${this.selectedAccountData.status}</span>
              </div>
            </div>
            <div>
              <div class="info-item">
                <span class="info-label">Precio del Programa:</span>
                <span class="info-value">$${this.selectedAccountData.coursePriceNumber?.toLocaleString('es-CO') || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total Abonado:</span>
                <span class="info-value">${this.selectedAccountData.balance}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total de Pagos:</span>
                <span class="info-value">${this.selectedAccountPayments?.length || 0} pago(s)</span>
              </div>
            </div>
          </div>
        </div>

        <table class="payments-table">
          <thead>
            <tr>
              <th>ID del Pago</th>
              <th>Valor</th>
              <th>Fecha de Pago</th>
              <th>Método de Pago</th>
              <th>Pagador</th>
              <th>Núm. Transacción</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${paymentsHtml}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Precio del Program</div>
              <div class="summary-value total-course">$${this.selectedAccountData.coursePriceNumber?.toLocaleString('es-CO') || '0'}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Pagado</div>
              <div class="summary-value total-paid">$${totalPaid.toLocaleString('es-CO')}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Saldo Pendiente</div>
              <div class="summary-value pending-balance">$${pendingBalance.toLocaleString('es-CO')}</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Este documento fue generado automáticamente por el sistema Thinking Mind</p>
          <p>Para consultas o aclaraciones, contacte con el área administrativa</p>
        </div>
      </body>
      </html>
    `;
  }

  private formatDateForPrint(dateString: string): string {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  showAddCourseFormView(): void {
    this.showAddCourseForm = true;
    this.paymentForm.patchValue({
      studentDocumentType: 'TI',
      studentDocumentNumber: '',
      studentFirstName: '',
      studentLastName: '',
      studentGrado: '',
      studentSchool: '',
      selectedCourse: '',
      coursePrice: ''
    });
  }

  backToTableView(): void {
    this.showAddCourseForm = false;
  }

  private capitalizeText(text: string): string {
    if (!text) return '';
    return text.toLowerCase().split(' ').map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  onlyNumbers(event: KeyboardEvent): void {
    const charCode = event.which ? event.which : event.keyCode;
    // Allow: backspace, delete, tab, escape, enter
    if ([46, 8, 9, 27, 13].indexOf(charCode) !== -1 ||
      (charCode === 65 && event.ctrlKey === true) ||
      (charCode === 67 && event.ctrlKey === true) ||
      (charCode === 86 && event.ctrlKey === true) ||
      (charCode === 88 && event.ctrlKey === true)) {
      return;
    }
    if ((charCode < 48 || charCode > 57)) {
      event.preventDefault();
    }
  }

  loadCourses(): void {
    this.isLoadingCourses = true;
    this.courseService.searchCourse().subscribe({
      next: (response) => {
        if (response.data) {
          // Ordenar los cursos alfabéticamente por nombre
          this.courses = response.data.sort((a, b) =>
            a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
          );
          this.courses.forEach((course, index) => {
           if (course.colegios_cursos && course.colegios_cursos.length > 0) {
              course.colegios_cursos.forEach((cc, ccIndex) => {
              });
            }
          });
        }
        this.isLoadingCourses = false;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.isLoadingCourses = false;
      }
    });
  }


  private searchTimeout: any;

  onSchoolSearch(event: any): void {
    const searchTerm = event.target.value;
    this.paymentForm.get('schoolSearchTerm')?.setValue(searchTerm);
    this.isSchoolSelected = false; // Reset cuando el usuario empieza a escribir

    // Limpiar el valor del colegio seleccionado cuando el usuario empieza a escribir
    this.paymentForm.get('studentSchool')?.setValue('');

    // Limpiar el timeout anterior
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Si el término está vacío, limpiar los resultados
    if (searchTerm.trim() === '') {
      this.filteredSchools = [];
      return;
    }

    // Debounce de 300ms para evitar demasiadas llamadas
    this.searchTimeout = setTimeout(() => {
      this.searchSchools(searchTerm);
    }, 300);
  }

  searchSchools(searchTerm: string): void {
    this.isLoadingSchools = true;
    this.schoolService.searchSchool(searchTerm, 1, 10).subscribe({
      next: (response) => {
        this.filteredSchools = response.data;
        this.isLoadingSchools = false;
      },
      error: (error) => {
        console.error('Error searching schools:', error);
        this.filteredSchools = [];
        this.isLoadingSchools = false;
      }
    });
  }

  selectSchool(school: School): void {
    this.paymentForm.get('studentSchool')?.setValue(school.id);
    this.paymentForm.get('schoolSearchTerm')?.setValue(school.nombre);
    this.filteredSchools = [];
    this.isSchoolSelected = true;
  }

  clearSchoolSearch(): void {
    this.paymentForm.get('schoolSearchTerm')?.setValue('');
    this.filteredSchools = [];
    this.isSchoolSelected = false;
    this.paymentForm.get('studentSchool')?.setValue('');
  }

  onCourseChange(courseId: string): void {
    if (courseId) {
      // Validación para el curso Will-Go (Segundo Hermano)
      const willGoSegundoHermanoId = '2818d82d-25e3-4396-a964-1ae7bdc60054';
      const willGoEstandarId = '98e183f7-a568-4992-b1e8-d2f00915a153';

      // Validación para el curso Will-Go (Tercer Hermano)
      const willGoTercerHermanoId = 'a218abdb-50e6-4b51-bc51-570e9efdfdc8';

      if (courseId === willGoSegundoHermanoId) {
        // Verificar si el acudiente tiene al menos una cuenta por cobrar del curso Will Go Estándar
        if (!this.clientData || !this.clientData.cuentas_cobrar) {
          this.showValidationNotification('Will Go Estandar');
          this.resetCourseSelection();
          return;
        }

        const hasWillGoEstandarPaid = this.clientData.cuentas_cobrar.some((cuenta: any) =>
          cuenta.curso_id &&
          cuenta.curso_id.id === willGoEstandarId &&
          cuenta.estado === 'PAGADA'
        );

        if (!hasWillGoEstandarPaid) {
          this.showValidationNotification('Will Go Estandar');
          this.resetCourseSelection();
          return;
        }
      }

      if (courseId === willGoTercerHermanoId) {
        // Verificar si el acudiente tiene al menos una cuenta por cobrar del curso Will Go (Segundo Hermano)
        if (!this.clientData || !this.clientData.cuentas_cobrar) {
          this.showValidationNotification('Will Go (Segundo Hermano)');
          this.resetCourseSelection();
          return;
        }

        const hasWillGoSegundoHermanoPaid = this.clientData.cuentas_cobrar.some((cuenta: any) =>
          cuenta.curso_id &&
          cuenta.curso_id.id === willGoSegundoHermanoId &&
          cuenta.estado === 'PAGADA'
        );

        if (!hasWillGoSegundoHermanoPaid) {
          this.showValidationNotification('Will Go (Segundo Hermano)');
          this.resetCourseSelection();
          return;
        }
      }

      const selectedCourse = this.courses.find(course => course.id === courseId);
      if (selectedCourse) {
        const priceAsNumber = parseFloat(selectedCourse.precio);
        const formattedPrice = this.formatCurrency(priceAsNumber);
        this.paymentForm.patchValue({
          coursePrice: formattedPrice
        });
      }
    } else {
      this.paymentForm.patchValue({
        coursePrice: ''
      });
    }
  }

  private showValidationNotification(requiredCourse: string): void {
    this.notificationData = {
      title: 'Requisito no cumplido',
      message: `Para aplicar a este programa, debe haber comprado y pagado completamente el programa ${requiredCourse}.`,
      type: 'error'
    };
    this.showNotification = true;
  }

  private resetCourseSelection(): void {
    this.paymentForm.patchValue({
      course: '',
      coursePrice: ''
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  private parseCurrencyToNumber(currencyString: string): number {
    return parseFloat(currencyString.replace(/[^\d]/g, ''));
  }

  goBackToForm(): void {
    this.showConfirmation = false;
  }

  confirmAndSubmit(): void {
    this.isSubmitting = true;
    this.createAccountRecord();
    this.showAddCourseForm = false;
    const documentType = this.paymentForm.get('guardianDocumentType')?.value;
    const documentNumber = this.paymentForm.get('guardianDocumentNumber')?.value;
    setTimeout(() => {
      this.searchClientPayment(documentType, documentNumber);
    }, 500)
  }

  createAccountRecord = () => {
    const coursePriceString = this.paymentForm.get('coursePrice')?.value;
    const coursePriceNumber = this.parseCurrencyToNumber(coursePriceString);
    const selectedCourseId = this.paymentForm.get('selectedCourse')?.value;

    // Buscar el curso seleccionado para obtener su array completo de colegios_cursos
    const selectedCourse = this.courses.find(course => course.id === selectedCourseId);
    let colegiosCursos = [];

    if (selectedCourse && selectedCourse.colegios_cursos) {
      // Enviar el array completo de colegios_cursos del curso seleccionado
      colegiosCursos = selectedCourse.colegios_cursos;
    }
    const paymentForm = {
      cliente: {
        tipo_documento: this.paymentForm.get('guardianDocumentType')?.value,
        numero_documento: this.paymentForm.get('guardianDocumentNumber')?.value,
        nombre: this.paymentForm.get('guardianFirstName')?.value,
        apellido: this.paymentForm.get('guardianLastName')?.value,
        celular: this.paymentForm.get('guardianPhoneNumber')?.value,
        email: this.paymentForm.get('guardianEmail')?.value,
        direccion: this.paymentForm.get('guardianAddress')?.value,
      },
      estudiante: {
        tipo_documento: this.paymentForm.get('studentDocumentType')?.value,
        numero_documento: this.paymentForm.get('studentDocumentNumber')?.value,
        nombre: this.paymentForm.get('studentFirstName')?.value,
        apellido: this.paymentForm.get('studentLastName')?.value,
        grado: this.paymentForm.get('studentGrado')?.value,
        colegio: this.paymentForm.get('studentSchool')?.value,
      },
      curso_id: selectedCourseId,
      colegios_cursos: colegiosCursos,
      precio: coursePriceNumber,
      estado: 'PENDIENTE',
      fecha_creacion: new Date().toLocaleString('sv-SE', {timeZone: 'America/Bogota'})
    };
    this.accountReceivableService.createAccountRecord(paymentForm).subscribe({
      next: (response: any) => {
        // Verificar si la respuesta tiene status ERROR
        if (response && response.status === 'ERROR') {
          this.isSubmitting = false;
          this.showConfirmation = false;

          // Mostrar notificación de error específica del servidor
          this.showServerErrorNotification(response.data);
          return;
        }

        // Si no hay error, proceder normalmente
        this.isSubmitting = false;
        this.showConfirmation = false;
        // Mostrar notificación de éxito
        this.showSuccessNotification();
        // Buscar nuevamente para actualizar la tabla
        this.searchClientIfReady();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.showErrorNotification();
      }
    })
  }

  showSuccessNotification(type: 'course' | 'payment' = 'course') {
    if (type === 'payment') {
      this.notificationData = {
        type: 'success',
        title: 'Pago exitoso',
        message: 'El pago se ha procesado correctamente.',
        duration: 5000
      };
    } else {
      this.notificationData = {
        type: 'success',
        title: 'Programa registrado con éxito',
        message: 'El programa ha sido registrado exitosamente. Puedes dirigirte a la tabla de Programas Registrados y realizar el pago.',
        duration: 5000
      };
    }
    this.showNotification = true;
  }

  showErrorNotification(type: 'course' | 'payment' = 'course') {
    if (type === 'payment') {
      this.notificationData = {
        type: 'error',
        title: 'Error en el pago',
        message: 'Hubo un problema al procesar el pago.',
        duration: 5000
      };
    } else {
      this.notificationData = {
        type: 'error',
        title: 'Error al registrar curso',
        message: 'No se pudo registrar el curso. Por favor, inténtalo nuevamente.',
        duration: 5000
      };
    }
    this.showNotification = true;
  }

  showServerErrorNotification(errorMessage: string) {
    this.notificationData = {
      type: 'error',
      title: 'Error del servidor',
      message: errorMessage || 'Ha ocurrido un error en el servidor. Por favor, inténtalo nuevamente.',
      duration: 7000
    };
    this.showNotification = true;
  }

  onNotificationClose() {
    this.showNotification = false;
    this.notificationData = null;
  }

  onPayCourse(courseData: any): void {
    const coursePrice = courseData.coursePriceNumber || 0;
    const balance = this.parseCurrencyToNumber(courseData.balance) || 0;
    this.totalAmountToPay = coursePrice - balance;
    this.editablePaymentAmount = this.totalAmountToPay;

    // Configurar los datos del modal con toda la información necesaria
    this.paymentModalData = {
      ...courseData,
      clientName: this.clientData?.nombre + ' ' + this.clientData?.apellido,
      clientDocumentType: this.paymentForm.get('guardianDocumentType')?.value,
      clientDocumentNumber: this.paymentForm.get('guardianDocumentNumber')?.value,
      clientEmail: this.clientData?.email || this.paymentForm.get('guardianEmail')?.value,
      clientPhone: this.clientData?.celular || this.paymentForm.get('guardianPhoneNumber')?.value,
      // Información del estudiante
      studentName: this.paymentForm.get('studentFirstName')?.value + ' ' + this.paymentForm.get('studentLastName')?.value,
      studentDocumentType: this.paymentForm.get('studentDocumentType')?.value,
      studentDocumentNumber: this.paymentForm.get('studentDocumentNumber')?.value
    };

    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.paymentModalData = null;
    this.totalAmountToPay = 0;
    this.editablePaymentAmount = 0;
  }

  onPaymentAmountChange(event: any): void {
    let inputValue = event.target.value.replace(/[^0-9]/g, '');

    if (inputValue === '') {
      this.editablePaymentAmount = 0;
      event.target.value = '';
      return;
    }

    const numericValue = parseInt(inputValue) || 0;
    this.editablePaymentAmount = Math.min(numericValue, this.totalAmountToPay);
    event.target.value = this.getFormattedPaymentAmount();
  }

  formatNumberWithCommas(value: number): string {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  getFormattedPaymentAmount(): string {
    if (this.editablePaymentAmount === 0) {
      return '';
    }
    return 'COP   ' + this.formatNumberWithCommas(this.editablePaymentAmount);
  }

  // Función para generar referencia única usando el ID de la cuenta de cobro
  private generatePaymentReference(accountReceivableId: string): string {
    // Fecha de hoy en formato DDMMYYYY
    const hoy = new Date();
    const dia = String(hoy.getDate()).padStart(2, '0');
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const año = hoy.getFullYear();
    const fecha = `${dia}${mes}${año}`;

    // Generar 4 números aleatorios
    const numerosAleatorios = Math.floor(1000 + Math.random() * 9000);

    // Crear la referencia final: id_cuenta_cobrar-fecha-numeros_aleatorios
    const reference = `${accountReceivableId}-${fecha}-${numerosAleatorios}`;
    return reference;
  }

  async confirmPayment(): Promise<void> {
    const reference = this.generatePaymentReference(this.paymentModalData?.id);
    const amountInCents = this.editablePaymentAmount * 100;

    const wompiConfig = environment.wompi.testMode ? environment.wompi.test : environment.wompi.prod;
    const signature = await this.generateIntegrity(reference, amountInCents, 'COP', wompiConfig.integrityKey);
    const checkout = new (window as any).WidgetCheckout({
      currency: 'COP',
      amountInCents: amountInCents,
      reference: reference,
      publicKey: wompiConfig.publicKey,
      signature: {integrity: signature},
      redirectUrl: environment.wompi.redirectUrl,
      customerData: {
        email: this.paymentModalData?.clientEmail,
        fullName: this.paymentModalData?.clientName,
        phoneNumber: this.paymentModalData?.clientPhone,
        phoneNumberPrefix: '+57',
        legalId: this.paymentModalData?.clientDocumentNumber,
        legalIdType: this.paymentModalData?.clientDocumentType,
      },
    });
    checkout.open((result: any) => {
      this.closePaymentModal();
      if (result.transaction && result.transaction.status === 'APPROVED') {
        this.router.navigate(['/payment-status'], {
          queryParams: {
            transaction: result.transaction.id || 'N/A',
            reference: reference,
            status: 'APROBADA',
            course: this.paymentModalData?.courseName || 'N/A',
            amount: this.editablePaymentAmount
          }
        });
      } else {
        this.showErrorNotification('payment');
      }
    });
  }

  async generateIntegrity(reference: string, amountInCents: number, currency: string, secretKey: string): Promise<string> {
    const data = `${reference}${amountInCents}${currency}${secretKey}`;

    try {
      // Usar crypto-js para generar SHA-256
      const hash = CryptoJS.SHA256(data);
      const signature = hash.toString(CryptoJS.enc.Hex);
      return signature;
    } catch (error) {
      throw new Error('Error generando la firma de integridad');
    }
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
}
