import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { Course } from '../../../../../core/models/Course';

@Component({
  selector: 'app-payment-confirmation',
  standalone: true,
  imports: [],
  templateUrl: './payment-confirmation.component.html',
  styleUrls: ['./payment-confirmation.component.css']
})
export class PaymentConfirmationComponent {
  @Input() paymentForm!: FormGroup;
  @Input() courses: Course[] = [];
  @Input() isSubmitting: boolean = false;
  @Input() schoolSearchTerm: string = '';

  @Output() goBack = new EventEmitter<void>();
  @Output() confirmSubmit = new EventEmitter<void>();

  onGoBack(): void {
    this.goBack.emit();
  }

  onConfirmSubmit(): void {
    this.confirmSubmit.emit();
  }
}
