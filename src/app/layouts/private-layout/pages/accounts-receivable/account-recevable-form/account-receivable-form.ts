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
      clientDocumentType: ['', [Validators.required]],
      clientDocumentNumber: ['', [Validators.required, Validators.minLength(6)]],
      clientName: ['', [Validators.required, Validators.minLength(2)]],
      clientEmail: ['', [Validators.required, Validators.email]],
      clientPhone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      studentDocumentType: ['', [Validators.required]],
      studentDocumentNumber: ['', [Validators.required, Validators.minLength(6)]],
      studentName: ['', [Validators.required, Validators.minLength(2)]],
      colegio: ['', [Validators.required, Validators.minLength(2)]],
      curso: ['', [Validators.required]],
      monto: [0, [Validators.required, Validators.min(0.01)]],
      saldo: [0, [Validators.required, Validators.min(0)]],
      fecha_limite: ['', [Validators.required]]
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

    // Solo buscar si ambos campos tienen valor y el número tiene al menos 6 caracteres
    if (documentType && documentNumber && documentNumber.length >= 6) {
      this.clientService.searchClientByDocument(documentType, documentNumber).subscribe({
        next: (response) => {
          if (response.data && response.data.length > 0) {
            const client = response.data[0];
            this.clientId = client.id ? client.id.toString() : '';
            // Llenar automáticamente los campos del cliente
            this.accountForm.patchValue({
              clientName: `${client.nombre} ${client.apellido}`,
              clientEmail: client.email,
              clientPhone: client.celular
            });
          } else {
            this.clientId = '';
          }
        },
        error: (error) => {
          console.error('Error al buscar cliente:', error);
          this.clientId = '';
        }
      });
    } else {
      this.clientId = '';
    }
  }

  searchStudentInfo(): void {
    const documentType = this.accountForm.get('studentDocumentType')?.value;
    const documentNumber = this.accountForm.get('studentDocumentNumber')?.value;

    // Solo buscar si ambos campos tienen valor y el número tiene al menos 6 caracteres
    if (documentType && documentNumber && documentNumber.length >= 6) {
      this.studentService.searchStudentByDocument(documentType, documentNumber).subscribe({
        next: (response) => {
          if (response.data && response.data.length > 0) {
            const student = response.data[0];
            this.studentId = student.id ? student.id.toString() : '';
            // Llenar automáticamente los campos del estudiante
            this.accountForm.patchValue({
              studentName: `${student.nombre} ${student.apellido}`,
              colegio: student.colegio
            });
          } else {
            this.studentId = '';
          }
        },
        error: (error) => {
          console.error('Error al buscar estudiante:', error);
          this.studentId = '';
        }
      });
    } else {
      this.studentId = '';
    }
  }

  onSubmit() {
    if (this.accountForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      // Preparar los datos para enviar a Directus
      const accountReceivableData = {
        cliente_id: this.clientId,
        estudiante_id: this.studentId,
        monto: this.accountForm.get('monto')?.value,
        saldo: this.accountForm.get('saldo')?.value,
        curso: this.accountForm.get('curso')?.value,
        fecha_limite: this.accountForm.get('fecha_limite')?.value,
        estado: 'pendiente'
      };

      this.accountReceivableService.createAccountReceivable(accountReceivableData).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.notificationService.showSuccess(
            'Cuenta por cobrar creada',
            'La cuenta por cobrar ha sido registrada exitosamente.'
          );

          // Emitir el evento con los datos del formulario para la UI local
          const formData: AccountReceivable = {
            id: response.data.id,
            cliente_id: this.clientId,
            estudiante_id: this.studentId,
            monto: this.accountForm.get('monto')?.value,
            saldo: this.accountForm.get('saldo')?.value,
            curso: this.accountForm.get('curso')?.value,
            fecha_limite: this.accountForm.get('fecha_limite')?.value,
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
          console.error('Error al crear cuenta por cobrar:', error);

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
      this.markFormGroupTouched();
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
    const field = this.accountForm.get(fieldName);

    // Mapeo de nombres técnicos a nombres amigables
    const fieldLabels: { [key: string]: string } = {
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

    const friendlyName = fieldLabels[fieldName] || fieldName;

    if (field?.errors) {
      if (field.errors['required']) return `${friendlyName} es requerido`;
      if (field.errors['email']) return 'Email inválido';
      if (field.errors['minlength']) return `${friendlyName} debe tener mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['pattern']) return `${friendlyName} tiene formato inválido`;
      if (field.errors['min']) return 'El monto debe ser mayor a 0';
    }
    return '';
  }
}
