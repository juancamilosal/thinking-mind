import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SchoolService } from '../../../../../core/services/school.service';
import { StudentService } from '../../../../../core/services/student.service';
import { School } from '../../../../../core/models/School';
import { Student } from '../../../../../core/models/Student';

interface GradeCategory {
  color: string;
  colorName: string;
  gradeRange: string;
  count: number;
  students: Student[];
}

@Component({
  selector: 'app-shirt-colors',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shirt.color.html'
})

export class ShirtColor implements OnInit {
  willGoStudents: Student[] = [];
  gradeCategories: GradeCategory[] = [];
  isLoading = true;

  constructor(
    private router: Router,
    private studentService: StudentService
  ) {}

  ngOnInit(): void {
    this.loadWillGoStudents();
  }

  loadWillGoStudents(): void {
    //Lógica para cargar estudiantes will-go
    this.isLoading = true;

    this.studentService.getStudentsByCourseName('WILL-GO').subscribe({
      next: (response) => {
        this.willGoStudents = response.data;
        this.processWillGoStudents();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching WILL-GO students:', err);
        this.isLoading = false;
      }
    });
  }

  processWillGoStudents(): void {
    // Parse the grade number from the string
    const getGradeNumber = (gradeString: string | undefined): number => {
      if (!gradeString) return 0;
      const grade = parseInt(gradeString, 10);
      return isNaN(grade) ? 0 : grade;
    };
    // Sort students by grade (lowest to highest)
    this.willGoStudents.sort((a, b) => {
      const gradeA = getGradeNumber(a.grado);
      const gradeB = getGradeNumber(b.grado);
      return gradeA - gradeB;
    });

    // Initialize grade categories
    this.gradeCategories = [
      { color: '#FFEB3B', colorName: 'amarillo', gradeRange: '1-3', count: 0, students: [] },
      { color: '#FF9800', colorName: 'naranja', gradeRange: '4', count: 0, students: [] },
      { color: '#4CAF50', colorName: 'verde', gradeRange: '5', count: 0, students: [] },
      { color: '#F44336', colorName: 'rojo', gradeRange: '6', count: 0, students: [] },
      { color: '#2196F3', colorName: 'azul', gradeRange: '7+', count: 0, students: [] }
    ];

    // Group students by grade categories
    this.willGoStudents.forEach(student => {
      const gradeNumber = getGradeNumber(student.grado);
      if (gradeNumber > 0) {
        const categoryIndex = this.getGradeCategoryIndex(gradeNumber);
        if (categoryIndex !== -1) {
          this.gradeCategories[categoryIndex].students.push(student);
          this.gradeCategories[categoryIndex].count++;
        }
      }
    });
  }

  getGradeCategoryIndex(grade: number): number {
    if (grade >= 1 && grade <= 3) return 0; // Yellow
    if (grade === 4) return 1; // Orange
    if (grade === 5) return 2; // Green
    if (grade === 6) return 3; // Red
    if (grade >= 7) return 4; // Blue
    return -1; // Invalid grade
  }

  getGradeColor(grade: string | undefined): string {
    const gradeNumber = parseInt(grade || '0', 10);
    if (gradeNumber >= 1 && gradeNumber <= 3) return '#FFEB3B'; // Yellow
    if (gradeNumber === 4) return '#FF9800'; // Orange
    if (gradeNumber === 5) return '#4CAF50'; // Green
    if (gradeNumber === 6) return '#F44336'; // Red
    if (gradeNumber >= 7) return '#2196F3'; // Blue
    return '#9E9E9E'; // Gray for unknown
  }

  getGradeColorName(grade: string | undefined): string {
    const gradeNumber = parseInt(grade || '0', 10);
    if (gradeNumber >= 1 && gradeNumber <= 3) return 'yellow';
    if (gradeNumber === 4) return 'orange';
    if (gradeNumber === 5) return 'green';
    if (gradeNumber === 6) return 'red';
    if (gradeNumber >= 7) return 'blue';
    return 'gray';
  }

  onRegresar(): void {
    this.router.navigate(['/private/list-schools']);
  }

}
