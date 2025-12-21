import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CourseService } from '../../../../core/services/course.service';
import { Course } from '../../../../core/models/Course';

import { ColegioCursosComponent } from '../courses/form-colegio-cursos/form-colegio-cursos';

@Component({
  selector: 'app-ayo',
  standalone: true,
  imports: [CommonModule, ColegioCursosComponent],
  templateUrl: './ayo.html',
  styleUrls: ['./ayo.css']
})
export class AyoComponent implements OnInit {
  courses: Course[] = [];
  isLoading: boolean = true;
  showForm: boolean = false;

  constructor(private courseService: CourseService) { }

  ngOnInit(): void {
    this.loadCourses();
  }

  loadCourses(): void {
    this.isLoading = true;
    const ayoCourseId = '28070b14-f3c1-48ec-9e2f-95263f19eec3';

    this.courseService.getCourseByIdFiltered(ayoCourseId).subscribe({
      next: (response) => {
        if (response.data) {
          this.courses = response.data;
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading courses:', error);
        this.isLoading = false;
      }
    });
  }

  openForm(): void {
    this.showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closeForm(): void {
    this.showForm = false;
  }

  onColegioAdded(): void {
    this.closeForm();
    this.loadCourses();
  }
}
