import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DOCUMENT_TYPE } from '../../../../core/const/DocumentTypeConst';
import { CourseService } from '../../../../core/services/course.service';
import { Course } from '../../../../core/models/Course';
import {AccountReceivableService} from '../../../../core/services/account-receivable.service';
import { ClientService } from '../../../../core/services/client.service';
import { SchoolService } from '../../../../core/services/school.service';
import { PaymentConfirmationComponent } from './payment-confirmation/payment-confirmation.component';
import {Client} from '../../../../core/models/Clients';
import {StudentService} from '../../../../core/services/student.service';
import {Student} from '../../../../core/models/Student';
import {School} from '../../../../core/models/School';
import { NotificationModalComponent, NotificationData } from '../../../../components/notification-modal/notification-modal';
import {PaymentService} from '../../../../core/services/payment.service';
import {PaymentModel} from '../../../../core/models/AccountReceivable';
import { environment } from '../../../../../environments/environment';
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
  ) {}

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
      coursePrice: [{ value: '', disabled: true }, [Validators.required]],
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
    this.paymentForm.get('guardianFirstName')?.setValue(value, { emitEvent: false });
  }

  onGuardianLastNameChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.paymentForm.get('guardianLastName')?.setValue(value, { emitEvent: false });
  }

  onStudentFirstNameChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.paymentForm.get('studentFirstName')?.setValue(value, { emitEvent: false });
  }

  onStudentLastNameChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.paymentForm.get('studentLastName')?.setValue(value, { emitEvent: false });
  }

  onStudentSchoolChange(event: any): void {
    const value = this.capitalizeText(event.target.value);
    this.paymentForm.get('studentSchool')?.setValue(value, { emitEvent: false });
  }

  onStudentGradoChange(event: any): void {
    const value = event.target.value.toUpperCase();
    this.paymentForm.get('studentGrado')?.setValue(value, { emitEvent: false });
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
      if(data.data.length > 0){
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

        if(data.data.length > 0){
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

    // Actualizar el término de búsqueda del colegio
    if (student.colegio) {
      this.schoolService.getSchoolById(student.colegio).subscribe({
        next: (response) => {
          if (response.data) {
            this.paymentForm.get('schoolSearchTerm')?.setValue(response.data.nombre);
          }
        },
        error: (error) => {
          console.error('Error loading school name:', error);
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
        const courseData = {
          id: cuenta.id,
          courseName: cuenta.curso_id?.nombre || 'N/A',
          studentName: student ? `${student.nombre} ${student.apellido}` : `${cuenta.estudiante_id.nombre} ${cuenta.estudiante_id.apellido}`,
          studentDocumentType: student ? student.tipo_documento : cuenta.estudiante_id.tipo_documento,
          studentDocumentNumber: student ? student.numero_documento : cuenta.estudiante_id.numero_documento,
          coursePrice: this.formatCurrency(cuenta.monto || 0), // Usar monto en lugar del precio del curso
          coursePriceNumber: cuenta.monto || 0, // Valor numérico del monto
          balance: this.formatCurrency(cuenta.saldo || 0), // Saldo es lo que ya se ha pagado (Total Abonado)
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
      // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      (charCode === 65 && event.ctrlKey === true) ||
      (charCode === 67 && event.ctrlKey === true) ||
      (charCode === 86 && event.ctrlKey === true) ||
      (charCode === 88 && event.ctrlKey === true)) {
      return;
    }
    // Ensure that it is a number and stop the keypress
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
    setTimeout(()=>{
      this.searchClientPayment(documentType, documentNumber);
    },500)
  }

  createAccountRecord= ()=> {
    const coursePriceString = this.paymentForm.get('coursePrice')?.value;
    const coursePriceNumber = this.parseCurrencyToNumber(coursePriceString);

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
      curso_id: this.paymentForm.get('selectedCourse')?.value,
      precio: coursePriceNumber,
      estado: 'PENDIENTE',
      fecha_creacion: new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' })
    };

    this.accountReceivableService.createAccountRecord(paymentForm).subscribe({
      next: (response: any) => {
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
        title: 'Curso registrado con éxito',
        message: 'El curso ha sido registrado exitosamente. Puedes dirigirte a la tabla de Cursos Registrados y realizar el pago.',
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

    console.log('📝 Reference generada:', reference);
    return reference;
  }

  async confirmPayment(): Promise<void> {
    const reference = this.generatePaymentReference(this.paymentModalData?.id);
    const amountInCents = this.editablePaymentAmount * 100;

    // Seleccionar las llaves según el modo (prueba o producción)
    const wompiConfig = environment.wompi.testMode ? environment.wompi.test : environment.wompi.prod;

    // Debug: Mostrar qué configuración se está usando
    console.log('🔧 Wompi Config:', {
      testMode: environment.wompi.testMode,
      publicKey: wompiConfig.publicKey,
      integrityKey: wompiConfig.integrityKey,
      reference: reference,
      amountInCents: amountInCents,
      environment: environment.production ? 'PRODUCCIÓN' : 'DESARROLLO'
    });

    // 🔍 Console.log específico para wompiConfig.integrityKey cuando se hace clic
    console.log('🔑 IntegrityKey al hacer clic en pagar:', wompiConfig.integrityKey);

    const signature = await this.generateIntegrity(reference, amountInCents, 'COP', wompiConfig.integrityKey);

    console.log('🔐 Signature generada:', signature);

    const checkout = new (window as any).WidgetCheckout({
      currency: 'COP',
      amountInCents: amountInCents,
      reference: reference,
      publicKey: wompiConfig.publicKey,
      signature: { integrity: signature },
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
    
    console.log('🔧 Datos para generar firma:', {
      reference,
      amountInCents,
      currency,
      secretKey,
      concatenatedData: data
    });

    try {
      // Usar crypto-js para generar SHA-256
      const hash = CryptoJS.SHA256(data);
      const signature = hash.toString(CryptoJS.enc.Hex);
      
      console.log('✅ Firma SHA-256 generada correctamente:', signature);
      return signature;
    } catch (error) {
      console.error('❌ Error generando firma SHA-256:', error);
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
