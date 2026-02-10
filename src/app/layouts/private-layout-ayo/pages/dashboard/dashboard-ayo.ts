import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { StudentService } from '../../../../core/services/student.service';
import { PayrollService } from '../../../../core/services/payroll.service';
import { TeacherDashboardStats } from '../../../../core/models/DashboardModels';
import { Roles } from '../../../../core/const/Roles';
import { StorageServices } from '../../../../core/services/storage.services';

@Component({
  selector: 'app-dashboard-ayo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-ayo.html',
  styleUrl: './dashboard-ayo.css'
})
export class DashboardAyo implements OnInit {
  isLoading = true;
  currentDate = new Date();
  userRole: string = '';
  isAyoStudent: boolean = false;
  isAyoTeacher: boolean = false;

  // AYO Student Stats
  ayoStats: any = {
    creditos: 0,
    nivel: '',
    calificacion: 0,
    resultado_test: '',
    estado_cuenta: '',
    idioma: '',
    subcategoria: '',
    tematica: '',
    reuniones_meet: []
  };

  programRules: string[] = [
    'Mantener la cámara encendida durante toda la sesión.',
    'Estar en un lugar tranquilo y sin ruido.',
    'Ser puntual y respetar el horario de la clase.',
    'Participar activamente en las actividades.',
    'Respetar a los compañeros y al docente.'
  ];

  // AYO Teacher Stats
  teacherStats: TeacherDashboardStats = {
    horas_trabajadas: 0,
    reuniones_meet_id: []
  };

  constructor(
    private dashboardService: DashboardService,
    private studentService: StudentService,
    private payrollService: PayrollService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private sortReuniones(reuniones: any[]): any[] {
    const weekdayOrder = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
    return reuniones.sort((a, b) => {
        const dayA = a.DIA ? a.DIA.toUpperCase() : '';
        const dayB = b.DIA ? b.DIA.toUpperCase() : '';
        return weekdayOrder.indexOf(dayA) - weekdayOrder.indexOf(dayB);
    });
  }

  private loadDashboardData(): void {
    this.isLoading = true;

    const user = StorageServices.getItemObjectFromSessionStorage('current_user');

    if (user) {
      this.userRole = user.role;

      this.isAyoStudent = user.role === Roles.STUDENT;
      this.isAyoTeacher = user.role === Roles.TEACHER;

      if (this.isAyoTeacher) {
        this.loadTeacherData();
        return;
      }

      const isRegularStudent = user.resultado_test !== undefined || user.student_id !== undefined;

      if (this.isAyoStudent || isRegularStudent) {
        this.ayoStats.creditos = user.creditos || 0;
        this.ayoStats.calificacion = user.calificacion || 0;
        this.ayoStats.nivel_idioma = user.nivel_idioma || 'N/A';
        this.ayoStats.resultado_test = user.resultado_test || 'N/A';
        this.studentService.dashboardStudent({ params: { user_id: user.id, role_id: user.role } }).subscribe({
          next: (response) => {
            try {
              const data = response.data || response;
              if (data) {
                this.ayoStats = {
                  creditos: data.creditos ?? 0,
                  nivel: data.nivel || data.nivel_idioma || 'N/A',
                  calificacion: data.calificacion ?? 0,
                  resultado_test: data.resultado_test === 'undefined' ? 'N/A' : (data.resultado_test || 'N/A'),
                  estado_cuenta: data.estado_cuenta || 'N/A',
                  idioma: data.idioma || 'N/A',
                  subcategoria: data.subcategoria || 'N/A',
                  tematica: data.tematica || 'N/A',
                  reuniones_meet: (data.reuniones_meet && Array.isArray(data.reuniones_meet)) ? this.sortReuniones(data.reuniones_meet) : []
                };
              }
            } catch (e) {
              console.error('Error processing dashboard data:', e);
            } finally {
              this.isLoading = false;
              this.cdr.detectChanges();
            }
          },
          error: (error) => {
            console.error('Error loading student dashboard:', error);
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        });

        return;
      }
      
      // If user role is not handled
      this.isLoading = false;
      this.cdr.detectChanges();
    } else {
      // If no user found
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private loadTeacherData(): void {
    const user = StorageServices.getItemObjectFromSessionStorage('current_user');
    const teacherId = user?.id;

    this.dashboardService.dashboardTeacher().subscribe({
      next: (response) => {
        if (response && response.data) {
          // Si es un array, tomamos el primer elemento (el más reciente o relevante)
          if (Array.isArray(response.data) && response.data.length > 0) {
            this.teacherStats = response.data[0];
          }
          // Si es un objeto directo (no array), lo asignamos directamente
          else if (!Array.isArray(response.data) && typeof response.data === 'object' && response.data !== null) {
            this.teacherStats = response.data;
          }
        }

        // Ensure teacherStats is initialized if it's null/undefined
        if (!this.teacherStats) {
            this.teacherStats = {
                horas_trabajadas: 0,
                reuniones_meet_id: []
            };
        }

        // Load payroll hours for current month (only for teachers)
        if (teacherId) {
          this.payrollService.getTeacherPayrollSummary(teacherId).subscribe({
            next: (payrollSummary) => {
              if (this.teacherStats && payrollSummary) {
                  this.teacherStats.horas_trabajadas = payrollSummary.horasTrabajadasMes || 0;
              }
              this.isLoading = false;
              this.cdr.detectChanges();
            },
            error: (error) => {
              console.error('Error loading payroll hours', error);
              this.isLoading = false;
              this.cdr.detectChanges();
            }
          });
        } else {
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error loading teacher dashboard', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
