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
  totalPages = 0;
  itemsPerPageOptions = [5, 10, 25, 50];
  paginatedStudents: Student[] = [];
  private searchTimeout: any;
  
  constructor(private fb: FormBuilder, private studentService: StudentService) {
  }

  ngOnInit(): void {
    this.searchStudent();
  }

  toggleForm() {
    this.showForm = !this.showForm;
  }

  searchStudent(searchTerm?: string) {
    this.isLoading = true;
    this.studentService.searchStudent(searchTerm).subscribe({
      next: (data) => {
        this.students = data.data;
        this.updatePagination();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading students:', error);
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.searchStudent(this.searchTerm.trim() || undefined);
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
      this.searchStudent(this.searchTerm.trim() || undefined);
    }, 500); // 500ms de delay
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
    this.searchStudent();
  }
  
  // Pagination methods
  updatePagination() {
    this.totalPages = Math.ceil(this.students.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    this.updatePaginatedStudents();
  }
  
  updatePaginatedStudents() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedStudents = this.students.slice(startIndex, endIndex);
  }
  
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedStudents();
    }
  }
  
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedStudents();
    }
  }
  
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedStudents();
    }
  }
  
  onItemsPerPageChange(event: any) {
    this.itemsPerPage = parseInt(event.target.value);
    this.currentPage = 1;
    this.updatePagination();
  }
  
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    if (this.totalPages <= maxVisiblePages) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      const halfVisible = Math.floor(maxVisiblePages / 2);
      let startPage = Math.max(1, this.currentPage - halfVisible);
      let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
      
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }
  
  // Utility method for Math functions in template
  Math = Math;
}