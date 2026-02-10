import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StudentService } from '../../../../core/services/student.service';
import { AttendanceService } from '../../../../core/services/attendance.service';
import { StorageServices } from '../../../../core/services/storage.services';
import { Attendance } from '../../../../core/models/Attendance';
import { environment } from '../../../../../environments/environment';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface LevelAnalysis {
  levelName: string;
  theme: string;
  averageScore: number;
  attendancePercentage: number;
  totalSessions: number;
  attendedSessions: number;
  lastObservation: string;
  observations: { date: string, text: string, score: number, isDefault: boolean }[];
  trend: 'up' | 'down' | 'stable';
}

@Component({
  selector: 'app-advance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './advance.html',
  styleUrl: './advance.css'
})
export class Advance implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('progressChart') progressChartRef!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;
  isLoading = true;
  attendanceList: Attendance[] = [];
  chartWidth: string = '100%';
  levelAnalysisList: LevelAnalysis[] = [];

  assetsUrl = environment.assets;
  ayoStats = {
    nivel: 'No asignado',
    subcategoria: '',
    idioma: '',
    tematica: '',
    calificacion: 0,
    resultado_test: 'No realizado'
  };

  constructor(
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadStats();
    this.loadAttendances();
  }

  ngAfterViewInit(): void {
    // Inicializar el gráfico después de que la vista esté lista
    // Usamos un pequeño timeout para asegurar que el DOM esté renderizado
    setTimeout(() => {
      this.initChart();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  loadStats(): void {
    this.isLoading = true;
    const user = StorageServices.getCurrentUser();
    if (user) {
      // Inicializar con datos de sesión
      this.ayoStats = {
        nivel: user.nivel || user.nivel_id || 'No asignado',
        subcategoria: user.subcategoria || '',
        idioma: user.idioma || '',
        tematica: user.tematica || '',
        calificacion: user.calificacion || 0,
        resultado_test: user.resultado_test || 'No realizado'
      };

      this.studentService.dashboardStudent({ params: { user_id: user.id, role_id: user.role } }).subscribe({
        next: (response) => {
          // Manejar tanto response.data como response directo por si acaso
          const data = response.data || response;

          if (data) {
            this.ayoStats = {
              nivel: data.nivel || this.ayoStats.nivel,
              subcategoria: data.subcategoria || this.ayoStats.subcategoria,
              idioma: data.idioma || this.ayoStats.idioma,
              tematica: data.tematica || this.ayoStats.tematica,
              calificacion: data.calificacion !== null ? data.calificacion : 0,
              resultado_test: (data.resultado_test && data.resultado_test !== 'undefined') ? data.resultado_test : 'No realizado'
            };
          }
          this.isLoading = false;
          this.cd.detectChanges();

          // Inicializar gráfico después de que el DOM se haya actualizado
          setTimeout(() => {
            this.initChart();
          }, 0);
        },
        error: (error) => {
          console.error('Error loading AYO stats', error);
          this.isLoading = false;
          this.cd.detectChanges();
          setTimeout(() => {
            this.initChart();
          }, 0);
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  loadAttendances(): void {
    const user = StorageServices.getCurrentUser();
    if (user && user.id) {
      const filter = { estudiante_id: user.id };
      // Limit set to 100 to get a good amount of history without pagination for now
      this.attendanceService.getAttendances(1, 100, '', filter, 'fecha', '*,programa_ayo_id.*,programa_ayo_id.id_nivel.*').subscribe({
        next: (response) => {
          this.attendanceList = response.data || [];
          this.processLevelAnalysis();
          // Una vez cargadas las asistencias, inicializamos el gráfico con los datos reales
          setTimeout(() => {
            this.initChart();
          }, 0);
        },
        error: (error) => {
          this.attendanceList = [];
          setTimeout(() => {
            this.initChart();
          }, 0);
        }
      });
    }
  }

  processLevelAnalysis(): void {
    const groupedByLevel: { [key: string]: Attendance[] } = {};

    // Agrupar asistencias por nivel (id_nivel)
    this.attendanceList.forEach(att => {
      // Acceder de forma segura a la estructura anidada
      // att.programa_ayo_id puede ser un objeto o string, pero con el 'fields' que pedimos debería ser objeto
      const programa = att['programa_ayo_id'] as any;
      const nivel = programa?.id_nivel;

      if (nivel && typeof nivel === 'object' && nivel.id) {
        const levelKey = nivel.id; // Usamos el ID para agrupar
        if (!groupedByLevel[levelKey]) {
          groupedByLevel[levelKey] = [];
        }
        groupedByLevel[levelKey].push(att);
      }
    });

    // Calcular estadísticas por cada grupo
    this.levelAnalysisList = Object.keys(groupedByLevel).map(levelId => {
      const attendances = groupedByLevel[levelId];
      // Ordenar por fecha para análisis de tendencia
      attendances.sort((a, b) => new Date(a.fecha!).getTime() - new Date(b.fecha!).getTime());

      // Obtener info del nivel del primer registro (todos deben ser iguales)
      const firstAtt = attendances[0];
      const programa = firstAtt['programa_ayo_id'] as any;
      const nivelInfo = programa.id_nivel;

      const levelName = `${nivelInfo.nivel} - ${nivelInfo.subcategoria}`;
      const theme = nivelInfo.tematica || 'General';

      const totalSessions = attendances.length;
      const attendedSessions = attendances.filter(a => a.asiste).length;
      const attendancePercentage = (attendedSessions / totalSessions) * 100;

      // Calcular promedio solo de las sesiones asistidas o calificadas
      const gradedSessions = attendances.filter(a => a.calificacion !== undefined && a.calificacion !== null);
      const totalScore = gradedSessions.reduce((sum, a) => sum + Number(a.calificacion), 0);
      const averageScore = gradedSessions.length > 0 ? totalScore / gradedSessions.length : 0;

      // Última observación
      const lastObservation = attendances[attendances.length - 1].observaciones || 'Sin observaciones recientes';

      // Todas las observaciones (sin filtrar vacías)
      const observations = attendances
        .map(a => ({
          date: a.fecha || '',
          text: a.observaciones || 'Sin observaciones',
          isDefault: !a.observaciones,
          score: a.calificacion || 0
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Ordenar por fecha descendente

      // Tendencia (comparar última mitad vs primera mitad o últimos 3)
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (gradedSessions.length >= 2) {
        const recent = gradedSessions.slice(-2); // Últimos 2
        const previous = gradedSessions.slice(0, -2); // Anteriores

        if (previous.length > 0) {
            const avgRecent = recent.reduce((s, a) => s + Number(a.calificacion), 0) / recent.length;
            const avgPrev = previous.reduce((s, a) => s + Number(a.calificacion), 0) / previous.length;

            if (avgRecent > avgPrev + 0.5) trend = 'up';
            else if (avgRecent < avgPrev - 0.5) trend = 'down';
        }
      }

      return {
        levelName,
        theme,
        averageScore,
        attendancePercentage,
        totalSessions,
        attendedSessions,
        lastObservation,
        observations,
        trend
      };
    });
  }

  initChart(): void {
    if (!this.progressChartRef) return;

    // Destruir gráfico existente si hay uno
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Procesar datos reales de asistencia
    // Filtramos solo los que tienen calificación y están ordenados por fecha
    const validAttendances = this.attendanceList
      .filter(a => a.calificacion !== undefined && a.calificacion !== null)
      // Asegurar orden cronológico
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    // Si no hay datos, usamos arrays vacíos para mostrar gráfico vacío
    const labels = validAttendances.length > 0
      ? validAttendances.map((a, index) => `Sesión ${index + 1} - ${new Date(a.fecha).toLocaleDateString()}`)
      : [];

    const dataPoints = validAttendances.length > 0
      ? validAttendances.map(a => Number(a.calificacion))
      : [];

    const average = dataPoints.length > 0
      ? dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length
      : 0;

    // Calcular ancho dinámico: mínimo 100% o 60px por punto
    // Esto asegura que si hay muchos puntos, el gráfico se expanda y aparezca el scroll
    const minWidthPerPoint = 100;
    const calculatedWidth = Math.max(
      this.progressChartRef.nativeElement.parentElement?.parentElement?.offsetWidth || 0,
      labels.length * minWidthPerPoint
    );
    this.chartWidth = `${calculatedWidth}px`;

    // Forzar detección de cambios para aplicar el nuevo ancho antes de renderizar
    this.cd.detectChanges();

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Calificación por Sesión',
            data: dataPoints,
            borderColor: '#13486e',
            backgroundColor: 'rgba(19, 72, 110, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#13486e',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            fill: true,
            tension: 0.4 // Curva suave
          },
          {
            label: 'Promedio General',
            data: Array(labels.length).fill(average),
            borderColor: '#d5ca25',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            titleColor: '#13486e',
            bodyColor: '#666',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + context.parsed.y.toFixed(1);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 6, // Aumentamos un poco el max para que no se corte la linea en 5
            min: 0,
            ticks: {
              stepSize: 1,
              font: {
                family: "'Plus Jakarta Sans', sans-serif"
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: "'Plus Jakarta Sans', sans-serif"
              },
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    });
  }

  private generateMockHistory(targetAverage: number): number[] {
    // Método deprecado, se usan datos reales
    return [];
  }

  goBack(): void {
    this.router.navigate(['/private-ayo/dashboard']);
  }

  getStarArray(score: number): number[] {
    return Array(Math.round(score)).fill(0);
  }

  getScoreLabel(score: number): string {
    const roundedScore = Math.round(score);
    switch (roundedScore) {
      case 1: return 'Exploring';
      case 2: return 'Growing';
      case 3: return 'Moving Forward';
      case 4: return 'Shining';
      case 5: return 'Star Performer';
      default: return '';
    }
  }

  getProgressBarClass(score: number): string {
    if (score < 50) {
      return 'bg-gradient-to-r from-gray-400 to-gray-500';
    } else if (score >= 50 && score < 80) {
      return 'bg-gradient-to-r from-orange-400 to-orange-500';
    } else {
      return 'bg-gradient-to-r from-green-400 to-green-500';
    }
  }

  getProgressBarWidth(score: number): string {
    // Cap at 100%
    const percentage = Math.min((score / 80) * 100, 100);
    return `${percentage}%`;
  }
}
