import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {AccountReceivable} from '../../../../../core/models/AccountReceivable';
import {DOCUMENT_TYPE} from '../../../../../core/const/DocumentTypeConst';
import {ClientService} from '../../../../../core/services/client.service';
import {Client} from '../../../../../core/models/Clients';

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

  constructor(private fb: FormBuilder, private clientService: ClientService) {
  }

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
      amount: [0, [Validators.required, Validators.min(0.01)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      dueDate: ['', [Validators.required]],
      invoiceNumber: ['', [Validators.required]]
    });

    // Suscribirse a cambios en los campos de documento del cliente
    this.accountForm.get('clientDocumentType')?.valueChanges.subscribe(() => {
      this.searchClientInfo();
    });

    this.accountForm.get('clientDocumentNumber')?.valueChanges.subscribe(() => {
      this.searchClientInfo();
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
            // Llenar automáticamente los campos del cliente
            this.accountForm.patchValue({
              clientName: `${client.nombre} ${client.apellido}`,
              clientEmail: client.email,
              clientPhone: client.celular
            });
          }
        },
        error: (error) => {
          console.error('Error al buscar cliente:', error);
        }
      });
    }
  }

  onSubmit() {
    if (this.accountForm.valid) {
      const formData: AccountReceivable = {
        ...this.accountForm.value,
        status: 'pending' as const,
        createdDate: new Date().toISOString().split('T')[0]
      };
      this.accountCreated.emit(formData); // Cambiar de formSubmit a accountCreated
      this.accountForm.reset();
    }
  }

  onCancel() {
    this.accountForm.reset();
    this.formClosed.emit(); // Cambiar de formCancel a formClosed
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
      'amount': 'Monto',
      'description': 'Descripción',
      'dueDate': 'Fecha de vencimiento',
      'invoiceNumber': 'Número de factura',
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
