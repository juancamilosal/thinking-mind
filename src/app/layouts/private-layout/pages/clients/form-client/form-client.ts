import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ClientService} from '../../../../../core/services/client.service';
import {DOCUMENT_TYPE} from '../../../../../core/const/DocumentTypeConst';

@Component({
  selector: 'app-form-client',
  imports: [
    ReactiveFormsModule
  ],
  templateUrl: './form-client.html',
  styleUrl: './form-client.css'
})
export class FormClient implements OnInit {

  @Output() goBack = new EventEmitter();
  @Output() searchClient = new EventEmitter();
  clientForm!: FormGroup;
  DOCUMENT_TYPE = DOCUMENT_TYPE;

  constructor(private fb: FormBuilder, private clientServices: ClientService) {
  }

  ngOnInit(): void {
    this.initForm();
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
  }

  onSubmit=(): void => {
    console.log(this.clientForm.valid)
    if (this.clientForm.valid) {
    } else {
      this.markFormGroupTouched(this.clientForm);
      this.createClient();
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
    this.clientServices.createClient(client).subscribe( ():void => {
      this.clientServices.searchClient();
      this.goBack.emit();
      this.searchClient.emit();
    })
  }
}
