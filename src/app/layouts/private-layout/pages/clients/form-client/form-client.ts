import {Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ClientService} from '../../../../../core/services/client.service';
import {Client} from '../../../../../core/models/Clients';
import {DOCUMENT_TYPE} from '../../../../../core/const/DocumentTypeConst';
import {NotificationService} from '../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';

@Component({
  selector: 'app-form-client',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-client.html',
})
export class FormClient implements OnInit, OnChanges {
  @Input() editMode: boolean = false;
  @Input() clientData: Client | null = null;
  @Output() goBack = new EventEmitter();
  @Output() searchClient = new EventEmitter();
  @Output() clientUpdated = new EventEmitter();
  clientForm!: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private clientServices: ClientService,
    private notificationService: NotificationService,
    private confirmationService: ConfirmationService
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
      documentType: ['CC', Validators.required],
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
    if (this.clientForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
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
  createClient() {
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
        this.isSubmitting = false;
        this.clientUpdated.emit();
        this.notificationService.showClientCreated(`${client.nombre} ${client.apellido}`);
      },
      error: (error) => {
        this.isSubmitting = false;
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
          this.notificationService.showError('Cliente ya se encuentra creado', `Ya existe un cliente registrado con el número de documento ${client.tipo_documento} ${client.numero_documento}.`);
        } else if (error.status === 409) {
          this.notificationService.showError('Cliente ya se encuentra creado', `Ya existe un cliente registrado con el número de documento ${client.tipo_documento} ${client.numero_documento}.`);
        } else if (error.status >= 500) {
          this.notificationService.showServerError();
        } else {
          this.notificationService.showError('Error', 'No se pudo crear el cliente. Inténtalo nuevamente.');
        }
      }
    });
  }

  updateClient() {
    if (this.clientForm.valid && this.clientData?.id) {
      const clientToUpdate = {
        tipo_documento: this.clientForm.get('documentType')?.value,
        numero_documento: this.clientForm.get('documentNumber')?.value,
        nombre: this.clientForm.get('firstName')?.value,
        apellido: this.clientForm.get('lastName')?.value,
        celular: this.clientForm.get('phoneNumber')?.value,
        email: this.clientForm.get('email')?.value,
        direccion: this.clientForm.get('address')?.value,
      };
      this.clientServices.updateClient(this.clientData.id, clientToUpdate).subscribe({
        next: (): void => {
          this.isSubmitting = false;
          this.clientUpdated.emit();
          this.notificationService.showSuccess('Cliente actualizado', 'La información del cliente ha sido actualizada exitosamente.');
        },
        error: (error) => {
          this.isSubmitting = false; // Asegurar que se resetee en error
          this.notificationService.showError('Error al actualizar', 'No se pudo actualizar el cliente. Inténtalo nuevamente.');
        }
      });
    }
  }

  deleteClient(): void {
    if (this.clientData?.id) {
      const clientName = `${this.clientData.nombre} ${this.clientData.apellido}`;
      this.confirmationService.showDeleteConfirmation(
        clientName,
        'cliente',
        () => {
          this.clientServices.deleteClient(this.clientData!.id).subscribe({
            next: (response) => {
              this.notificationService.showSuccess(
                'Cliente eliminado',
                `${clientName} ha sido eliminado exitosamente.`
              );
              this.clientUpdated.emit();
            },
            error: (error) => {
              // Verificar si es un error 500 que indica relaciones activas
              if (error.status === 500) {
                this.notificationService.showError(
                  'No se puede eliminar el cliente',
                  `No se puede eliminar a ${clientName} porque tiene cuentas por cobrar asociadas. Debe eliminar o transferir las cuentas por cobrar antes de eliminar el cliente.`
                );
              } else {
                this.notificationService.showError(
                  'Error al eliminar',
                  'No se pudo eliminar el cliente. Inténtalo nuevamente.'
                );
              }
            }
          });
        }
      );
    }
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
    this.clientForm.get('firstName')?.setValue(capitalizedValue, { emitEvent: false });
  }

  onLastNameChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.clientForm.get('lastName')?.setValue(capitalizedValue, { emitEvent: false });
  }

  onAddressChange(event: any): void {
    const value = event.target.value;
    const capitalizedValue = this.capitalizeText(value);
    this.clientForm.get('address')?.setValue(capitalizedValue, { emitEvent: false });
  }
}
