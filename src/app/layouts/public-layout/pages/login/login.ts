import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})

export class Login {
  private formBuilder = inject(FormBuilder);

  loginForm = this.formBuilder.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]]
      });

  onSubmit() {
      if (this.loginForm.valid) {
        console.log('Login Form Data:', this.loginForm.value);
        // login logic
      } else {
        console.log('Form is invalid');
      }
  }

}
