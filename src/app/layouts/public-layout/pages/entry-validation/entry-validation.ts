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
    registerForm!: FormGroup;
    loginForm!: FormGroup;

    isLoginMode: boolean = true; // Default to Login view
    isLoading: boolean = false;

    constructor(private formBuilder: FormBuilder) { }

    ngOnInit(): void {
        // Form for Registration (Existing)
        this.registerForm = this.formBuilder.group({
            tipoDocumento: ['', Validators.required],
            numeroDocumento: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            codigoVerificacion: ['', Validators.required]
        });

        // Form for Login (New)
        this.loginForm = this.formBuilder.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });
    }

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        // Optional: Reset forms when switching?
        // this.loginForm.reset();
        // this.registerForm.reset();
    }

    onLoginSubmit() {
        if (this.loginForm.invalid) return;
        this.isLoading = true;
        console.log('Login Submit:', this.loginForm.value);

        setTimeout(() => {
            this.isLoading = false;
            alert('Login simulado exitoso');
        }, 1500);
    }

    onRegisterSubmit() {
        if (this.registerForm.invalid) return;
        this.isLoading = true;
        console.log('Register Submit:', this.registerForm.value);

        setTimeout(() => {
            this.isLoading = false;
            alert('Registro simulado exitoso');
        }, 1500);
    }
}
