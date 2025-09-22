import {Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { School } from '../../../../core/models/School';
import {SchoolService} from '../../../../core/services/school.service';
import {FormSchool} from './form-school/form-school';
import {SchoolDetail} from './school-detail/school-detail';

@Component({
  selector: 'app-schools',
  standalone: true,
  imports: [ReactiveFormsModule, FormSchool, SchoolDetail],
  templateUrl: './schools.html'
})
export class Schools implements OnInit {
  schoolForm!: FormGroup;
  showForm = false;
  showModal = false;
  editMode = false;
  schools: School[] = [];
  isLoading = false;
  searchTerm = '';
  private searchTimeout: any;
  selectedSchool: School | null = null;
  
  // Propiedades de paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 15, 20, 50];
  Math = Math; // Para usar Math.min en el template


  constructor(private fb: FormBuilder, private schoolServices: SchoolService) {
  }

  ngOnInit() {
    this.initForm();
    this.loadSchools();
  }

  loadSchools() {
    this.loadSchoolsPage();
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
      this.editMode = false;
      this.selectedSchool = null;
    } else {
      // Si se está abriendo el formulario y no hay selectedSchool, es para crear
      if (!this.selectedSchool) {
        this.editMode = false;
      }
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
    this.showModal = true;
  }

  editSchool(school: School) {
    this.selectedSchool = school;
    this.showForm = true;
    this.editMode = true;
    this.loadSchoolData();
  }

  closeModal() {
    this.showModal = false;
    this.selectedSchool = null;
  }

  onSchoolUpdated() {
    this.showForm = false;
    this.editMode = false;
    this.selectedSchool = null;
    this.searchSchool();
  }

  onSchoolDeleted() {
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
        principalName: this.selectedSchool.rector_id,
        phoneNumber: this.selectedSchool.celular
      });
    }
  }

  searchSchool() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1; // Reset a la primera página al buscar
      this.loadSchoolsPage();
    }, 300);
  }

  onSearch() {
    this.searchSchool();
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    this.searchSchool();
  }

  // Métodos de paginación
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadSchoolsPage();
    }
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    this.loadSchoolsPage();
  }

  loadSchoolsPage(): void {
    this.isLoading = true;
    const searchMethod = this.searchTerm.trim() ? 
      this.schoolServices.searchSchool(this.searchTerm, this.currentPage, this.itemsPerPage) :
      this.schoolServices.getAllSchools(this.currentPage, this.itemsPerPage);
    
    searchMethod.subscribe({
      next: (response) => {
        this.schools = response.data;
        this.totalItems = response.meta?.filter_count || response.data.length;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar los colegios:', error);
        this.isLoading = false;
      }
    });
  }

  getPaginationArray(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  createSchool() {
    const school = {
      nombre: this.schoolForm.value.schoolName,
      ciudad: this.schoolForm.value.city,
      direccion: this.schoolForm.value.address,
      nombre_rector: this.schoolForm.value.principalName,
      celular: this.schoolForm.value.phoneNumber
    }
    this.schoolServices.createSchool(school).subscribe()}
}

