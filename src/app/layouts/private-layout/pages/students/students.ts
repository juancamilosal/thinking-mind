import {Component, OnInit} from '@angular/core';
import {FormBuilder} from '@angular/forms';

import {StudentService} from '../../../../core/services/student.service';
import {Student} from '../../../../core/models/Student';
import {FormStudent} from './form-student/form-student';
import {StudentDetail} from './student-detail/student-detail';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [FormStudent, StudentDetail],
  templateUrl: './students.html'
})
export class Students implements OnInit {
  showForm = false;
  showDetail = false;
  editMode = false;
  students: Student[] = [];
  selectedStudent: Student | null = null;
  isLoading = false;
  searchTerm = '';
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 15, 20, 50];
  Math = Math; // Para usar Math.min en el template
  private searchTimeout: any;
  
  constructor(private fb: FormBuilder, private studentService: StudentService) {
  }

  ngOnInit(): void {
    this.loadStudentsPage();
  }

  // Métodos de paginación
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadStudentsPage();
    }
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value);
    this.currentPage = 1;
    this.loadStudentsPage();
  }

  loadStudentsPage(): void {
    this.isLoading = true;
    const searchMethod = this.searchTerm.trim() ? 
      this.studentService.searchStudent(this.searchTerm, this.currentPage, this.itemsPerPage) :
      this.studentService.getAllStudents(this.currentPage, this.itemsPerPage);
    
    searchMethod.subscribe({
      next: (response) => {
        this.students = response.data;
        this.totalItems = response.meta?.filter_count || response.data.length;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar los estudiantes:', error);
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

  searchStudent() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadStudentsPage();
    }, 300);
  }

  onSearch() {
    this.searchStudent();
  }

  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    this.searchStudent();
  }

  toggleForm() {
    this.showForm = !this.showForm;
  }

  viewStudent(student: Student) {
    this.selectedStudent = student;
    this.showDetail = true;
    this.editMode = false;
  }

  editStudent(student: Student) {
    this.selectedStudent = student;
    this.showForm = true;
    this.editMode = true;
    this.showDetail = false;
  }

  closeDetail() {
    this.showDetail = false;
    this.selectedStudent = null;
  }

  onStudentUpdated() {
    this.showForm = false;
    this.editMode = false;
    this.selectedStudent = null;
    this.loadStudentsPage();
  }
}