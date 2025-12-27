import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProgramaAyoService } from '../../../../core/services/programa-ayo.service';
import { PrecioProgramaAyo } from '../../../../core/models/Course';
import { DOCUMENT_TYPE } from '../../../../core/const/DocumentTypeConst';
import { ClientService } from '../../../../core/services/client.service';
import { StudentService } from '../../../../core/services/student.service';
import { SchoolService } from '../../../../core/services/school.service';
import { AccountReceivableService } from '../../../../core/services/account-receivable.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { ExchangeRateService } from '../../../../core/services/exchange-rate.service';
import { PaymentModel } from '../../../../core/models/AccountReceivable';
import { environment } from '../../../../../environments/environment';
import * as CryptoJS from 'crypto-js';
import { NotificationModalComponent, NotificationData } from '../../../../components/notification-modal/notification-modal';

declare var WidgetCheckout: any;

@Component({
    selector: 'app-payment-record-ayo',
    standalone: true,
    imports: [ReactiveFormsModule, CommonModule, RouterModule, NotificationModalComponent],
    templateUrl: './payment-record-ayo.html',
    styleUrls: ['./payment-record-ayo.css']
})
export class PaymentRecordAyoComponent implements OnInit {
    paymentForm!: FormGroup;
    isLoading: boolean = false;
    precioPrograma: PrecioProgramaAyo | null = null;
    DOCUMENT_TYPE = DOCUMENT_TYPE;

    // Search flags
    isSearchingClient = false;
    isSearchingStudent = false;
    clientData: any = null;
    studentData: any = null;

    // Confirmation flag
    public showConfirmation: boolean = false;
    public showRegisteredCourses: boolean = false;
    public showAddCourseForm: boolean = false;
    public registeredCourses: any[] = [];

    // Notification
    showNotification: boolean = false;
    notificationData: NotificationData | null = null;

    // Properties for payments modal
    showPaymentsModal = false;
    selectedAccountData: any = null;
    selectedAccountPayments: PaymentModel[] = [];

    // Properties for payment modal
    showPaymentModal = false;
    paymentModalData: any = null;
    totalAmountToPay = 0;
    editablePaymentAmount = 0;

    // Exchange rates
    usdToCop: number | null = null;
    eurToCop: number | null = null;
    usdRateErrorNotified: boolean = false;
    eurRateErrorNotified: boolean = false;
    isExchangeRateError: boolean = false;

    readonly openProgramSchoolId = 'dfdc71c9-20ab-4981-865f-f5e93fa3efc7';

    // School and Grade properties
    grado: any[] = []; // Should be Grupo[] but using any for safety if model not imported
    filteredSchools: any[] = []; // Should be School[]
    isLoadingSchools: boolean = false;
    isSchoolSelected: boolean = false;
    @ViewChild('schoolSearchInput') schoolSearchInput!: ElementRef;

    constructor(
        private formBuilder: FormBuilder,
        private programaAyoService: ProgramaAyoService,
        private clientService: ClientService,
        private studentService: StudentService,
        private schoolService: SchoolService,
        private accountReceivableService: AccountReceivableService,
        private paymentService: PaymentService,
        private exchangeRateService: ExchangeRateService,
        private cdRef: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadPrecioPrograma();
        this.loadGrupos();
        this.paymentForm = this.formBuilder.group({
            tipoDocumento: ['', Validators.required],
            numeroDocumento: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^[0-9]+$/)]],
            nombre: ['', [Validators.required, Validators.minLength(2)]],
            apellido: ['', [Validators.required, Validators.minLength(2)]],
            celular: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
            email: ['', [Validators.required, Validators.email]],
            direccion: ['', [Validators.required, Validators.minLength(10)]],
            // Student Information
            studentTipoDocumento: ['', Validators.required],
            studentNumeroDocumento: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^[0-9]+$/)]],
            studentNombre: ['', [Validators.required, Validators.minLength(2)]],
            studentApellido: ['', [Validators.required, Validators.minLength(2)]],
            studentEmail: ['', [Validators.required, Validators.email]],
            studentGrado: ['', Validators.required],
            studentGrupo: ['', Validators.required],
            studentSchool: [''], // Holds ID if selected
            schoolSearchTerm: [''], // Search input
            independentInstitution: [''], // Manual entry
            isOpenProgram: [false] // Optional toggle
        });

        const independentCtrl = this.paymentForm.get('independentInstitution');
        independentCtrl?.valueChanges.subscribe((val: any) => {
            if (typeof val === 'string') {
                const capitalized = this.capitalizeText(val || '');
                if (capitalized !== val) {
                    independentCtrl.setValue(capitalized, { emitEvent: false });
                }
            }
        });
    }

    loadGrupos(): void {
        this.schoolService.getGroup().subscribe({
            next: (response) => {
                if (response.data) {
                    this.grado = response.data;
                }
            },
            error: (error) => {
                console.error('Error loading groups:', error);
            }
        });
    }

    onStudentGradoChange(event: any): void {
        const value = event.target.value.toUpperCase();
        this.paymentForm.get('studentGrado')?.setValue(value, { emitEvent: false });
    }

    onSchoolSearchFocus(): void {
        try {
            const isMobileViewport = window.innerWidth <= 768;
            if (!isMobileViewport) return;
            setTimeout(() => {
                const el = this.schoolSearchInput?.nativeElement;
                if (!el) return;
                const offset = 16;
                const top = el.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }, 150);
        } catch (e) {
            this.schoolSearchInput?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    onSchoolSearch(event: any): void {
        const searchTerm = (event.target.value || '').toString();
        this.paymentForm.get('schoolSearchTerm')?.setValue(searchTerm);
        this.isSchoolSelected = false; // Reset cuando el usuario empieza a escribir

        // Limpiar el valor del colegio seleccionado cuando el usuario empieza a escribir
        this.paymentForm.get('studentSchool')?.setValue('');

        const trimmed = searchTerm.trim();
        if (!trimmed || trimmed.length < 2) {
            this.filteredSchools = [];
            this.isLoadingSchools = false;
            this.cdRef.detectChanges();
            return;
        }

        // Buscar inmediatamente para evitar demoras por throttling de timers en móviles
        this.searchSchools(trimmed);
    }

    searchSchools(searchTerm: string): void {
        this.isLoadingSchools = true;
        this.cdRef.detectChanges();
        this.schoolService.searchSchool(searchTerm, 1, 15).subscribe({
            next: (response) => {
                const data = response.data || [];
                const normalizedTerm = this.normalize(searchTerm);
                const accentMatches = data.filter(s => {
                    const name = this.normalize(s.nombre || '');
                    const city = this.normalize(s.ciudad || '');
                    return name.includes(normalizedTerm) || city.includes(normalizedTerm);
                });

                if (accentMatches.length > 0) {
                    this.filteredSchools = accentMatches.slice(0, 10);
                    this.isLoadingSchools = false;
                    this.cdRef.detectChanges();
                    return;
                }

                // Fallback: ampliar búsqueda y filtrar localmente sin acentos
                this.schoolService.getAllSchools(1, 100).subscribe({
                    next: (allResp) => {
                        const all = allResp.data || [];
                        this.filteredSchools = all.filter(s => {
                            const name = this.normalize(s.nombre || '');
                            const city = this.normalize(s.ciudad || '');
                            return name.includes(normalizedTerm) || city.includes(normalizedTerm);
                        }).slice(0, 10);
                        this.isLoadingSchools = false;
                        this.cdRef.detectChanges();
                    },
                    error: () => {
                        this.filteredSchools = [];
                        this.isLoadingSchools = false;
                        this.cdRef.detectChanges();
                    }
                });
            },
            error: (error) => {
                console.error('Error searching schools:', error);
                this.filteredSchools = [];
                this.isLoadingSchools = false;
                this.cdRef.detectChanges();
            }
        });
    }

    private normalize(value: string): string {
        return (value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }


    clearSchoolSearch(): void {
        this.paymentForm.get('schoolSearchTerm')?.setValue('');
        this.filteredSchools = [];
        this.isSchoolSelected = false;
        this.paymentForm.get('studentSchool')?.setValue('');
        this.cdRef.detectChanges();
    }

    onOpenProgramChange(event: any): void {
        const checked = !!event.target.checked;
        this.paymentForm.get('isOpenProgram')?.setValue(checked);
        const indCtrl = this.paymentForm.get('independentInstitution');
        if (checked) {
            this.paymentForm.get('studentSchool')?.setValue(this.openProgramSchoolId);
            this.paymentForm.get('studentSchool')?.updateValueAndValidity();
            this.paymentForm.get('schoolSearchTerm')?.setValue('');
            this.filteredSchools = [];
            this.isSchoolSelected = true;

        } else {
            this.paymentForm.get('independentInstitution')?.setValue('');
            this.clearSchoolSearch();
        }
    }

    onResultsTouchStart(): void {
        // Prevent default to avoid blur issues on some mobile devices when scrolling results
    }

    loadPrecioPrograma(): void {
        this.programaAyoService.getPrecioProgramaAyo().subscribe({
            next: (response) => {
                if (response.data && response.data.length > 0) {
                    this.precioPrograma = response.data[0];
                }
            },
            error: (error) => {
                console.error('Error loading program price:', error);
            }
        });
    }

    // --- Guardian Search Logic ---

    onGuardianDocumentTypeChange(event: any): void {
        this.searchClientIfReady();
    }

    onGuardianDocumentNumberChange(event: any): void {
        this.searchClientIfReady();
    }

    onGuardianNameChange(event: any): void {
        const value = this.capitalizeText(event.target.value);
        this.paymentForm.get('nombre')?.setValue(value, { emitEvent: false });
    }

    onGuardianSurnameChange(event: any): void {
        const value = this.capitalizeText(event.target.value);
        this.paymentForm.get('apellido')?.setValue(value, { emitEvent: false });
    }

    capitalizeText(text: string): string {
        if (!text) return '';
        return text.toLowerCase().replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
    }

    private searchClientIfReady(): void {
        const documentType = this.paymentForm.get('tipoDocumento')?.value;
        const documentNumber = this.paymentForm.get('numeroDocumento')?.value;

        if (documentType && documentNumber && documentNumber.length >= 6) {
            this.searchClientPayment(documentType, documentNumber);
        } else {
            this.clearGuardianFields();
        }
    }

    private searchClientPayment(documentType: string, documentNumber: string): void {
        this.isSearchingClient = true;
        this.clientService.searchClientPayment(documentType, documentNumber).subscribe({
            next: (data) => {
                this.isSearchingClient = false;
                if (data.data && data.data.length > 0) {
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
                    this.clientData = null;
                    this.registeredCourses = [];
                    this.showRegisteredCourses = false;
                }
            },
            error: (error) => {
                this.isSearchingClient = false;
                console.error('Error searching client:', error);
                this.clearGuardianFields();
                this.registeredCourses = [];
                this.showRegisteredCourses = false;
            }
        });
    }

    private fillGuardianFields(client: any): void {
        this.paymentForm.patchValue({
            nombre: client.nombre || '',
            apellido: client.apellido || '',
            celular: client.celular || '',
            email: client.email || '',
            direccion: client.direccion || ''
        });
    }

    private clearGuardianFields(): void {
        // Only clear if we are not manually typing (this logic can be tricky,
        // usually we clear if search fails to avoid mismatched data,
        // but if user is typing a new person, we might not want to clear immediately.
        // However, following payment-record logic, it clears fields if search fails or input is invalid)
        this.paymentForm.patchValue({
            nombre: '',
            apellido: '',
            celular: '',
            email: '',
            direccion: ''
        });
    }

    // --- Student Search Logic ---

    onStudentDocumentTypeChange(event: any): void {
        this.searchStudentIfReady();
    }

    onStudentDocumentNumberChange(event: any): void {
        this.searchStudentIfReady();
    }

    onStudentNameChange(event: any): void {
        const value = this.capitalizeText(event.target.value);
        this.paymentForm.get('studentNombre')?.setValue(value, { emitEvent: false });
    }

    onStudentSurnameChange(event: any): void {
        const value = this.capitalizeText(event.target.value);
        this.paymentForm.get('studentApellido')?.setValue(value, { emitEvent: false });
    }

    onStudentSchoolChange(event: any): void {
        const value = this.capitalizeText(event.target.value);
        this.paymentForm.get('studentColegio')?.setValue(value, { emitEvent: false });
    }

    private searchStudentIfReady(): void {
        const documentType = this.paymentForm.get('studentTipoDocumento')?.value;
        const documentNumber = this.paymentForm.get('studentNumeroDocumento')?.value;

        if (documentType && documentNumber && documentNumber.length >= 6) {
            this.searchStudentPayment(documentType, documentNumber);
        }
    }

    private searchStudentPayment(documentType: string, documentNumber: string): void {
        this.isSearchingStudent = true;
        this.studentService.searchStudentPayment(documentType, documentNumber).subscribe({
            next: (data) => {
                this.isSearchingStudent = false;
                if (data.data && data.data.length > 0) {
                    this.studentData = data.data[0];
                    this.fillStudentFields(this.studentData);
                } else {
                    this.clearStudentFields();
                }
            },
            error: (error) => {
                this.isSearchingStudent = false;
                console.error('Error searching student:', error);
                this.clearStudentFields();
            }
        });
    }

    private fillStudentFields(student: any): void {
        this.paymentForm.patchValue({
            studentNombre: student.nombre || '',
            studentApellido: student.apellido || '',
            studentEmail: student.email || '',
            studentGrado: student.grado || '',
            studentGrupo: '', // Often not in student model or variable
        });

        // Handle Colegio Logic similar to payment-record
        let schoolId = null;
        let schoolName = '';

        if (student.colegio_id) {
            if (typeof student.colegio_id === 'object' && student.colegio_id.id) {
                schoolId = student.colegio_id.id;
                schoolName = student.colegio_id.nombre || '';
            } else if (typeof student.colegio_id === 'string') {
                schoolId = student.colegio_id;
            }
        }

        if (schoolName) {
            this.paymentForm.get('schoolSearchTerm')?.setValue(schoolName);
            this.paymentForm.get('studentSchool')?.setValue(schoolId);
            // Do not set isSchoolSelected = true to allow changes
        } else if (schoolId) {
            this.schoolService.getSchoolById(schoolId).subscribe({
                next: (response) => {
                    if (response.data) {
                        this.paymentForm.get('schoolSearchTerm')?.setValue(response.data.nombre);
                        this.paymentForm.get('studentSchool')?.setValue(schoolId);
                    }
                },
                error: (error) => {
                    console.error('Error loading school name:', error);
                }
            });
        } else if (student.colegio_independiente) {
            this.paymentForm.get('isOpenProgram')?.setValue(true);
            this.paymentForm.get('independentInstitution')?.setValue(student.colegio_independiente);
            this.paymentForm.get('studentSchool')?.setValue(this.openProgramSchoolId);
            this.isSchoolSelected = true;
        } else if (student.colegio && typeof student.colegio === 'string') {
             // Compatibility
             this.paymentForm.get('schoolSearchTerm')?.setValue(student.colegio);
             this.paymentForm.get('studentSchool')?.setValue(student.colegio); // Might be ID or name, best effort
        }
    }

    private clearStudentFields(): void {
        this.paymentForm.patchValue({
            studentNombre: '',
            studentApellido: '',
            studentEmail: '',
            studentColegio: ''
        });
    }

    onSubmit() {
        if (this.paymentForm.invalid) {
            this.paymentForm.markAllAsTouched();
            return;
        }
        this.isLoading = true;

        const formData = this.paymentForm.value;

        const cleanPayload = (obj: any) => {
            return Object.entries(obj).reduce((acc: any, [key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    acc[key] = value;
                }
                return acc;
            }, {});
        };

        const payload = {
            acudiente: cleanPayload({
                tipo_documento: formData.tipoDocumento,
                numero_documento: formData.numeroDocumento,
                nombre: formData.nombre,
                apellido: formData.apellido,
                celular: formData.celular,
                email: formData.email,
                direccion: formData.direccion
            }),
            estudiante: cleanPayload({
                tipo_documento: formData.studentTipoDocumento,
                numero_documento: formData.studentNumeroDocumento,
                nombre: formData.studentNombre,
                apellido: formData.studentApellido,
                email: formData.studentEmail,
                colegio: formData.studentColegio
            }),
            precio_programa: this.precioPrograma?.precio || 0,
            precio_inscripcion: 0,
            fecha_creacion: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
        };

        this.accountReceivableService.createPaymentRecordAyo(payload).subscribe({
            next: (response) => {
                this.isLoading = false;
                if (response.status === 'SUCCES') {
                    this.showSuccessNotification('Programa AYO creado correctamente');

                    const docType = this.paymentForm.get('tipoDocumento')?.value;
                    const docNum = this.paymentForm.get('numeroDocumento')?.value;

                    this.clientService.searchClientPayment(docType, docNum).subscribe({
                        next: (data) => {
                            if (data.data && data.data.length > 0) {
                                this.showConfirmation = false;
                                this.showRegisteredCourses = true;
                                this.prepareRegisteredCoursesTable(data.data[0]);
                                window.scrollTo(0, 0);
                            }
                        },
                        error: (error) => {
                            console.error('Error refreshing client data:', error);
                        }
                    });
                } else {
                    this.showErrorNotification('Error inesperado. Inténtelo más tarde.');
                }
            },
            error: (error) => {
                this.isLoading = false;
                console.error('Error submitting payment record:', error);
                this.showErrorNotification('Error inesperado. Inténtelo más tarde.');
            }
        });
    }

    showSuccessNotification(message: string) {
        this.notificationData = {
            type: 'success',
            title: 'Éxito',
            message: message,
            duration: 5000
        };
        this.showNotification = true;
    }

    showErrorNotification(message: string) {
        this.notificationData = {
            type: 'error',
            title: 'Error',
            message: message,
            duration: 5000
        };
        this.showNotification = true;
    }

    onNotificationClose() {
        this.showNotification = false;
        this.notificationData = null;
    }

    onContinue(): void {
        if (this.paymentForm.invalid) {
            this.paymentForm.markAllAsTouched();
            return;
        }
        this.showConfirmation = true;
        window.scrollTo(0, 0);
    }

    onEdit(): void {
        this.showConfirmation = false;
        window.scrollTo(0, 0);
    }

    showAddCourseFormView(): void {
        this.showAddCourseForm = true;
        this.clearStudentFields();
        // Scroll to student info
        setTimeout(() => {
            const element = document.getElementById('studentInfoCard');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }

    private prepareRegisteredCoursesTable(client: any): void {
        this.registeredCourses = [];
        if (client.cuentas_cobrar && client.estudiantes) {
            client.cuentas_cobrar.forEach((cuenta: any) => {
                const student = client.estudiantes.find((est: any) => est.id === cuenta.estudiante_id.id);

                const coursePriceNumber = cuenta.monto || 0;
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
                    coursePrice: this.formatCurrency(coursePriceNumber),
                    coursePriceNumber: coursePriceNumber,
                    balance: this.formatCurrency(totalPaidNumber),
                    balanceNumber: totalPaidNumber,
                    pendingBalance: this.formatCurrency(pendingBalanceNumber),
                    pendingBalanceNumber: pendingBalanceNumber,
                    status: cuenta.estado,
                    courseId: cuenta.curso_id?.id,
                    date: cuenta.created_at,
                };
                this.registeredCourses.push(courseData);
            });
            this.registeredCourses.sort((a: any, b: any) => Number(b.isInscription) - Number(a.isInscription));
        }
    }

    formatCurrency(amount: number): string {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
    }

    onPayCourse(courseData: any): void {
        // Buscar la cuenta original por ID para validar si tiene inscripción pendiente
        const account = this.clientData?.cuentas_cobrar?.find((cuenta: any) => cuenta.id === courseData.id);
        if (account) {
            let hasPendingInscription = false;
            // Caso 1: la inscripción viene expandida en id_inscripcion
            if (account.id_inscripcion && typeof account.id_inscripcion === 'object') {
                hasPendingInscription = (account.id_inscripcion.estado === 'PENDIENTE');
            } else {
                // Caso 2: buscar una cuenta marcada como inscripción para el mismo curso y estudiante
                const pendingInscription = (this.clientData?.cuentas_cobrar || []).find((c: any) =>
                    (c.es_inscripcion === 'TRUE') &&
                    (c.estado === 'PENDIENTE') &&
                    ((c.curso_id?.id || c.curso_id) === (account.curso_id?.id || account.curso_id)) &&
                    ((c.estudiante_id?.id || c.estudiante_id) === (account.estudiante_id?.id || account.estudiante_id))
                );
                hasPendingInscription = !!pendingInscription;
            }

            // Si la cuenta actual no es de inscripción y tiene inscripción pendiente, bloquear y avisar
            if (hasPendingInscription && account.es_inscripcion !== 'TRUE') {
                this.notificationData = {
                    type: 'error',
                    title: 'Inscripción pendiente',
                    message: 'Para poder realizar el pago del programa, debe primero pagar la Inscripción',
                    duration: 6000
                };
                this.showNotification = true;
                return;
            }
        }

        const coursePrice = courseData.coursePriceNumber || 0;
        const balance = this.parseCurrencyToNumber(courseData.balance) || 0;
        this.totalAmountToPay = coursePrice - balance;
        this.editablePaymentAmount = this.totalAmountToPay;

        // Configurar los datos del modal con toda la información necesaria
        this.paymentModalData = {
            ...courseData,
            clientName: this.clientData?.nombre + ' ' + this.clientData?.apellido,
            clientDocumentType: this.paymentForm.get('tipoDocumento')?.value,
            clientDocumentNumber: this.paymentForm.get('numeroDocumento')?.value,
            clientEmail: this.clientData?.email || this.paymentForm.get('email')?.value,
            clientPhone: this.clientData?.celular || this.paymentForm.get('celular')?.value,
            // Información del estudiante
            studentName: this.paymentForm.get('studentNombre')?.value + ' ' + this.paymentForm.get('studentApellido')?.value,
            studentDocumentType: this.paymentForm.get('studentTipoDocumento')?.value,
            studentDocumentNumber: this.paymentForm.get('studentNumeroDocumento')?.value
        };

        this.showPaymentModal = true;
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
          ${(() => {
                const inscription = (this.selectedAccountData as any).courseInscriptionPriceNumber;
                return inscription && inscription > 0 ? `
              <div class="info-item">
                <span class="info-label">Precio de Inscripción:</span>
                <span class="info-value">$${inscription.toLocaleString('es-CO')}</span>
              </div>
            ` : '';
            })()}
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
            ${(() => {
                const inscription = (this.selectedAccountData as any).courseInscriptionPriceNumber;
                return inscription && inscription > 0 ? `
                <div class="summary-item">
                  <div class="summary-label">Inscripción</div>
                  <div class="summary-value">$${inscription.toLocaleString('es-CO')}</div>
                </div>
              ` : '';
            })()}
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
                this.showSuccessNotification('Pago realizado con éxito');
                this.searchClientIfReady(); // Refresh table
            } else {
                this.showErrorNotification('El pago no fue aprobado o fue cancelado');
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

    private parseCurrencyToNumber(currencyString: string): number {
        if (!currencyString) return 0;
        return parseFloat(currencyString.replace(/[^\d]/g, ''));
    }
}
