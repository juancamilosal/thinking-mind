import {Component, OnInit, HostListener, ElementRef, ViewChild, ChangeDetectorRef} from '@angular/core';
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
import {PaymentConfirmationComponent} from '../payment-record/payment-confirmation/payment-confirmation.component';
import {Client} from '../../../../core/models/Clients';
import {StudentService} from '../../../../core/services/student.service';
import {Student} from '../../../../core/models/Student';
import {
  NotificationModalComponent,
  NotificationData
} from '../../../../components/notification-modal/notification-modal';
import {PaymentService} from '../../../../core/services/payment.service';
import { ExchangeRateService } from '../../../../core/services/exchange-rate.service';
import {PaymentModel} from '../../../../core/models/AccountReceivable';
import {Grupo} from '../../../../core/models/School';
import {environment} from '../../../../../environments/environment';
import * as CryptoJS from 'crypto-js';

declare var WidgetCheckout: any;

@Component({
  selector: 'app-independent-program-payment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, PaymentConfirmationComponent, NotificationModalComponent],
  templateUrl: './independent-program-payment.html',
  styleUrl: './independent-program-payment.css'
})
export class IndependentProgramPayment implements OnInit {
  paymentForm!: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;
  isSubmitting = false;
  courses: Course[] = []; // Solo cursos con programa_independiente = true
  independentCourses: Course[] = []; // Cursos independientes filtrados
  grado: Grupo[] = [];

  isLoadingCourses = false;
  isLoadingGrupos = false;
  private schoolSearchDebounce: any;
  showConfirmation = false;
  isSearchingClient = false;

  @ViewChild('schoolSearchInput') schoolSearchInputRef?: ElementRef<HTMLInputElement>;

  // New properties for registered courses table
  showRegisteredCourses = false;
  clientData: any = null;
  registeredCourses: any[] = [];
  cliente: Client[];
  student: Student[];
  showAddCourseForm = false;

  // Properties for payments modal
  showPaymentsModal = false;
  selectedCourseForPayments: any = null;
  coursePayments: any[] = [];
  selectedAccountData: any = null;
  selectedAccountPayments: PaymentModel[] = [];

  // Properties for payment modal
  showPaymentModal = false;
  paymentModalData: any = null;
  totalAmountToPay = 0;
  editablePaymentAmount = 0;

  // Properties for PaymentConfirmationComponent
  selectedInscriptionConvertedCop: number | null = null;
  selectedCourseImageUrl: string | null = null;

  // Helper method for parsing numbers in template
  parseNumber(value: string | number): number {
    return parseFloat(String(value)) || 0;
  }

  // Notification properties
  showNotification = false;
  notificationData: NotificationData | null = null;

  // Exchange rate properties
  exchangeRates: any = {};
  selectedCourseConvertedCop = 0;
  
  // Exchange rates (consumidas sin mostrar)
  usdToCop: number | null = null;
  eurToCop: number | null = null;
  
  // Flags para control de visibilidad y moneda de tasa de cambio
  hasInscription: boolean = false;
  isEuroCourse: boolean = false;
  selectedInscriptionAmount: number = 0;
  
  // Flags para evitar notificar repetidamente por falla de tasa de cambio
  usdRateErrorNotified: boolean = false;
  eurRateErrorNotified: boolean = false;
  isExchangeRateError: boolean = false;

  constructor(
    private fb: FormBuilder,
    private courseService: CourseService,
    private accountReceivableService: AccountReceivableService,
    private clientService: ClientService,
    private studentService: StudentService,
    private schoolService: SchoolService,
    private paymentService: PaymentService,
    private exchangeRateService: ExchangeRateService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
  ) {
    this.cliente = [];
    this.student = [];
  }

  ngOnInit(): void {
    this.initForm();
    this.loadIndependentCourses();
    this.loadExchangeRates();

    // Agregar listeners para buscar cursos registrados cuando se ingrese documento del acudiente
    this.paymentForm.get('guardianDocumentType')?.valueChanges.subscribe(() => {
      this.searchClientPaymentIfReady();
    });

    this.paymentForm.get('guardianDocumentNumber')?.valueChanges.subscribe(() => {
      this.searchClientPaymentIfReady();
    });

    // Existing listeners
    this.paymentForm.get('studentDocumentType')?.valueChanges.subscribe(() => {
      this.searchStudentIfReady();
    });

    this.paymentForm.get('studentDocumentNumber')?.valueChanges.subscribe(() => {
      this.searchStudentIfReady();
    });
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
      studentGrado: ['', [Validators.required]],
      studentGrupo: ['', [Validators.required]],
      studentSchool: ['', [Validators.required]],

      // Course fields - Solo para programas independientes
      selectedCourse: ['', [Validators.required]],
      coursePrice: [{value: '', disabled: true}, [Validators.required]],
      courseInscriptionPrice: [{value: '', disabled: true}],
    });
  }

  loadIndependentCourses(): void {
    this.isLoadingCourses = true;
    this.courseService.searchCourse().subscribe({
      next: (response) => {
        console.log('Respuesta completa del servicio de cursos:', response);

        if (response && response.data) {
          // Filtrar solo cursos con programa_independiente = true
          this.independentCourses = response.data.filter((course: Course) => {
            return course.programa_independiente === true;
          });
          this.courses = this.independentCourses; // Asignar a courses para compatibilidad
        }
        this.isLoadingCourses = false;
      },
      error: (error) => {
        this.isLoadingCourses = false;
        this.showNotificationMessage('Error', 'No se pudieron cargar los programas independientes', 'error');
      }
    });
  }

  private loadGrupos(): void {
    this.schoolService.getGroup().subscribe(data => {
      this.grado = data.data;
      // Ordenar primero alfabéticamente, luego numéricamente
      this.grado.sort((a, b) => {
        const grupoA = a.grupo.toString();
        const grupoB = b.grupo.toString();

        // Verificar si son números
        const isNumberA = !isNaN(Number(grupoA));
        const isNumberB = !isNaN(Number(grupoB));

        // Si ambos son letras, ordenar alfabéticamente
        if (!isNumberA && !isNumberB) {
          return grupoA.localeCompare(grupoB);
        }

        // Si uno es letra y otro número, las letras van primero
        if (!isNumberA && isNumberB) {
          return -1;
        }
        if (isNumberA && !isNumberB) {
          return 1;
        }

        // Si ambos son números, ordenar numéricamente
        return Number(grupoA) - Number(grupoB);
      });
    });
  }

  loadExchangeRates(): void {
    this.exchangeRateService.getUsdToCop().subscribe({
      next: (rate) => {
        this.exchangeRates.USD = rate;
      },
      error: (error) => {
      }
    });

    this.exchangeRateService.getEurToCop().subscribe({
      next: (rate) => {
        this.exchangeRates.EUR = rate;
      }
    });
  }

  onCourseChange(event: any): void {
    const courseId = event.target.value;
    const selectedCourse = this.independentCourses.find(course => course.id === courseId);

    if (selectedCourse) {


      // Configurar precios
      const coursePrice = selectedCourse.precio || '0';
      const inscriptionPrice = selectedCourse.precio_inscripcion || 0;

      this.paymentForm.patchValue({
        coursePrice: coursePrice,
        courseInscriptionPrice: inscriptionPrice
      });

      // Convertir precios si es necesario
      this.convertCoursePrices(coursePrice, inscriptionPrice);

      // Configurar imagen del curso
      if (selectedCourse.img_url) {
        this.selectedCourseImageUrl = selectedCourse.img_url;
      }
    }
  }

  convertCoursePrices(coursePrice: string, inscriptionPrice: number): void {
    const coursePriceNumber = parseFloat(coursePrice) || 0;

    if (this.exchangeRates && this.exchangeRates.USD_TO_COP) {
      this.selectedCourseConvertedCop = coursePriceNumber * this.exchangeRates.USD_TO_COP;
      this.selectedInscriptionConvertedCop = inscriptionPrice * this.exchangeRates.USD_TO_COP;
    } else {
      this.selectedCourseConvertedCop = coursePriceNumber;
      this.selectedInscriptionConvertedCop = inscriptionPrice;
    }
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

  searchClientIfReady(): void {
    const documentType = this.paymentForm.get('guardianDocumentType')?.value;
    const documentNumber = this.paymentForm.get('guardianDocumentNumber')?.value;

    if (documentType && documentNumber && documentNumber.length >= 6) {
      this.searchClient(documentType, documentNumber);
    }
  }

  searchStudentIfReady(): void {
    const documentType = this.paymentForm.get('studentDocumentType')?.value;
    const documentNumber = this.paymentForm.get('studentDocumentNumber')?.value;

    if (documentType && documentNumber && documentNumber.length >= 6) {
      this.searchStudent(documentType, documentNumber);
    }
  }

  searchClient(documentType: string, documentNumber: string): void {
    this.isSearchingClient = true;
    this.clientService.searchClientPayment(documentType, documentNumber).subscribe({
      next: (response) => {
        if (response && response.data && response.data.length > 0) {
          const client = response.data[0];
          this.paymentForm.patchValue({
            guardianFirstName: client.nombre || '',
            guardianLastName: client.apellido || '',
            guardianPhoneNumber: client.celular || '',
            guardianEmail: client.email || '',
            guardianAddress: client.direccion || ''
          });
        }
        this.isSearchingClient = false;
      },
      error: (error) => {
        console.error('Error searching client:', error);
        this.isSearchingClient = false;
      }
    });
  }

  searchStudent(documentType: string, documentNumber: string): void {
    this.studentService.searchStudentPayment(documentType, documentNumber).subscribe({
      next: (response) => {
        if (response && response.data && response.data.length > 0) {
          const student = response.data[0];
          this.paymentForm.patchValue({
            studentFirstName: student.nombre || '',
            studentLastName: student.apellido || '',
            studentGrado: student.grado || '',
            studentGrupo: '', // Removido student.grupo ya que no existe en el modelo
            studentSchool: student.colegio_id || ''
          });
        }
      },
      error: (error) => {
        console.error('Error searching student:', error);
      }
    });
  }

  onSubmit(): void {
    if (this.paymentForm.valid && !this.isSubmitting) {
      this.showConfirmation = true;
    } else {
      this.markFormGroupTouched(this.paymentForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
    });
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

  createAccountRecord(): void {
    const formData = this.paymentForm.value;
    const selectedCourse = this.independentCourses.find(course => course.id === formData.selectedCourse);

    // Obtener el precio del curso como número
    const coursePriceRaw: any = selectedCourse?.precio;
    const coursePriceNumber: number = typeof coursePriceRaw === 'string' 
      ? parseFloat(coursePriceRaw) 
      : Number(coursePriceRaw || 0);

    // Obtener el precio de inscripción del curso (si aplica) como número
    const inscriptionRaw: any = selectedCourse?.precio_inscripcion;
    const inscriptionNumber: number = typeof inscriptionRaw === 'string'
      ? parseFloat(inscriptionRaw)
      : Number(inscriptionRaw || 0);

    // Convertir inscripción a COP usando tasa correspondiente (EUR o USD)
    let inscriptionConvertedCop: number = 0;
    if (inscriptionNumber && inscriptionNumber > 0) {
      const rate = this.isEuroCourse ? this.eurToCop : this.usdToCop;
      // Si aún no se cargó la tasa, mantener valor 0 para evitar NaN
      inscriptionConvertedCop = rate ? Math.round(inscriptionNumber * rate) : 0;
    }

    // Usar la misma estructura que payment-record
    const paymentForm = {
      cliente: {
        tipo_documento: formData.guardianDocumentType,
        numero_documento: formData.guardianDocumentNumber,
        nombre: formData.guardianFirstName,
        apellido: formData.guardianLastName,
        celular: formData.guardianPhoneNumber,
        email: formData.guardianEmail,
        direccion: formData.guardianAddress,
      },
      estudiante: {
        tipo_documento: formData.studentDocumentType,
        numero_documento: formData.studentDocumentNumber,
        nombre: formData.studentFirstName,
        apellido: formData.studentLastName,
        grado: this.getCombinedGrado(),
        colegio: formData.studentSchool,
      },
      curso_id: selectedCourse?.id,
      colegios_cursos: [], // Array vacío para programas independientes
      precio: coursePriceNumber,
      // Enviar la inscripción ya convertida a COP
      precio_inscripcion: inscriptionConvertedCop,
      estado: 'PENDIENTE',
      fecha_creacion: new Date().toLocaleString('sv-SE', {timeZone: 'America/Bogota'})
    };

    console.log('Datos de cuenta por cobrar para programa independiente:', paymentForm);

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
        console.log('Cuenta por cobrar creada:', response);
        this.showNotificationMessage('Éxito', 'Registro de programa independiente creado exitosamente', 'success');
        this.isSubmitting = false;
        this.showConfirmation = false;
        // Opcional: resetear el formulario o redirigir
        // this.paymentForm.reset();
        // this.initForm();
      },
      error: (error) => {
        console.error('Error creating account receivable:', error);
        
        // Verificar si el error contiene un mensaje específico del servidor
        let errorMessage = 'Error al crear el registro del programa independiente';
        if (error?.error?.message) {
          // Si el mensaje contiene información sobre programa/colegio, usar mensaje genérico
          if (error.error.message.includes('programa') && error.error.message.includes('colegio')) {
            errorMessage = 'Error al procesar la solicitud. Intente nuevamente.';
          } else {
            errorMessage = error.error.message;
          }
        }
        
        this.showNotificationMessage('Error', errorMessage, 'error');
        this.isSubmitting = false;
      }
    });
  }

  getCombinedGrado(): string {
    const grado = this.paymentForm.get('studentGrado')?.value || '';
    const grupo = this.paymentForm.get('studentGrupo')?.value || '';

    if (grado && grupo) {
      return `${grado} ${grupo}`;
    }
    return grado;
  }

  showServerErrorNotification(errorMessage: string) {
    // Filtrar mensajes específicos sobre programa/colegio
    let filteredMessage = errorMessage;
    if (errorMessage && (errorMessage.includes('programa') && errorMessage.includes('colegio'))) {
      filteredMessage = 'Error al procesar la solicitud. Intente nuevamente.';
    }
    
    this.notificationData = {
      type: 'error',
      title: 'Error del servidor',
      message: filteredMessage || 'Ha ocurrido un error en el servidor. Por favor, inténtalo nuevamente.',
      duration: 7000
    };
    this.showNotification = true;
  }

  searchClientPaymentIfReady(): void {
    const documentType = this.paymentForm.get('guardianDocumentType')?.value;
    const documentNumber = this.paymentForm.get('guardianDocumentNumber')?.value;

    if (documentType && documentNumber && documentNumber.length >= 6) {
      this.searchClientPayment(documentType, documentNumber);
    } else {
      // Limpiar datos si no hay suficiente información
      this.showRegisteredCourses = false;
      this.clientData = null;
      this.registeredCourses = [];
    }
  }

  private searchClientPayment(documentType: string, documentNumber: string): void {
    this.isSearchingClient = true;
    this.clientService.searchClientPayment(documentType, documentNumber).subscribe({
      next: (data) => {
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
      },
      error: (error) => {
        this.isSearchingClient = false;
        console.error('Error searching client payment:', error);
        this.showRegisteredCourses = false;
        this.clientData = null;
        this.registeredCourses = [];
      }
    });
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

  private clearGuardianFields(): void {
    this.paymentForm.patchValue({
      guardianFirstName: '',
      guardianLastName: '',
      guardianPhoneNumber: '',
      guardianEmail: '',
      guardianAddress: ''
    });
  }

  private prepareRegisteredCoursesTable(client: any): void {
    this.registeredCourses = [];
    if (client.cuentas_cobrar && client.estudiantes) {
      client.cuentas_cobrar.forEach((cuenta: any, index: number) => {
        const student = client.estudiantes.find((est: any) => est.id === cuenta.estudiante_id.id);

        // Calcular el saldo pendiente (Precio del Curso - Total Abonado)
        const coursePriceNumber = cuenta.monto || 0;
        const courseInscriptionPriceNumber = cuenta.curso_id?.precio_inscripcion || 0;
        const totalPaidNumber = cuenta.saldo || 0;
        const pendingBalanceNumber = coursePriceNumber - totalPaidNumber;

        const isInscription = (() => {
          const val = cuenta.es_inscripcion;
          if (typeof val === 'string') {
            return val.trim().toUpperCase() === 'TRUE';
          }
          return !!val;
        })();

        const courseData = {
          id: cuenta.id,
          courseName: cuenta.curso_id?.nombre || 'N/A',
          isInscription: isInscription,
          studentName: student ? `${student.nombre} ${student.apellido}` : `${cuenta.estudiante_id.nombre} ${cuenta.estudiante_id.apellido}`,
          studentDocumentType: student ? student.tipo_documento : cuenta.estudiante_id.tipo_documento,
          studentDocumentNumber: student ? student.numero_documento : cuenta.estudiante_id.numero_documento,
          coursePrice: this.formatCurrency(coursePriceNumber), // Precio del curso
          coursePriceNumber: coursePriceNumber, // Valor numérico del precio
          courseInscriptionPriceNumber: courseInscriptionPriceNumber, // Valor numérico inscripción
          courseInscriptionCurrency: ((cuenta.curso_id?.nombre || '').toUpperCase() === '12F' || (cuenta.curso_id?.codigo || '').toUpperCase() === '12F') ? 'EUR' : 'USD',
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
      // Ordenar para que las inscripciones aparezcan primero
      this.registeredCourses.sort((a: any, b: any) => Number(b.isInscription) - Number(a.isInscription));
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  onPayCourse(courseData: any): void {
    // Implementar lógica de pago similar a payment-record
    console.log('Pagar curso:', courseData);
    // Aquí se puede abrir un modal de pago o redirigir a una página de pago
  }

  onViewPayments(courseData: any): void {
    this.selectedCourseForPayments = courseData;
    
    const account = this.clientData?.cuentas_cobrar?.find((cuenta: any) =>
      cuenta.id === courseData.id
    );

    if (account) {
      this.coursePayments = account.pagos || [];
      this.showPaymentsModal = true;
    } else {
      console.error('No se encontró la cuenta para mostrar los pagos');
      this.coursePayments = [];
      this.showPaymentsModal = true;
    }
  }

  closePaymentsModal(): void {
    this.showPaymentsModal = false;
    this.selectedCourseForPayments = null;
    this.coursePayments = [];
  }

  showNotificationMessage(title: string, message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    this.notificationData = {
      title,
      message,
      type,
      duration: 5000
    };
    this.showNotification = true;
  }

  closeNotification(): void {
    this.showNotification = false;
  }

  parseCurrencyToNumber(currencyString: string): number {
    if (!currencyString) return 0;
    return parseFloat(currencyString.replace(/[^0-9.-]+/g, '')) || 0;
  }
}