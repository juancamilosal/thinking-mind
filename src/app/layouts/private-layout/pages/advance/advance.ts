import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StudentService } from '../../../../core/services/student.service';
import { StorageServices } from '../../../../core/services/storage.services';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-advance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './advance.html',
  styleUrl: './advance.css'
})
export class Advance implements OnInit {

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

  loadStats(): void {
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
            this.cd.detectChanges();
          }
        },
        error: (error) => {
          console.error('Error loading AYO stats', error);
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/private/dashboard']);
  }
}
