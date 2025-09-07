import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

interface BudgetData {
  monto_meta: number;
  recaudado: number;
  faltante: number;
  meta_mensual: number;
  recaudo_mes: number;
  meta_semanal: number;
  recaudo_semana: number;
  anio: string;
}



@Component({
  selector: 'app-budget-charts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-8">
      <!-- Progress Overview Chart -->
      <div class="bg-white rounded-xl shadow-lg p-6">
        <div class="flex items-center mb-6">
          <div class="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full p-3 mr-4">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-800">Progreso del Presupuesto {{ budgetData?.anio }}</h3>
        </div>
        <div class="h-80">
          <canvas #progressChart></canvas>
        </div>
      </div>

      <!-- Monthly vs Weekly Performance -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Monthly Performance -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <div class="flex items-center mb-6">
            <div class="bg-gradient-to-r from-purple-500 to-pink-500 rounded-full p-3 mr-4">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-800">Rendimiento Mensual</h3>
          </div>
          <div class="h-64">
            <canvas #monthlyChart></canvas>
          </div>
        </div>

        <!-- Weekly Performance -->
        <div class="bg-white rounded-xl shadow-lg p-6">
          <div class="flex items-center mb-6">
            <div class="bg-gradient-to-r from-orange-500 to-red-500 rounded-full p-3 mr-4">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3 class="text-lg font-bold text-gray-800">Rendimiento Semanal</h3>
          </div>
          <div class="h-64">
            <canvas #weeklyChart></canvas>
          </div>
        </div>
      </div>


    </div>
  `
})
export class BudgetChartsComponent implements OnInit, OnChanges {
  @Input() budgetData: BudgetData | null = null;

  @ViewChild('progressChart', { static: true }) progressChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthlyChart', { static: true }) monthlyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('weeklyChart', { static: true }) weeklyChartRef!: ElementRef<HTMLCanvasElement>;

  private progressChart: Chart | null = null;
  private monthlyChart: Chart | null = null;
  private weeklyChart: Chart | null = null;

  ngOnInit(): void {
    this.initializeCharts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['budgetData'] || changes['courseData']) {
      this.updateCharts();
    }
  }

  private initializeCharts(): void {
    setTimeout(() => {
      this.createProgressChart();
      this.createMonthlyChart();
      this.createWeeklyChart();
    }, 100);
  }

  private updateCharts(): void {
    this.destroyCharts();
    this.initializeCharts();
  }

  private destroyCharts(): void {
    if (this.progressChart) {
      this.progressChart.destroy();
      this.progressChart = null;
    }
    if (this.monthlyChart) {
      this.monthlyChart.destroy();
      this.monthlyChart = null;
    }
    if (this.weeklyChart) {
      this.weeklyChart.destroy();
      this.weeklyChart = null;
    }
  }

  private createProgressChart(): void {
    if (!this.budgetData || !this.progressChartRef) return;

    // Destroy existing chart if it exists
    if (this.progressChart) {
      this.progressChart.destroy();
      this.progressChart = null;
    }

    const ctx = this.progressChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.progressChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Recaudado', 'Faltante'],
        datasets: [{
          data: [this.budgetData.recaudado, this.budgetData.faltante],
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            'rgba(34, 197, 94, 1)',
            'rgba(239, 68, 68, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              font: {
                size: 14
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                const total = this.budgetData!.monto_meta;
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: $${value.toLocaleString()} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  private createMonthlyChart(): void {
    if (!this.budgetData || !this.monthlyChartRef) return;

    // Destroy existing chart if it exists
    if (this.monthlyChart) {
      this.monthlyChart.destroy();
      this.monthlyChart = null;
    }

    const ctx = this.monthlyChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Meta Mensual', 'Recaudo del Mes'],
        datasets: [{
          label: 'Monto ($)',
          data: [this.budgetData.meta_mensual, this.budgetData.recaudo_mes],
          backgroundColor: [
            'rgba(147, 51, 234, 0.8)',
            'rgba(34, 197, 94, 0.8)'
          ],
          borderColor: [
            'rgba(147, 51, 234, 1)',
            'rgba(34, 197, 94, 1)'
          ],
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.label}: $${context.parsed.y.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + Number(value).toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  private createWeeklyChart(): void {
    if (!this.budgetData || !this.weeklyChartRef) return;

    // Destroy existing chart if it exists
    if (this.weeklyChart) {
      this.weeklyChart.destroy();
      this.weeklyChart = null;
    }

    const ctx = this.weeklyChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Meta Semanal', 'Recaudo de la Semana'],
        datasets: [{
          label: 'Monto ($)',
          data: [this.budgetData.meta_semanal, this.budgetData.recaudo_semana],
          backgroundColor: [
            'rgba(249, 115, 22, 0.8)',
            'rgba(34, 197, 94, 0.8)'
          ],
          borderColor: [
            'rgba(249, 115, 22, 1)',
            'rgba(34, 197, 94, 1)'
          ],
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.label}: $${context.parsed.y.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + Number(value).toLocaleString();
              }
            }
          }
        }
      }
    });
  }



  ngOnDestroy(): void {
    this.destroyCharts();
  }
}