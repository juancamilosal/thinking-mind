import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DOCUMENT_TYPE } from '../../../../core/const/DocumentTypeConst';

@Component({
  selector: 'app-payment-record',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-record.html',
  styleUrl: './payment-record.css'
})
export class PaymentRecord implements OnInit {
  paymentForm!: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;
  isSubmitting = false;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.paymentForm = this.fb.group({
      // Guardian fields
      guardianDocumentType: ['', [Validators.required]],
      guardianDocumentNumber: ['', [Validators.required, Validators.minLength(6)]],
      guardianFirstName: ['', [Validators.required, Validators.minLength(2)]],
      guardianLastName: ['', [Validators.required, Validators.minLength(2)]],
      guardianPhoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      guardianEmail: ['', [Validators.required, Validators.email]],
      
      // Student fields
      studentDocumentType: ['', [Validators.required]],
      studentDocumentNumber: ['', [Validators.required, Validators.minLength(6)]],
      studentFirstName: ['', [Validators.required, Validators.minLength(2)]],
      studentLastName: ['', [Validators.required, Validators.minLength(2)]],
      studentSchool: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  onSubmit(): void {
    if (this.paymentForm.valid) {
      this.isSubmitting = true;
      
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.paymentForm);
      
      const formData = this.paymentForm.value;
      
      console.log('Payment Record Form Data:', formData);
      
      // Here you would typically send the data to a service
      // For now, we'll just simulate a successful submission
      setTimeout(() => {
        this.isSubmitting = false;
        console.log('Form submitted successfully!');
        // You could show a success message or redirect here
      }, 2000);
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

  // Text capitalization methods
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

  private capitalizeText(text: string): string {
    return text.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
}
