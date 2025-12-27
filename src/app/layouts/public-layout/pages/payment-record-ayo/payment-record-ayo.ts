import { Component, OnInit } from '@angular/core';
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
import { NotificationModalComponent, NotificationData } from '../../../../components/notification-modal/notification-modal';

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
    showConfirmation: boolean = false;

    // Notification
    showNotification: boolean = false;
    notificationData: NotificationData | null = null;

    constructor(
        private formBuilder: FormBuilder,
        private programaAyoService: ProgramaAyoService,
        private clientService: ClientService,
        private studentService: StudentService,
        private schoolService: SchoolService,
        private accountReceivableService: AccountReceivableService
    ) { }

    ngOnInit(): void {
        this.loadPrecioPrograma();
        this.paymentForm = this.formBuilder.group({
            tipoDocumento: ['', Validators.required],
            numeroDocumento: ['', Validators.required],
            nombre: ['', Validators.required],
            apellido: ['', Validators.required],
            celular: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
            email: ['', [Validators.required, Validators.email]],
            direccion: ['', Validators.required],
            // Student Information
            studentTipoDocumento: ['', Validators.required],
            studentNumeroDocumento: ['', Validators.required],
            studentNombre: ['', Validators.required],
            studentApellido: ['', Validators.required],
            studentEmail: ['', [Validators.required, Validators.email]],
            studentColegio: ['', Validators.required]
        });
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
                } else {
                    this.clearGuardianFields();
                    this.clientData = null;
                }
            },
            error: (error) => {
                this.isSearchingClient = false;
                console.error('Error searching client:', error);
                this.clearGuardianFields();
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
            studentEmail: student.email || '', // Assuming student model has email
            studentColegio: student.colegio || ''
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
            this.paymentForm.get('studentColegio')?.setValue(schoolName);
        } else if (schoolId) {
            this.schoolService.getSchoolById(schoolId).subscribe({
                next: (response) => {
                    if (response.data) {
                        this.paymentForm.get('studentColegio')?.setValue(response.data.nombre);
                    }
                },
                error: (error) => {
                    console.error('Error loading school name:', error);
                }
            });
        } else if (student.colegio_independiente) {
            this.paymentForm.get('studentColegio')?.setValue(student.colegio_independiente);
        } else if (student.colegio && typeof student.colegio === 'string' && student.colegio.length > 20) {
             // Assuming long string might be an ID if not a direct name, but payment-record logic treats 'colegio' field as potential ID too
             // Simple fallback
             this.paymentForm.get('studentColegio')?.setValue(student.colegio);
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
}
