import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
  courses: Course[] = [];
  isLoading = false;
  searchTerm = '';
  selectedCourse: any = null;
  showCourseInfo = false;

  constructor(private fb: FormBuilder, private courseServices: CourseService) {
    }

  ngOnInit() {
    this.initForm();
    this.searchCourse();
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



  openCourseInfo(course: any) {
    this.selectedCourse = course;
    this.showCourseInfo = true;
  }

  closeCourseInfo() {
    this.selectedCourse = null;
    this.showCourseInfo = false;
  }
}
