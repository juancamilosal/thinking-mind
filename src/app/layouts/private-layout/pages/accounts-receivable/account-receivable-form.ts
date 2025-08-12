import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface AccountReceivable {
  id?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  amount: number;
  description: string;
  dueDate: string;
  invoiceNumber: string;
  status: 'pending' | 'paid';
  createdDate: string;
}

@Component({
  selector: 'app-account-receivable-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './account-receivable-form.html',
  standalone: true
})
export class AccountReceivableFormComponent {
  @Output() formSubmit = new EventEmitter<AccountReceivable>();
  @Output() formCancel = new EventEmitter<void>();

  accountForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.accountForm = this.fb.group({
      clientName: ['', [Validators.required, Validators.minLength(2)]],
      clientEmail: ['', [Validators.required, Validators.email]],
      clientPhone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      dueDate: ['', Validators.required],
      invoiceNumber: ['', Validators.required]
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
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} es requerido`;
      if (field.errors['email']) return 'Email inválido';
      if (field.errors['minlength']) return `Mínimo ${field.errors['minlength'].requiredLength} caracteres`;
      if (field.errors['pattern']) return 'Formato inválido';
      if (field.errors['min']) return 'El monto debe ser mayor a 0';
    }
    return '';
  }
}