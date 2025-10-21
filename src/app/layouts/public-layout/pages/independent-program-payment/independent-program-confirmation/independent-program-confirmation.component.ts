import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';

import { Course } from '../../../../../core/models/Course';

@Component({
  selector: 'app-independent-program-confirmation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './independent-program-confirmation.component.html',
  styleUrls: ['./independent-program-confirmation.component.css']
})
export class IndependentProgramConfirmationComponent {
  @Input() paymentForm!: FormGroup;
  @Input() courses: Course[] = [];
  @Input() isSubmitting: boolean = false;
  @Input() selectedInscriptionConvertedCop: number | null = null;
  @Input() selectedCourseImageUrl: string | null = null;
  @Input() selectedCourseConvertedCop: number | null = null;

  @Output() goBack = new EventEmitter<void>();
  @Output() confirmSubmit = new EventEmitter<void>();

  onGoBack(): void {
    this.goBack.emit();
  }

  onConfirmSubmit(): void {
    this.confirmSubmit.emit();
  }
}