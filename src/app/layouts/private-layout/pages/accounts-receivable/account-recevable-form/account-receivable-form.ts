import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {AccountReceivable} from '../../../../../core/models/AccountReceivable';
import {DOCUMENT_TYPE} from '../../../../../core/const/DocumentTypeConst';
import {ClientService} from '../../../../../core/services/client.service';
import {StudentService} from '../../../../../core/services/student.service';
import {AccountReceivableService} from '../../../../../core/services/account-receivable.service';
import {NotificationService} from '../../../../../core/services/notification.service';


@Component({
  selector: 'app-account-receivable-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './account-receivable-form.html',
  standalone: true
})
export class AccountReceivableFormComponent implements OnInit {
  @Output() accountCreated = new EventEmitter<AccountReceivable>();
  @Output() formClosed = new EventEmitter<void>();
  accountForm: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;
  isSubmitting = false;
  clientId: string = '';
  studentId: string = '';

  COURSES = [
    { id: 'matematicas', name: 'Matemáticas' },
    { id: 'ciencias', name: 'Ciencias' },
    { id: 'ingles', name: 'Inglés' },
    { id: 'espanol', name: 'Español' },
    { id: 'historia', name: 'Historia' },
    { id: 'geografia', name: 'Geografía' },
    { id: 'fisica', name: 'Física' },
    { id: 'quimica', name: 'Química' },
    { id: 'biologia', name: 'Biología' },
    { id: 'educacion_fisica', name: 'Educación Física' }
  ];

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private studentService: StudentService,
    private accountReceivableService: AccountReceivableService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.accountForm = this.fb.group({
      client_id: [null,],
      student_id: [null],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      deadline: ['', [Validators.required]],
      description: [null],
      clientDocumentType: ['', [Validators.required]],
      clientDocumentNumber: ['', [Validators.required]],
      clientName: [''],
      clientEmail: [''],
      clientPhone: [''],
      studentDocumentType: ['', [Validators.required]],
      studentDocumentNumber: ['', [Validators.required]],
      studentName: [''],
      colegio: [''],
      course: ['', [Validators.required]]
    });

    // Suscribirse a cambios en los campos de documento del cliente
    this.accountForm.get('clientDocumentType')?.valueChanges.subscribe(() => {
      this.searchClientInfo();
    });

    this.accountForm.get('clientDocumentNumber')?.valueChanges.subscribe(() => {
      this.searchClientInfo();
    });

    // Suscribirse a cambios en los campos de documento del estudiante
    this.accountForm.get('studentDocumentType')?.valueChanges.subscribe(() => {
      this.searchStudentInfo();
    });

    this.accountForm.get('studentDocumentNumber')?.valueChanges.subscribe(() => {
      this.searchStudentInfo();
    });

    // Sincronizar saldo con monto inicialmente
    this.accountForm.get('monto')?.valueChanges.subscribe((monto) => {
      if (monto && !this.accountForm.get('saldo')?.value) {
        this.accountForm.patchValue({ saldo: monto });
      }
    });
  }

  searchClientInfo(): void {
    const documentType = this.accountForm.get('clientDocumentType')?.value;
    const documentNumber = this.accountForm.get('clientDocumentNumber')?.value;
    if (!documentType || !documentNumber || documentNumber.toString().length < 6) {
      this.clientId = '';
      this.accountForm.patchValue({
        clientName: '',
        clientEmail: '',
        clientPhone: ''
      });
      return;
    }

    this.clientService.searchClientByDocument(documentType, documentNumber.toString()).subscribe({
      next: (response) => {
        console.log('Respuesta del servicio cliente:', response); // Debug log
        if (response.data && response.data.length > 0) {
          const client = response.data[0];
          this.clientId = client.id ? client.id.toString() : '';
          this.accountForm.patchValue({
            clientName: `${client.nombre || ''} ${client.apellido || ''}`.trim(),
            clientEmail: client.email || '',
            clientPhone: client.celular || ''
          });

        } else {
          this.clientId = '';
          this.accountForm.patchValue({
            clientName: '',
            clientEmail: '',
            clientPhone: ''
          });
        }
      },
      error: (error) => {
        this.clientId = '';
        this.accountForm.patchValue({
          clientName: '',
          clientEmail: '',
          clientPhone: ''
        });
      }
    });
  }

  searchStudentInfo(): void {
    const documentType = this.accountForm.get('studentDocumentType')?.value;
    const documentNumber = this.accountForm.get('studentDocumentNumber')?.value;
    if (!documentType || !documentNumber || documentNumber.toString().length < 6) {
      this.studentId = '';
      this.accountForm.patchValue({
        studentName: '',
        colegio: ''
      });
      return;
    }

    this.studentService.searchStudentByDocument(documentType, documentNumber.toString()).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          const student = response.data[0];
          this.studentId = student.id ? student.id.toString() : '';
          this.accountForm.patchValue({
            studentName: `${student.nombre || ''} ${student.apellido || ''}`.trim(),
            colegio: student.colegio || ''
          });

        } else {
          this.studentId = '';
          this.accountForm.patchValue({
            studentName: '',
            colegio: ''
          });
        }
      },
      error: (error) => {
        this.studentId = '';
        this.accountForm.patchValue({
          studentName: '',
          colegio: ''
        });
      }
    });
  }

  onSubmit() {
    // Validar que el formulario sea válido y que tengamos los IDs necesarios
    if (this.accountForm.valid && !this.isSubmitting && this.clientId && this.studentId) {
      this.isSubmitting = true;

      const accountReceivableData = {
        cliente_id: this.clientId, // Mantener como string UUID
        estudiante_id: this.studentId, // Mantener como string UUID
        monto: this.accountForm.get('amount')?.value,
        curso: this.accountForm.get('course')?.value,
        fecha_limite: this.accountForm.get('deadline')?.value,
        observaciones: this.accountForm.get('description')?.value,
        estado: 'pendiente'
      };

      this.accountReceivableService.createAccountReceivable(accountReceivableData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.notificationService.showSuccess(
            'Cuenta por cobrar creada',
            'La cuenta por cobrar ha sido registrada exitosamente.'
          );

          const formData: AccountReceivable = {
            id: response.data.id,
            cliente_id: this.clientId,
            estudiante_id: this.studentId,
            monto: this.accountForm.get('amount')?.value,
            saldo: this.accountForm.get('amount')?.value,
            curso: this.accountForm.get('course')?.value,
            fecha_limite: this.accountForm.get('deadline')?.value,
            estado: 'pendiente',
            clientName: this.accountForm.get('clientName')?.value,
            clientEmail: this.accountForm.get('clientEmail')?.value,
            studentName: this.accountForm.get('studentName')?.value,
            createdDate: new Date().toISOString().split('T')[0]
          };

          this.accountCreated.emit(formData);
          this.accountForm.reset();
          this.clientId = '';
          this.studentId = '';
        },
        error: (error) => {
          this.isSubmitting = false;
          if (error.status >= 500) {
            this.notificationService.showServerError();
          } else {
            this.notificationService.showError(
              'Error',
              'No se pudo crear la cuenta por cobrar. Inténtalo nuevamente.'
            );
          }
        }
      });
    } else {
      // Mostrar qué validaciones faltan
      if (!this.clientId) {
        this.notificationService.showError('Error', 'Debe seleccionar un cliente válido.');
      } else if (!this.studentId) {
        this.notificationService.showError('Error', 'Debe seleccionar un estudiante válido.');
      } else {
        this.markFormGroupTouched();
      }
    }
  }

  onCancel() {
    this.accountForm.reset();
    this.clientId = '';
    this.studentId = '';
    this.formClosed.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.accountForm.controls).forEach(key => {
      const control = this.accountForm.get(key);
      control?.markAsTouched();
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.accountForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const control = this.accountForm.get(fieldName);
    if (control && control.errors && control.touched) {
      if (control.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} es obligatorio`;
      }
      if (control.errors['email']) {
        return 'Ingrese un email válido';
      }
      if (control.errors['minlength']) {
        return `${this.getFieldDisplayName(fieldName)} debe tener al menos ${control.errors['minlength'].requiredLength} caracteres`;
      }
      if (control.errors['pattern']) {
        return `${this.getFieldDisplayName(fieldName)} no tiene el formato correcto`;
      }
      if (control.errors['min']) {
        return `${this.getFieldDisplayName(fieldName)} debe ser mayor a ${control.errors['min'].min}`;
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      'clientDocumentType': 'Tipo de documento del cliente',
      'clientDocumentNumber': 'Número de documento del cliente',
      'clientName': 'Nombre del cliente',
      'clientEmail': 'Email del cliente',
      'clientPhone': 'Teléfono del cliente',
      'studentDocumentType': 'Tipo de documento del estudiante',
      'studentDocumentNumber': 'Número de documento del estudiante',
      'studentName': 'Nombre del estudiante',
      'colegio': 'Colegio',
      'curso': 'Curso',
      'monto': 'Monto',
      'saldo': 'Saldo',
      'fecha_limite': 'Fecha límite'
    };
    return fieldNames[fieldName] || fieldName;
  }
}
