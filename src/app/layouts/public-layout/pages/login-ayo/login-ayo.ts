import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PruebaService } from '../../../../core/services/prueba.service';

@Component({
    selector: 'app-login-ayo',
    standalone: true,
    imports: [ReactiveFormsModule, RouterModule],
    templateUrl: './login-ayo.html',
    styleUrls: ['./login-ayo.css']
})
export class LoginAyo implements OnInit {
    registerForm!: FormGroup;
    loginForm!: FormGroup;

    isLoginMode: boolean = true; // Default to Login view
    isLoading: boolean = false;

    constructor(private formBuilder: FormBuilder, private pruebaService: PruebaService) { }

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

    testService() {
        const ids = ["002c3b78-b952-489d-877c-ad51ca633ff8",
          "17a09429-343f-4468-8474-020120f696d2"];
        this.pruebaService.triggerPrueba(ids).subscribe({
            next: (res) => {
                console.log('Prueba exitosa', res);
                alert('Prueba exitosa: ' + JSON.stringify(res));
            },
            error: (err) => {
                console.error('Error prueba', err);
                alert('Error en prueba: ' + JSON.stringify(err));
            }
        });
    }
}
