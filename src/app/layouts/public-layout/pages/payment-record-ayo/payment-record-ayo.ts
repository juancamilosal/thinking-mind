import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-payment-record-ayo',
    standalone: true,
    imports: [ReactiveFormsModule, CommonModule, RouterModule],
    templateUrl: './payment-record-ayo.html',
    styleUrls: ['./payment-record-ayo.css']
})
export class PaymentRecordAyoComponent implements OnInit {
    paymentForm!: FormGroup;
    isLoading: boolean = false;

    constructor(private formBuilder: FormBuilder) { }

    ngOnInit(): void {
        this.paymentForm = this.formBuilder.group({
            tipoDocumento: ['', Validators.required],
            numeroDocumento: ['', Validators.required],
            nombre: ['', Validators.required],
            apellido: ['', Validators.required],
            celular: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
            email: ['', [Validators.required, Validators.email]],
            direccion: ['', Validators.required],
            // Student Information
            studentTipoDocumento: ['', Validators.required],
            studentNumeroDocumento: ['', Validators.required],
            studentNombre: ['', Validators.required],
            studentApellido: ['', Validators.required],
            studentColegio: ['', Validators.required]
        });
    }

    onSubmit() {
        if (this.paymentForm.invalid) return;
        this.isLoading = true;
        console.log('Payment Record Submit:', this.paymentForm.value);

        setTimeout(() => {
            this.isLoading = false;
            alert('Información enviada correctamente');
        }, 1500);
    }
}
