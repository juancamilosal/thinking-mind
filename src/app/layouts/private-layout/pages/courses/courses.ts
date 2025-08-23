import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {CourseCardComponent} from '../../../../components/course-card/course-card';
import {CourseInfoComponent} from '../../../../components/course-info/course-info';
import { CourseService } from '../../../../core/services/course.service';
import { Course } from '../../../../core/models/Course';

@Component({
  selector: 'app-courses',
  imports: [
    CourseCardComponent, CourseInfoComponent
  ],
  templateUrl: './courses.html',
  standalone: true
})

export class Courses {
  courseForm!: FormGroup;
  showForm = false;
  showDetail = false;
  editMode = false;
  selectedCourse: Course | null = null;
  courses: Course[] = [];
  isLoading = false;
  searchTerm = '';
  showCourseInfo = false;
  private searchTimeout: any;

  constructor(private fb: FormBuilder, private courseServices: CourseService) {
    }

  ngOnInit() {
    this.initForm();
    this.searchCourse();
  }

  toggleForm() {
    this.showForm = !this.showForm;
    this.editMode = false;
    this.selectedCourse = null;
  }

  initForm() {
    this.courseForm = this.fb.group({
      courseName: ['', Validators.required],
      price: ['', Validators.required],
      code: ['', Validators.required]
    });
  }

  searchCourse(searchTerm?: string) {
    this.isLoading = true;
    this.courseServices.searchCourse(searchTerm).subscribe({
      next: (data) => {
        this.courses = data.data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    this.searchCourse(this.searchTerm.trim() || undefined);
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
      this.searchCourse(this.searchTerm.trim() || undefined);
    }, 500); // 500ms de delay
  }

  openCourseInfo(course: any) {
    this.selectedCourse = course;
    this.showCourseInfo = true;
  }

  closeCourseInfo() {
    this.selectedCourse = null;
    this.showCourseInfo = false;
  }
}
