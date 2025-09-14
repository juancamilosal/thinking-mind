import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SchoolService } from '../../../../../core/services/school.service';
import { School } from '../../../../../core/models/School';

interface Student {
  status: string;
  name: string;
  grade: number;
}

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

  constructor(
    private router: Router,
    private schoolService: SchoolService
  ) {}

  ngOnInit(): void {
    this.loadWillGoStudents();
  }

  loadWillGoStudents(): void {
    //Lógica para cargar estudiantes will-go

    // Datos prueba temporales
    this.willGoStudents = [
      { status: 'Active', name: 'John Doe', grade: 2 },
      { status: 'Active', name: 'Jane Smith', grade: 5 },
      { status: 'Inactive', name: 'Bob Johnson', grade: 7 },
      { status: 'Active', name: 'Alice Brown', grade: 4 },
      { status: 'Active', name: 'Charlie Davis', grade: 1 },
      { status: 'Active', name: 'Eva Wilson', grade: 8 },
      { status: 'Active', name: 'Frank Miller', grade: 3 },
      { status: 'Active', name: 'Grace Lee', grade: 6 },
    ];

    this.processWillGoStudents();
  }

    processWillGoStudents(): void {
    // Sort students by grade (lowest to highest)
    this.willGoStudents.sort((a, b) => a.grade - b.grade);

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
      const categoryIndex = this.getGradeCategoryIndex(student.grade);
      if (categoryIndex !== -1) {
        this.gradeCategories[categoryIndex].students.push(student);
        this.gradeCategories[categoryIndex].count++;
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

  getGradeColor(grade: number): string {
    if (grade >= 1 && grade <= 3) return '#FFEB3B'; // Yellow
    if (grade === 4) return '#FF9800'; // Orange
    if (grade === 5) return '#4CAF50'; // Green
    if (grade === 6) return '#F44336'; // Red
    if (grade >= 7) return '#2196F3'; // Blue
    return '#9E9E9E'; // Gray for unknown
  }

  getGradeColorName(grade: number): string {
    if (grade >= 1 && grade <= 3) return 'yellow';
    if (grade === 4) return 'orange';
    if (grade === 5) return 'green';
    if (grade === 6) return 'red';
    if (grade >= 7) return 'blue';
    return 'gray';
  }

  onRegresar(): void {
    this.router.navigate(['/private/list-schools']);
  }

}
