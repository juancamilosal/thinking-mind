import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})

export class Login implements OnInit {
  loginForm: FormGroup;

  constructor(private fb: FormBuilder, private route: Router) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: [null, [Validators.required, Validators.email]],
      password: [null, [Validators.required]]
    })
  }

  onSubmit() {
      if (this.loginForm.invalid) {
        console.log('Form is invalid');
        return;
      }
      console.log('Login Form Data:', this.loginForm.value);
      this.route.navigateByUrl('/private');
  }

}
