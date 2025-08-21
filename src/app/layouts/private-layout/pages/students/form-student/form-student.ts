import {Component, EventEmitter, OnInit, Output, Input, OnChanges, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {StudentService} from '../../../../../core/services/student.service';
import {ClientService} from '../../../../../core/services/client.service';
import {Student} from '../../../../../core/models/Student';
import {DOCUMENT_TYPE} from '../../../../../core/const/DocumentTypeConst';
import {NotificationService} from '../../../../../core/services/notification.service';

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
  guardianId: string = '';

  constructor(
    private fb: FormBuilder,
    private studentService: StudentService,
    private clientService: ClientService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.studentForm = this.fb.group({
      documentType: [null, [Validators.required]],
      documentNumber: [null, [Validators.required, Validators.minLength(6)]],
      firstName: [null, [Validators.required, Validators.minLength(2)]],
      lastName: [null, [Validators.required, Validators.minLength(2)]],
      school: [null, [Validators.required, Validators.minLength(2)]],
      guardianDocumentType: [null, [Validators.required]],
      guardianDocumentNumber: [null, [Validators.required, Validators.minLength(6)]],
      guardianFirstName: [null, [Validators.required, Validators.minLength(2)]],
      guardianLastName: [null, [Validators.required, Validators.minLength(2)]]
    });

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['studentData'] && this.studentData && this.studentForm) {
      this.loadStudentData();
    }
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

      // Si el acudiente es un objeto y no es null, cargar sus datos
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
    if (this.studentForm.valid) {
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
        const studentName = `${student.nombre} ${student.apellido}`;
        this.notificationService.showStudentCreated(studentName);
        this.studentService.searchStudent();
        this.goBack.emit();
        this.searchStudent.emit();
      },
      error: (error): void => {
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
      const studentToUpdate = this.studentForm.value;
      this.studentService.updateStudent(this.studentData.id, studentToUpdate).subscribe({
        next: (response) => {
          console.log('Estudiante actualizado:', response);
          this.studentUpdated.emit();
        },
        error: (error) => {
          console.error('Error al actualizar estudiante:', error);
        }
      });
    }
  }

  deleteStudent() {
    if (this.studentData?.id && confirm('¿Estás seguro de que deseas eliminar este estudiante? Esta acción no se puede deshacer.')) {
      this.studentService.deleteStudent(this.studentData.id).subscribe({
        next: (response) => {
          console.log('Estudiante eliminado:', response);
          this.studentUpdated.emit();
        },
        error: (error) => {
          console.error('Error al eliminar estudiante:', error);
        }
      });
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.studentForm.controls).forEach(key => {
      const control = this.studentForm.get(key);
      control?.markAsTouched();
    });
  }
}
