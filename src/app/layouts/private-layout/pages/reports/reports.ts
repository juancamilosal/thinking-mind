import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../core/services/confirmation.service';
import { REPORT_TYPE } from '../../../../core/const/ReportType';
import { PaymentRecord } from '../../../../core/models/AccountReceivable';

@Component({
  selector: 'app-reports',
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './reports.html',
  standalone: true
})

export class Reports {
  reportForm!: FormGroup;
  REPORT_TYPE = REPORT_TYPE;
  payments: PaymentRecord[] = [];

  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm=(): void => {
    this.reportForm = this.fb.group({
      reportType: ['', Validators.required],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required]
    });
  }

  onSubmit(): void {
    if (this.reportForm.valid) {
      const { reportType, startDate, endDate } = this.reportForm.value;

    }
  }

  generateReport(): void {

  }

  downloadReport(): void {

  }

  clearForm(): void {
    this.reportForm.reset();
  }
}
