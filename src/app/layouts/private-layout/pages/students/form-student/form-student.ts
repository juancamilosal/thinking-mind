import {Component, EventEmitter, OnInit, Output, Input, OnChanges, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {StudentService} from '../../../../../core/services/student.service';
import {ClientService} from '../../../../../core/services/client.service';
import {SchoolService} from '../../../../../core/services/school.service';
import {Student} from '../../../../../core/models/Student';
import {School} from '../../../../../core/models/School';
import {DOCUMENT_TYPE} from '../../../../../core/const/DocumentTypeConst';
import {NotificationService} from '../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';

@Component({
  selector: 'app-form-student',
  imports: [
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './form-student.html',
  styleUrl: './form-student.css'
})
export class FormStudent implements OnInit, OnChanges {
  @Input() editMode: boolean = false;
  @Input() studentData: Student | null = null;
  @Output() goBack = new EventEmitter();
  @Output() searchStudent = new EventEmitter();
  @Output() studentUpdated = new EventEmitter();
  studentForm!: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;
  schools: School[] = [];
  guardianId: string = '';
  isSubmitting = false; // Nueva propiedad

  constructor(
    private fb: FormBuilder,
    private studentService: StudentService,
    private clientService: ClientService,
    private schoolService: SchoolService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {

    this.initForm();
    this.loadSchools();
    this.studentForm.get('guardianDocumentType')?.valueChanges.subscribe(() => {
      this.searchGuardianInfo();
    });

    this.studentForm.get('guardianDocumentNumber')?.valueChanges.subscribe(() => {
      this.searchGuardianInfo();
    });

    // Cargar datos si ya existen al inicializar
    if (this.studentData) {
      this.loadStudentData();
    }
  }

  initForm = (): void => {
    this.studentForm = this.fb.group({
      documentType: ['TI', [Validators.required]],
      documentNumber: [null, [Validators.required, Validators.minLength(6)]],
      firstName: [null, [Validators.required, Validators.minLength(2)]],
      lastName: [null, [Validators.required, Validators.minLength(2)]],
      school: [null, [Validators.required, Validators.minLength(2)]],
      guardianDocumentType: ['CC', [Validators.required]],
      guardianDocumentNumber: [null, [Validators.required, Validators.minLength(6)]],
      guardianFirstName: [null, [Validators.required, Validators.minLength(2)]],
      guardianLastName: [null, [Validators.required, Validators.minLength(2)]]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['studentData'] && this.studentData && this.studentForm) {
      this.loadStudentData();
    }
  }

  loadSchools(): void {
    this.schoolService.getAllSchools().subscribe({
      next: (response) => {
        this.schools = response.data;
      },
      error: (error) => {
        console.error('Error loading schools:', error);
        this.notificationService.showError('Error al cargar los colegios');
      }
    });
  }

  loadStudentData(): void {
    if (this.studentData) {
      this.studentForm.patchValue({
        documentType: this.studentData.tipo_documento,
        documentNumber: this.studentData.numero_documento,
        firstName: this.studentData.nombre,
        lastName: this.studentData.apellido,
        school: this.studentData.colegio
      });

      if (this.studentData.acudiente && typeof this.studentData.acudiente === 'object') {
        this.guardianId = this.studentData.acudiente.id ? this.studentData.acudiente.id.toString() : '';
        this.studentForm.patchValue({
          guardianDocumentType: this.studentData.acudiente.tipo_documento,
          guardianDocumentNumber: this.studentData.acudiente.numero_documento,
          guardianFirstName: this.studentData.acudiente.nombre,
          guardianLastName: this.studentData.acudiente.apellido
        });
      } else {
        // Si el acudiente es null o no es un objeto, limpiar los campos
        this.guardianId = '';
        this.studentForm.patchValue({
          guardianDocumentType: null,
          guardianDocumentNumber: null,
          guardianFirstName: null,
          guardianLastName: null
        });
      }
    }
  }

  searchGuardianInfo(): void {
    const documentType = this.studentForm.get('guardianDocumentType')?.value;
    const documentNumber = this.studentForm.get('guardianDocumentNumber')?.value;

    if (documentType && documentNumber && documentNumber.length >= 6) {
      this.clientService.searchClientByDocument(documentType, documentNumber).subscribe({
        next: (response) => {
          if (response.data && response.data.length > 0) {
            const guardian = response.data[0];
            this.guardianId = guardian.id ? guardian.id.toString() : '';
            this.studentForm.patchValue({
              guardianFirstName: guardian.nombre,
              guardianLastName: guardian.apellido
            });
          } else {
            this.guardianId = '';
          }
        },
        error: (error) => {
          this.guardianId = '';
        }
      });
    } else {
      this.guardianId = '';
    }
  }

  onSubmit(): void {
    if (this.studentForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      if (this.editMode) {
        this.updateStudent();
      } else {
        this.createStudent();
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  createStudent(): void {
    const student = {
      tipo_documento: this.studentForm.get('documentType')?.value,
      numero_documento: this.studentForm.get('documentNumber')?.value,
      nombre: this.studentForm.get('firstName')?.value,
      apellido: this.studentForm.get('lastName')?.value,
      colegio: this.studentForm.get('school')?.value,
      acudiente: this.guardianId,
    };

    this.studentService.createStudent(student).subscribe({
      next: (): void => {
        this.isSubmitting = false;
        const studentName = `${student.nombre} ${student.apellido}`;
        this.notificationService.showStudentCreated(studentName);
        this.studentService.searchStudent();
        this.goBack.emit();
        this.searchStudent.emit();
      },
      error: (error): void => {
        this.isSubmitting = false;
        const errorArray = error.errors || error.error;
        if (errorArray && Array.isArray(errorArray) && errorArray.length > 0) {
          const directusError = errorArray[0];
          if (directusError.extensions && directusError.extensions.code === 'RECORD_NOT_UNIQUE') {
            const duplicateValue = directusError.extensions.value;
            this.notificationService.showError('Estudiante ya se encuentra creado', `Ya existe un estudiante registrado con el número de documento ${duplicateValue}.`);
            return;
          }
        }

        if (error.status === 400) {
          this.notificationService.showError('Estudiante ya se encuentra creado', `Ya existe un estudiante registrado con el número de documento ${student.numero_documento}.`);
        } else if (error.status === 409) {
          this.notificationService.showError('Estudiante ya se encuentra creado', `Ya existe un estudiante registrado con el número de documento ${student.numero_documento}.`);
        } else if (error.status >= 500) {
          this.notificationService.showServerError();
        } else {
          this.notificationService.showError('Error', 'No se pudo registrar el estudiante. Inténtalo nuevamente.');
        }
      }
    });
  }

  updateStudent() {
    if (this.studentForm.valid && this.studentData?.id) {
      const studentToUpdate = {
        tipo_documento: this.studentForm.get('documentType')?.value,
        numero_documento: this.studentForm.get('documentNumber')?.value,
        nombre: this.studentForm.get('firstName')?.value,
        apellido: this.studentForm.get('lastName')?.value,
        colegio: this.studentForm.get('school')?.value,
        acudiente: this.guardianId,
      };

      this.studentService.updateStudent(this.studentData.id, studentToUpdate).subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.studentUpdated.emit();
          this.notificationService.showSuccess('Estudiante actualizado', 'La información del estudiante ha sido actualizada exitosamente.');
        },
        error: (error) => {
          this.isSubmitting = false;
          console.error('Error al actualizar estudiante:', error);
          this.notificationService.showError('Error al actualizar', 'No se pudo actualizar el estudiante. Inténtalo nuevamente.');
        }
      });
    }
  }

  deleteStudent() {
    if (this.studentData?.id) {
      const studentName = `${this.studentData.nombre} ${this.studentData.apellido}`;

      this.confirmationService.showDeleteConfirmation(
        studentName,
        'estudiante',
        () => {
          // Callback de confirmación
          this.studentService.deleteStudent(this.studentData!.id).subscribe({
            next: (response) => {
              this.notificationService.showSuccess(
                'Estudiante eliminado',
                `${studentName} ha sido eliminado exitosamente.`
              );
              this.studentUpdated.emit();
            },
            error: (error) => {
              this.notificationService.showError(
                'Error al eliminar',
                'No se pudo eliminar el estudiante. Inténtalo nuevamente.'
              );
            }
          });
        }
      );
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.studentForm.controls).forEach(key => {
      const control = this.studentForm.get(key);
      control?.markAsTouched();
    });
  }

  capitalizeText(text: string): string {
    if (!text) return '';
    return text.toLowerCase().split(' ').map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  onFirstNameChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.studentForm.get('firstName')?.setValue(capitalizedValue, { emitEvent: false });
  }

  onLastNameChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.studentForm.get('lastName')?.setValue(capitalizedValue, { emitEvent: false });
  }

  onSchoolChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.studentForm.get('school')?.setValue(capitalizedValue, { emitEvent: false });
  }
}
