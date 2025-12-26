import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProgramaAyoService } from '../../../../core/services/programa-ayo.service';
import { PrecioProgramaAyo } from '../../../../core/models/Course';
import { DOCUMENT_TYPE } from '../../../../core/const/DocumentTypeConst';

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
    precioPrograma: PrecioProgramaAyo | null = null;
    DOCUMENT_TYPE = DOCUMENT_TYPE;

    constructor(
        private formBuilder: FormBuilder,
        private programaAyoService: ProgramaAyoService
    ) { }

    ngOnInit(): void {
        this.loadPrecioPrograma();
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
            studentEmail: ['', [Validators.required, Validators.email]],
            studentColegio: ['', Validators.required]
        });
    }

    loadPrecioPrograma(): void {
        this.programaAyoService.getPrecioProgramaAyo().subscribe({
            next: (response) => {
                if (response.data && response.data.length > 0) {
                    this.precioPrograma = response.data[0];
                }
            },
            error: (error) => {
                console.error('Error loading program price:', error);
            }
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
