import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DOCUMENT_TYPE } from '../../../../core/const/DocumentTypeConst';
import { CourseService } from '../../../../core/services/course.service';
import { Course } from '../../../../core/models/Course';
import {AccountReceivableService} from '../../../../core/services/account-receivable.service';
import { ClientService } from '../../../../core/services/client.service';
import { PaymentConfirmationComponent } from './payment-confirmation/payment-confirmation.component';
import {Client} from '../../../../core/models/Clients';

@Component({
  selector: 'app-payment-record',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PaymentConfirmationComponent],
  templateUrl: './payment-record.html',
  styleUrl: './payment-record.css'
})
export class PaymentRecord implements OnInit {
  paymentForm!: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;
  isSubmitting = false;
  courses: Course[] = [];
  isLoadingCourses = false;
  showConfirmation = false;
  isSearchingClient = false;

  // New properties for registered courses table
  showRegisteredCourses = false;
  clientData: any = null;
  registeredCourses: any[] = [];
  cliente: Client[];

  constructor(private fb: FormBuilder, private courseService: CourseService, private accountReceivableService: AccountReceivableService, private clientService: ClientService) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCourses();
  }


  initForm(): void {
    this.paymentForm = this.fb.group({
      // Guardian fields
      guardianDocumentType: ['CC', [Validators.required]],
      guardianDocumentNumber: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^[0-9]+$/)]],
      guardianFirstName: ['', [Validators.required, Validators.minLength(2)]],
      guardianLastName: ['', [Validators.required, Validators.minLength(2)]],
      guardianPhoneNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      guardianEmail: ['', [Validators.required, Validators.email]],
      guardianAddress: ['', [Validators.required, Validators.minLength(10)]],

      // Student fields
      studentDocumentType: ['TI', [Validators.required]],
      studentDocumentNumber: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^[0-9]+$/)]],
      studentFirstName: ['', [Validators.required, Validators.minLength(2)]],
      studentLastName: ['', [Validators.required, Validators.minLength(2)]],
      studentSchool: ['', [Validators.required, Validators.minLength(2)]],

      // Course fields
      selectedCourse: ['', [Validators.required]],
      coursePrice: [{ value: '', disabled: true }, [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.paymentForm.valid) {
      this.showConfirmation = true;
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

  onGuardianDocumentTypeChange(event: any): void {
    this.searchClientIfReady();
  }

  onGuardianDocumentNumberChange(event: any): void {
    this.searchClientIfReady();
  }

  private searchClientIfReady(): void {
    const documentType = this.paymentForm.get('guardianDocumentType')?.value;
    const documentNumber = this.paymentForm.get('guardianDocumentNumber')?.value;

    if (documentType && documentNumber && documentNumber.length >= 6) {
      this.searchClientPayment(documentType, documentNumber);
    } else {
      this.clearGuardianFields();
    }
  }

  private searchClientPayment(documentType: string, documentNumber: string): void {
    this.isSearchingClient = true;
    this.clientService.searchClientPayment(documentType, documentNumber).subscribe(data => {
      this.isSearchingClient = false;
      this.cliente = data.data;
      if(data.data.length > 0){
        // Automatically fill guardian fields when data is found
        const client = data.data[0];
        this.fillGuardianFields(client);
        
        // Check if client has accounts receivable and prepare table
        if (client.cuentas_cobrar && client.cuentas_cobrar.length > 0) {
          this.prepareRegisteredCoursesTable(client);
        }
        
        this.showRegisteredCourses = true;
      } else {
        this.clearGuardianFields();
        this.showRegisteredCourses = false;
      }
    });
  }

  private fillGuardianFields(client: any): void {
    this.paymentForm.patchValue({
      guardianFirstName: client.nombre || '',
      guardianLastName: client.apellido || '',
      guardianPhoneNumber: client.celular || '',
      guardianEmail: client.email || '',
      guardianAddress: client.direccion || ''
    });
  }

  private clearGuardianFields(): void {
    this.paymentForm.patchValue({
      guardianFirstName: '',
      guardianLastName: '',
      guardianPhoneNumber: '',
      guardianEmail: '',
      guardianAddress: ''
    });
  }

  private prepareRegisteredCoursesTable(client: any): void {
    console.log('Preparing registered courses table with client:', client);
    this.registeredCourses = [];

    if (client.cuentas_cobrar && client.estudiantes) {
      console.log('Found cuentas_cobrar:', client.cuentas_cobrar);
      console.log('Found estudiantes:', client.estudiantes);

      client.cuentas_cobrar.forEach((cuenta: any, index: number) => {
        console.log(`Processing cuenta ${index}:`, cuenta);
        const student = client.estudiantes.find((est: any) => est.acudiente === client.id);
        console.log('Found student for cuenta:', student);

        const courseData = {
          id: cuenta.id,
          courseName: cuenta.curso_id?.nombre || 'N/A',
          studentName: student ? `${student.nombre} ${student.apellido}` : 'N/A',
          coursePrice: this.formatCurrency(parseFloat(cuenta.curso_id?.precio || '0')),
          balance: this.formatCurrency(cuenta.monto || 0),
          status: cuenta.estado,
          courseId: cuenta.curso_id?.id
        };

        console.log('Created courseData:', courseData);
        this.registeredCourses.push(courseData);
      });

      console.log('Final registeredCourses array:', this.registeredCourses);
    } else {
      console.log('No cuentas_cobrar or estudiantes found');
    }
  }

  onPayCourse(courseData: any): void {
    // Logic for payment will be implemented here
    console.log('Paying for course:', courseData);
  }

  private capitalizeText(text: string): string {
    return text.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  onlyNumbers(event: KeyboardEvent): void {
    const charCode = event.which ? event.which : event.keyCode;
    // Allow: backspace, delete, tab, escape, enter
    if ([46, 8, 9, 27, 13].indexOf(charCode) !== -1 ||
      // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      (charCode === 65 && event.ctrlKey === true) ||
      (charCode === 67 && event.ctrlKey === true) ||
      (charCode === 86 && event.ctrlKey === true) ||
      (charCode === 88 && event.ctrlKey === true)) {
      return;
    }
    // Ensure that it is a number and stop the keypress
    if ((charCode < 48 || charCode > 57)) {
      event.preventDefault();
    }
  }

  loadCourses(): void {
    this.isLoadingCourses = true;
    this.courseService.searchCourse().subscribe({
      next: (response) => {
        if (response.data) {
          // Ordenar los cursos alfabéticamente por nombre
          this.courses = response.data.sort((a, b) =>
            a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
          );
        }
        this.isLoadingCourses = false;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.isLoadingCourses = false;
      }
    });
  }

  onCourseChange(courseId: string): void {
    if (courseId) {
      const selectedCourse = this.courses.find(course => course.id === courseId);
      if (selectedCourse) {
        const priceAsNumber = parseFloat(selectedCourse.precio);
        const formattedPrice = this.formatCurrency(priceAsNumber);
        this.paymentForm.patchValue({
          coursePrice: formattedPrice
        });
      }
    } else {
      this.paymentForm.patchValue({
        coursePrice: ''
      });
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  private parseCurrencyToNumber(currencyString: string): number {
    return parseFloat(currencyString.replace(/[^\d]/g, ''));
  }

  goBackToForm(): void {
    this.showConfirmation = false;
  }

  confirmAndSubmit(): void {
    this.isSubmitting = true;
    this.createAccountRecord();
  }

  createAccountRecord= ()=> {
    const coursePriceString = this.paymentForm.get('coursePrice')?.value;
    const coursePriceNumber = this.parseCurrencyToNumber(coursePriceString);

    const paymentForm = {
      cliente: {
        tipo_documento: this.paymentForm.get('guardianDocumentType')?.value,
        numero_documento: this.paymentForm.get('guardianDocumentNumber')?.value,
        nombre: this.paymentForm.get('guardianFirstName')?.value,
        apellido: this.paymentForm.get('guardianLastName')?.value,
        celular: this.paymentForm.get('guardianPhoneNumber')?.value,
        email: this.paymentForm.get('guardianEmail')?.value,
        direccion: this.paymentForm.get('guardianAddress')?.value,
      },
      estudiante: {
        tipo_documento: this.paymentForm.get('studentDocumentType')?.value,
        numero_documento: this.paymentForm.get('studentDocumentNumber')?.value,
        nombre: this.paymentForm.get('studentFirstName')?.value,
        apellido: this.paymentForm.get('studentLastName')?.value,
        colegio: this.paymentForm.get('studentSchool')?.value,
      },
      curso_id: this.paymentForm.get('selectedCourse')?.value,
      precio: coursePriceNumber,
      estado: 'PENDIENTE'
    }
    this.accountReceivableService.createAccountRecord(paymentForm).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          const clienteData = response.data[0];
          const cuentasPorCobrar = clienteData.cuentas_cobrar;

        }
      },
      error: (error) => {
        this.isSubmitting = false;
      }
    })
  }
}
