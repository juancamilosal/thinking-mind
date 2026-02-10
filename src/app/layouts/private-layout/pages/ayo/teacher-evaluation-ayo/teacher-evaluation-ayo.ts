import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { UserService } from '../../../../../core/services/user.service';
import { Roles } from '../../../../../core/const/Roles';
import { Router } from '@angular/router';

interface TeacherStat {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  avatar?: string;
  averageRating: number;
  totalEvaluations: number;
  lastEvaluationDate: string;
  evaluations?: any[];
}

interface CriterionAnalysis {
  name: string;
  average: number;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-teacher-evaluation-ayo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teacher-evaluation-ayo.html'
})
export class TeacherEvaluationAyoComponent implements OnInit {
  isLoading = true;
  isLoadingDetail = false;
  teachers: any[] = [];
  selectedTeacher: TeacherStat | null = null;
  state: 'list' | 'detail' = 'list';

  // Detail view data
  criteriaAnalysis: CriterionAnalysis[] = [];
  recentComments: any[] = [];

  constructor(
    private programaAyoService: ProgramaAyoService,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadTeachers();
  }

  loadTeachers() {
    this.isLoading = true;
    this.userService.getUsersByRole(Roles.TEACHER).subscribe({
      next: (response) => {
        this.teachers = (response.data || []).map((user: any) => ({
          teacherId: user.id,
          teacherName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          teacherEmail: user.email,
          avatar: user.avatar
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading teachers', err);
        this.isLoading = false;
      }
    });
  }

  selectTeacher(teacher: any) {
    this.isLoadingDetail = true;
    this.state = 'detail';
    
    // Initialize selected teacher with basic info
    this.selectedTeacher = {
      ...teacher,
      averageRating: 0,
      totalEvaluations: 0,
      lastEvaluationDate: '',
      evaluations: []
    };

    this.programaAyoService.getCalificacionesDocente(teacher.teacherId).subscribe({
      next: (response) => {
        if (response.data) {
          this.processDetailData(response.data);
        }
        this.isLoadingDetail = false;
      },
      error: (err) => {
        console.error('Error loading teacher evaluations', err);
        this.isLoadingDetail = false;
      }
    });
  }

  processDetailData(evaluations: any[]) {
    if (!this.selectedTeacher) return;
    
    this.selectedTeacher.evaluations = evaluations;
    
    if (evaluations.length === 0) {
      this.selectedTeacher.averageRating = 0;
      this.selectedTeacher.totalEvaluations = 0;
      return;
    }

    // Calculate total average
    const totalScore = evaluations.reduce((acc, curr) => acc + Number(curr.calificacion), 0);
    this.selectedTeacher.totalEvaluations = evaluations.length;
    this.selectedTeacher.averageRating = totalScore / this.selectedTeacher.totalEvaluations;
    
    // Last evaluation date
    const sortedEvaluations = [...evaluations].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    this.selectedTeacher.lastEvaluationDate = sortedEvaluations[0]?.fecha;

    // Group by criterion
    const criteriaMap = new Map<string, { name: string, total: number, count: number }>();

    evaluations.forEach(evaluation => {
      const criterionId = evaluation.criterio_evaluacion_id?.id;
      const criterionName = evaluation.criterio_evaluacion_id?.nombre || 'General';
      
      if (criterionId) {
        if (!criteriaMap.has(criterionId)) {
          criteriaMap.set(criterionId, { name: criterionName, total: 0, count: 0 });
        }
        const data = criteriaMap.get(criterionId)!;
        data.total += Number(evaluation.calificacion);
        data.count++;
      }
    });

    this.criteriaAnalysis = Array.from(criteriaMap.values()).map(item => ({
      name: item.name,
      average: item.total / item.count,
      count: item.count,
      percentage: ((item.total / item.count) / 5) * 100
    }));

    // Extract comments
    this.recentComments = sortedEvaluations
      .filter(e => e.observaciones && e.observaciones.trim() !== '')
      .slice(0, 10);
  }

  goBack() {
    if (this.state === 'detail') {
      this.state = 'list';
      this.selectedTeacher = null;
      this.criteriaAnalysis = [];
      this.recentComments = [];
    } else {
      this.router.navigate(['/private/ayo']);
    }
  }
}
