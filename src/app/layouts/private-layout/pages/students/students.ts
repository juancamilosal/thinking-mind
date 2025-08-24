import {Component, OnInit} from '@angular/core';
import {FormBuilder} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {StudentService} from '../../../../core/services/student.service';
import {Student} from '../../../../core/models/Student';
import {FormStudent} from './form-student/form-student';
import {StudentDetail} from './student-detail/student-detail';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [CommonModule, FormStudent, StudentDetail],
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
}