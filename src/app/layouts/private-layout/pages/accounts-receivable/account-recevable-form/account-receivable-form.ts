import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {AccountReceivable} from '../../../../../core/models/AccountReceivable';
import {DOCUMENT_TYPE} from '../../../../../core/const/DocumentTypeConst';
import {ClientService} from '../../../../../core/services/client.service';
import {StudentService} from '../../../../../core/services/student.service';
import {AccountReceivableService} from '../../../../../core/services/account-receivable.service';
import {NotificationService} from '../../../../../core/services/notification.service';
import {CourseService} from '../../../../../core/services/course.service';
import {Course} from '../../../../../core/models/Course';
import {ResponseAPI} from '../../../../../core/models/ResponseAPI';

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
  courses: Course[] = [];
  isLoadingCourses = false;
  
  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private studentService: StudentService,
    private accountReceivableService: AccountReceivableService,
    private notificationService: NotificationService,
    private courseService: CourseService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCourses();

    this.accountForm.get('clientDocumentType')?.valueChanges.subscribe(() => {
      this.searchClientInfo();
    });

    this.accountForm.get('clientDocumentNumber')?.valueChanges.subscribe(() => {
      this.searchClientInfo();
    });

    this.accountForm.get('studentDocumentType')?.valueChanges.subscribe(() => {
      this.searchStudentInfo();
    });

    this.accountForm.get('studentDocumentNumber')?.valueChanges.subscribe(() => {
      this.searchStudentInfo();
    });

    this.accountForm.get('course')?.valueChanges.subscribe((courseId) => {
      this.onCourseChange(courseId);
    });
  }

  loadCourses(): void {
    this.isLoadingCourses = true;
    this.courseService.searchCourse().subscribe({
      next: (response) => {
          this.courses = response.data.sort((a, b) =>
            a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
          );
      },
      error: (error) => {
        this.notificationService.showError('Error', 'Error al cargar los programas');
      },
      complete: () => {
        this.isLoadingCourses = false;
      }
    });
  }

  onCourseChange(courseId: string): void {
    if (courseId) {
      const selectedCourse = this.courses.find(course => course.id === courseId);
      if (selectedCourse && selectedCourse.precio) {
        this.accountForm.patchValue({
          amount: selectedCourse.precio
        });
      }
    } else {
      this.accountForm.patchValue({
        amount: null
      });
    }
  }

  initForm(): void {
    this.accountForm = this.fb.group({
      client_id: ['', Validators.required],
      student_id: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      deadline: ['', Validators.required],
      description: [''],
      course: ['', Validators.required],
      clientDocumentType: ['CC', Validators.required],
      clientDocumentNumber: ['', Validators.required],
      clientName: ['', Validators.required],
      clientEmail: ['', [Validators.required, Validators.email]],
      clientPhone: ['', Validators.required],
      studentDocumentType: ['TI', Validators.required],
      studentDocumentNumber: ['', Validators.required],
      studentName: ['', Validators.required],
      studentBirthDate: ['', Validators.required],
      studentGender: ['', Validators.required],
      studentSchool: ['', Validators.required]
    });
  }

  searchClientInfo(): void {
    const documentType = this.accountForm.get('clientDocumentType')?.value;
    const documentNumber = this.accountForm.get('clientDocumentNumber')?.value;
    if (!documentType || !documentNumber || documentNumber.toString().length < 6) {
      this.clientId = '';
      this.accountForm.patchValue({
        clientName: '',
        clientEmail: '',
        clientPhone: ''
      });
      return;
    }

    this.clientService.searchClientByDocument(documentType, documentNumber.toString()).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          const client = response.data[0];
          this.clientId = client.id ? client.id.toString() : '';
          this.accountForm.patchValue({
            clientName: `${client.nombre || ''} ${client.apellido || ''}`.trim(),
            clientEmail: client.email || '',
            clientPhone: client.celular || ''
          });
        } else {
          this.clientId = '';
          this.accountForm.patchValue({
            clientName: '',
            clientEmail: '',
            clientPhone: ''
          });
        }
      },
      error: (error) => {
        this.clientId = '';
        this.accountForm.patchValue({
          clientName: '',
          clientEmail: '',
          clientPhone: ''
        });
      }
    });
  }

  searchStudentInfo(): void {
    const documentType = this.accountForm.get('studentDocumentType')?.value;
    const documentNumber = this.accountForm.get('studentDocumentNumber')?.value;
    if (!documentType || !documentNumber || documentNumber.toString().length < 6) {
      this.studentId = '';
      this.accountForm.patchValue({
        studentName: '',
        colegio: ''
      });
      return;
    }

    this.studentService.searchStudentByDocument(documentType, documentNumber.toString()).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0) {
          const student = response.data[0];
          this.studentId = student.id ? student.id.toString() : '';
          this.accountForm.patchValue({
            studentName: `${student.nombre || ''} ${student.apellido || ''}`.trim(),
            colegio: student.colegio_id.nombre || ''
          });
        } else {
          this.studentId = '';
          this.accountForm.patchValue({
            studentName: '',
            colegio: ''
          });
        }
      },
      error: (error) => {
        this.studentId = '';
        this.accountForm.patchValue({
          studentName: '',
          colegio: ''
        });
      }
    });
  }

  onSubmit(): void {
    if (this.accountForm.valid && !this.isSubmitting && this.clientId && this.studentId) {
      this.isSubmitting = true;

      const formValue = this.accountForm.value;
      const accountReceivableData = {
        cliente_id: this.clientId,
        estudiante_id: this.studentId,
        monto: formValue.amount,
        fecha_finalizacion: formValue.deadline,
        descripcion: formValue.description,
        curso_id: formValue.course
      };

      this.accountReceivableService.createAccountReceivable(accountReceivableData).subscribe({
        next: (response) => {
          if (response.data) {
            const formData = {
              id: response.data.id,
              clientName: formValue.clientName,
              clientEmail: formValue.clientEmail,
              clientPhone: formValue.clientPhone,
              studentName: formValue.studentName,
              schoolName: formValue.colegio,
              courseName: this.courses.find(c => c.id === formValue.course)?.nombre || '',
              monto: formValue.amount,
              saldo: formValue.amount,
              fecha_finalizacion: formValue.deadline,
              descripcion: formValue.description,
              estado: 'PENDIENTE',
              pagos: [],
              cliente_id: this.clientId,
              estudiante_id: this.studentId,
              curso_id: formValue.course
            };

            this.accountCreated.emit(formData);
            this.resetForm();
            this.notificationService.showSuccess('Éxito', 'Cuenta por cobrar creada correctamente');
          }
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error creating account:', error);
          this.notificationService.showError('Error', 'Error al crear la cuenta por cobrar');
          this.isSubmitting = false;
        }
      });
    }
  }

  onCancel() {
    this.formClosed.emit();
  }

  resetForm(): void {
    this.accountForm.reset();
    this.clientId = '';
    this.studentId = '';
    this.initForm();
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
    const control = this.accountForm.get(fieldName);
    if (control && control.errors && control.touched) {
      if (control.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} es obligatorio`;
      }
      if (control.errors['email']) {
        return 'Ingrese un email válido';
      }
      if (control.errors['minlength']) {
        return `${this.getFieldDisplayName(fieldName)} debe tener al menos ${control.errors['minlength'].requiredLength} caracteres`;
      }
      if (control.errors['pattern']) {
        return `${this.getFieldDisplayName(fieldName)} no tiene el formato correcto`;
      }
      if (control.errors['min']) {
        return `${this.getFieldDisplayName(fieldName)} debe ser mayor a ${control.errors['min'].min}`;
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      'clientDocumentType': 'Tipo de documento del cliente',
      'clientDocumentNumber': 'Número de documento del cliente',
      'clientName': 'Nombre del cliente',
      'clientEmail': 'Email del cliente',
      'clientPhone': 'Teléfono del cliente',
      'studentDocumentType': 'Tipo de documento del estudiante',
      'studentDocumentNumber': 'Número de documento del estudiante',
      'studentName': 'Nombre del estudiante',
      'grado': 'Grado',
      'colegio': 'Colegio',
      'curso': 'Curso',
      'monto': 'Monto',
      'saldo': 'Saldo',
      'fecha_finalizacion': 'Fecha finalización'
    };
    return fieldNames[fieldName] || fieldName;
  }
}
