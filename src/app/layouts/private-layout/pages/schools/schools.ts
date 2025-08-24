import {Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { School } from '../../../../core/models/School';
import {SchoolService} from '../../../../core/services/school.service';
import {FormSchool} from './form-school/form-school';

@Component({
  selector: 'app-schools',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormSchool],
  templateUrl: './schools.html'
})
export class Schools implements OnInit {
  schoolForm!: FormGroup;
  showForm = false;
  showDetail = false;
  editMode = false;
  schools: School[] = [];
  isLoading = false;
  searchTerm = '';
  private searchTimeout: any;
  selectedSchool: School | null = null;


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
      this.createSchool();
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
    this.searchSchool();
  }

  loadSchoolData() {
    if (this.selectedSchool) {
      this.schoolForm.patchValue({
        schoolName: this.selectedSchool.nombre,
        city: this.selectedSchool.ciudad,
        address: this.selectedSchool.direccion,
        principalName: this.selectedSchool.nombre_rector,
        phoneNumber: this.selectedSchool.celular
      });
    }
  }

  searchSchool(searchTerm?: string) {
    this.isLoading = true;
    this.schoolServices.searchSchool(searchTerm).subscribe({
      next: (data) => {
        this.schools = data.data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading schools:', error);
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.searchSchool(this.searchTerm.trim() || undefined);
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    
    // Limpiar timeout anterior
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Establecer nuevo timeout para búsqueda automática
    this.searchTimeout = setTimeout(() => {
      this.searchSchool(this.searchTerm.trim() || undefined);
    }, 500); // 500ms de delay
  }

  createSchool() {
    const school = {
      nombre: this.schoolForm.value.schoolName,
      ciudad: this.schoolForm.value.city,
      direccion: this.schoolForm.value.address,
      nombre_rector: this.schoolForm.value.principalName,
      celular: this.schoolForm.value.phoneNumber
    }
    this.schoolServices.createSchool(school).subscribe(data => {
      console.log(data.data);
    })}
}

