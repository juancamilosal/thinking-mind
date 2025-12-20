import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-entry-validation',
    standalone: true,
    imports: [ReactiveFormsModule, CommonModule, RouterModule],
    templateUrl: './entry-validation.html',
    styleUrls: ['./entry-validation.css']
})
export class EntryValidation implements OnInit {
    validationForm!: FormGroup;
    isLoading: boolean = false;

    constructor(private formBuilder: FormBuilder) { }

    ngOnInit(): void {
        this.validationForm = this.formBuilder.group({
            tipoDocumento: ['', Validators.required],
            numeroDocumento: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            codigoVerificacion: ['', Validators.required]
        });
    }

    onSubmit() {
        if (this.validationForm.invalid) return;
        this.isLoading = true;
        console.log('Form Submit:', this.validationForm.value);

        // Simulate API call
        setTimeout(() => {
            this.isLoading = false;
            alert('Validación simulada exitosa');
        }, 1500);
    }
}
