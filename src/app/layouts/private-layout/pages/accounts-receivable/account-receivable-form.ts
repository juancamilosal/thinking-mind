import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {AccountReceivable} from '../../../../core/models/AccountReceivable';

@Component({
  selector: 'app-account-receivable-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './account-receivable-form.html',
  standalone: true
})
export class AccountReceivableFormComponent implements OnInit {
  @Output() formSubmit = new EventEmitter<AccountReceivable>();
  @Output() formCancel = new EventEmitter<void>();

  accountForm: FormGroup;
  constructor(private fb: FormBuilder) {
  }

  ngOnInit(): void {
    this.accountForm = this.fb.group({
      clientName: [null, [Validators.required, Validators.minLength(2)]],
      clientEmail: [null, [Validators.required, Validators.email]],
      studentName: [null, [Validators.required, Validators.minLength(2)]],
      clientPhone: [null, [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      description: [null, [Validators.required, Validators.minLength(5)]],
      dueDate: [null, Validators.required],
      invoiceNumber: [null, Validators.required]
    });
    }

  onSubmit() {
    if (this.accountForm.valid) {
      const formData: AccountReceivable = {
        ...this.accountForm.value,
        id: this.generateId(),
        status: 'pending' as const,
        createdDate: new Date().toISOString().split('T')[0]
      };
      this.formSubmit.emit(formData);
      this.accountForm.reset();
    }
  }

  onCancel() {
    this.accountForm.reset();
    this.formCancel.emit();
  }

  private generateId(): string {
    return 'AR-' + Date.now().toString();
  }

  // Métodos para validaciones
  isFieldInvalid(fieldName: string): boolean {
    const field = this.accountForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.accountForm.get(fieldName);

    // Mapeo de nombres técnicos a nombres amigables
    const fieldLabels: { [key: string]: string } = {
      'clientName': 'Nombre del cliente',
      'clientEmail': 'Email del cliente',
      'clientPhone': 'Teléfono del cliente',
      'studentName': 'Nombre del estudiante',
      'amount': 'Monto',
      'description': 'Descripción',
      'dueDate': 'Fecha de vencimiento',
      'invoiceNumber': 'Número de factura'
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
