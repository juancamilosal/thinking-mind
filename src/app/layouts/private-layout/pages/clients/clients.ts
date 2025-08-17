import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clients.html'
})
export class Clients implements OnInit {
  clientForm!: FormGroup;
  showForm = false;
  documentTypes = [
    { id: 'cc', name: 'Cédula de Ciudadanía' },
    { id: 'pp', name: 'Pasaporte' },
    { id: 'ce', name: 'Cédula de Extranjería' }
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.clientForm = this.fb.group({
      documentType: ['', Validators.required],
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      email: ['', [Validators.required, Validators.email]],
      address: ['', Validators.required]
    });
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.clientForm.reset();
    }
  }

  onSubmit() {
    if (this.clientForm.valid) {
      console.log(this.clientForm.value);
    } else {
      this.markFormGroupTouched(this.clientForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
    });
  }
}