import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StudentService } from '../../../../core/services/student.service';
import { StorageServices } from '../../../../core/services/storage.services';
import { environment } from '../../../../../environments/environment';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

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
    private router: Router,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadStats();
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
    const user = StorageServices.getItemObjectFromSessionStorage('current_user');
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

  initChart(): void {
    if (!this.progressChartRef) return;

    // Destruir gráfico existente si hay uno
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Generar datos simulados basados en la calificación actual
    // Si la calificación es 0, usamos datos aleatorios bajos
    const currentGrade = this.ayoStats.calificacion || 0;
    const mockData = this.generateMockHistory(currentGrade);
    const average = mockData.reduce((a, b) => a + b, 0) / mockData.length;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Sesión 1', 'Sesión 2', 'Sesión 3', 'Sesión 4', 'Sesión 5', 'Sesión 6', 'Sesión 7', 'Sesión 8'],
        datasets: [
          {
            label: 'Calificación por Sesión',
            data: mockData,
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
            data: Array(8).fill(average),
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
            max: 10,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
            },
            ticks: {
              font: {
                family: "'Plus Jakarta Sans', sans-serif"
              }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: "'Plus Jakarta Sans', sans-serif"
              }
            }
          }
        }
      }
    });
  }

  private generateMockHistory(targetAverage: number): number[] {
    // Generar 8 puntos de datos que promedien aproximadamente el targetAverage
    // Variación aleatoria pero coherente
    const data = [];
    let current = Math.max(1, targetAverage - 2); // Empezar un poco más bajo

    for (let i = 0; i < 8; i++) {
      // Variación aleatoria entre -1.5 y +2.0
      const variation = (Math.random() * 3.5) - 1.5;
      let val = current + variation;
      
      // Mantener dentro de rangos lógicos (0-10)
      val = Math.max(1, Math.min(10, val));
      
      // Ajustar el último valor para acercarse al promedio real si es necesario
      if (i === 7) {
        val = targetAverage; 
      }
      
      data.push(Number(val.toFixed(1)));
      current = val;
    }
    
    return data;
  }

  goBack(): void {
    this.router.navigate(['/private/dashboard']);
  }
}
