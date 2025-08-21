import { AfterViewInit, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { School } from '../../../../core/models/School';
import { SchoolDetail } from './school-detail/school-detail';


@Component({
  selector: 'app-schools',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SchoolDetail],
  templateUrl: './schools.html'
})
export class Schools implements OnInit {
  schoolForm!: FormGroup;
  showForm = false;
  showDetail = false;
  editMode = false;
  schools: School[] = [];
  selectedSchool: School | null = null;

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


  viewSchool(school: School) {
    this.selectedSchool = school;
    this.showDetail = true;
    this.editMode = false;
  }

  editSchool(school: School) {
    this.selectedSchool = school;
    this.showForm = true;
    this.editMode = true;
    this.loadSchoolData();
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedSchool = null;
  }

  onSchoolUpdated() {
    this.showForm = false;
    this.editMode = false;
    this.selectedSchool = null;
    // Aquí se podría agregar la lógica para recargar la lista de colegios
  }

  loadSchoolData() {
    if (this.selectedSchool) {
      this.schoolForm.patchValue({
        schoolName: this.selectedSchool.schoolName,
        city: this.selectedSchool.city,
        address: this.selectedSchool.address,
        principalName: this.selectedSchool.principalName,
        phoneNumber: this.selectedSchool.phoneNumber
      });
    }
  }
}

  searchSchool() {
    this.schoolServices.searchSchool().subscribe(data => {
      this.schools = data.data;
    }
  )
  }
}