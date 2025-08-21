import {Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ClientService} from '../../../../../core/services/client.service';
import {Client} from '../../../../../core/models/Clients';
import {DOCUMENT_TYPE} from '../../../../../core/const/DocumentTypeConst';
import {NotificationService} from '../../../../../core/services/notification.service';

@Component({
  selector: 'app-form-client',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-client.html',
  styleUrl: './form-client.css'
})
export class FormClient implements OnInit, OnChanges {

  @Input() editMode: boolean = false;
  @Input() clientData: Client | null = null;
  @Output() goBack = new EventEmitter();
  @Output() searchClient = new EventEmitter();
  @Output() clientUpdated = new EventEmitter();
  clientForm!: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;

  constructor(
    private fb: FormBuilder,
    private clientServices: ClientService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientData'] && this.clientForm) {
      this.loadClientData();
    }
  }

  initForm=(): void => {
    this.clientForm = this.fb.group({
      documentType: [null, Validators.required],
      documentNumber: [null, Validators.required],
      firstName: [null, Validators.required],
      lastName: [null, Validators.required],
      phoneNumber: [null, [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      email: [null, [Validators.required, Validators.email]],
      address: [null, Validators.required]
    });
    
    if (this.editMode && this.clientData) {
      this.loadClientData();
    }
  }

  loadClientData(): void {
    if (this.clientData) {
      this.clientForm.patchValue({
        documentType: this.clientData.tipo_documento,
        documentNumber: this.clientData.numero_documento,
        firstName: this.clientData.nombre,
        lastName: this.clientData.apellido,
        phoneNumber: this.clientData.celular,
        email: this.clientData.email,
        address: this.clientData.direccion
      });
    }
  }

  onSubmit=(): void => {
    console.log(this.clientForm.valid)
    if (this.clientForm.valid) {
      if (this.editMode) {
        this.updateClient();
      } else {
        this.createClient();
      }
    } else {
      this.markFormGroupTouched(this.clientForm);
    }
  }

  private markFormGroupTouched=(formGroup:FormGroup): void => {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  createClient=(): void => {
    const client = {
      tipo_documento: this.clientForm.get('documentType')?.value,
      numero_documento: this.clientForm.get('documentNumber')?.value,
      nombre: this.clientForm.get('firstName')?.value,
      apellido: this.clientForm.get('lastName')?.value,
      celular: this.clientForm.get('phoneNumber')?.value,
      email: this.clientForm.get('email')?.value,
      direccion: this.clientForm.get('address')?.value,
    }

    this.clientServices.createClient(client).subscribe({
      next: (): void => {
        const clientName = `${client.nombre} ${client.apellido}`;
        this.notificationService.showClientCreated(clientName);
        this.clientServices.searchClient();
        this.goBack.emit();
        this.searchClient.emit();
      },
      error: (error): void => {
        const errorArray = error.errors || error.error;
        if (errorArray && Array.isArray(errorArray) && errorArray.length > 0) {
          const directusError = errorArray[0];
          if (directusError.extensions && directusError.extensions.code === 'RECORD_NOT_UNIQUE') {
            const duplicateValue = directusError.extensions.value;
            this.notificationService.showError('Cliente ya se encuentra creado', `Ya existe un cliente registrado con el número de documento ${duplicateValue}.`);
            return;
          }
        }
        if (error.status === 400) {
          this.notificationService.showError('Cliente ya se encuentra creado', `Ya existe un cliente registrado con el número de documento ${client.numero_documento}.`);
        } else if (error.status === 409) {
          this.notificationService.showError('Cliente ya se encuentra creado', `Ya existe un cliente registrado con el número de documento ${client.numero_documento}.`);
        } else if (error.status >= 500) {
          this.notificationService.showServerError();
        } else {
          this.notificationService.showError('Error', 'No se pudo crear el cliente. Inténtalo nuevamente.');
        }
      }
    });
  }

  updateClient=(): void => {
    const client = {
      id: this.clientData?.id,
      tipo_documento: this.clientForm.get('documentType')?.value,
      numero_documento: this.clientForm.get('documentNumber')?.value,
      nombre: this.clientForm.get('firstName')?.value,
      apellido: this.clientForm.get('lastName')?.value,
      celular: this.clientForm.get('phoneNumber')?.value,
      email: this.clientForm.get('email')?.value,
      direccion: this.clientForm.get('address')?.value,
    }

    this.clientServices.updateClient(Number(client.id!), client).subscribe({
      next: (): void => {
        const clientName = `${client.nombre} ${client.apellido}`;
        this.notificationService.showSuccess('Cliente actualizado', `El cliente ${clientName} ha sido actualizado exitosamente.`);
        this.clientUpdated.emit();
      },
      error: (error): void => {
        if (error.status === 400) {
          this.notificationService.showError('Cliente ya se encuentra creado', `Ya existe un cliente registrado con el número de documento ${client.numero_documento}.`);
        } else if (error.status >= 500) {
          this.notificationService.showServerError();
        } else {
          this.notificationService.showError('Error', 'No se pudo actualizar el cliente. Inténtalo nuevamente.');
        }
      }
    });
  }
}
