import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgramaAyoService } from '../../../../core/services/programa-ayo.service';
import { StorageServices } from '../../../../core/services/storage.services';

interface Evaluation {
  id: string;
  fecha: string;
  observaciones: string;
  docente_id: string;
  evaluado_por: string;
  calificacion: string;
  programa_ayo_id: string;
  criterio_evaluacion_id: {
    id: string;
    nombre: string;
  };
}

interface CriterionAnalysis {
  name: string;
  average: number;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-teacher-evaluation-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './teacher-evaluation.html',
  styleUrls: ['./teacher-evaluation.css']
})
export class TeacherEvaluationPage implements OnInit {
  isLoading = true;
  evaluations: Evaluation[] = [];
  averageRating: number = 0;
  totalEvaluations: number = 0;
  criteriaAnalysis: CriterionAnalysis[] = [];
  recentComments: Evaluation[] = [];

  constructor(
    private programaAyoService: ProgramaAyoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEvaluations();
  }

  loadEvaluations(): void {
    const user = StorageServices.getItemObjectFromSessionStorage('current_user');
    if (user?.id) {
      this.programaAyoService.getCalificacionesDocente(user.id).subscribe({
        next: (response) => {
          if (response.data) {
            this.evaluations = response.data;
            this.processEvaluations();
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading evaluations', error);
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  processEvaluations(): void {
    if (this.evaluations.length === 0) return;

    // Calculate total average
    const totalScore = this.evaluations.reduce((acc, curr) => acc + Number(curr.calificacion), 0);
    this.totalEvaluations = this.evaluations.length;
    this.averageRating = totalScore / this.totalEvaluations;

    // Group by criterion
    const criteriaMap = new Map<string, { name: string, total: number, count: number }>();

    this.evaluations.forEach(evaluation => {
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
      percentage: ((item.total / item.count) / 5) * 100 // Assuming 5 is max score
    }));

    // Extract comments
    this.recentComments = this.evaluations
      .filter(e => e.observaciones && e.observaciones.trim() !== '')
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 10); // Last 10 comments
  }
}
