import { AfterViewInit, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SchoolService } from '../../../../core/services/school.service';
import { School } from '../../../../core/models/Schools';

@Component({
  selector: 'app-schools',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './schools.html'
})
export class Schools implements OnInit {
  schoolForm!: FormGroup;
  showForm = false;

  schools: School[] = [];

  constructor(private fb: FormBuilder, private schoolServices: SchoolService) {
  }

  ngOnInit() {
    this.initForm();
    this.searchSchool();
  }

  initForm(){
    this.schoolForm = this.fb.group({
      schoolName: ['', Validators.required],
      city: ['', Validators.required],
      address: ['', Validators.required],
      principalName: ['', Validators.required],
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]]
    });
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.schoolForm.reset();
    }
  }

  onSubmit() {
    if (this.schoolForm.valid) {
      console.log(this.schoolForm.value);
    } else {
      this.markFormGroupTouched(this.schoolForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  searchSchool() {
    this.schoolServices.searchSchool().subscribe(data => {
      this.schools = data.data;
    }
  )
  }
}

