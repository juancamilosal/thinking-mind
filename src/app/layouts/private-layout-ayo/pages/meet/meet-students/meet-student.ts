import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { StorageServices } from '../../../../../core/services/storage.services';
import { ProgramaAyo } from '../../../../../core/models/Course';
import { environment } from '../../../../../../environments/environment';
import { NotificationService } from '../../../../../core/services/notification.service';
import { TeacherEvaluationComponent } from './teacher-evaluation/teacher-evaluation.component';

declare var gapi: any;
declare var google: any;

@Component({
  selector: 'app-meet-student',
  standalone: true,
  imports: [CommonModule, HttpClientModule, TeacherEvaluationComponent],
  templateUrl: './meet-student.html',
  styleUrl: './meet-student.css'
})
export class MeetStudent implements OnInit {

  assetsUrl = environment.assets;
  programas: ProgramaAyo[] = [];
  isLoading = false;
  accountsReceivable: any[] = [];
  
  // Study Plan Modal Properties
  showStudyPlanModal = false;
  selectedStudyPlan: any[] = [];
  selectedProgramForStudyPlan: ProgramaAyo | null = null;
  
  // Maps for efficient state management
  parsedStudyPlans = new Map<string, any[]>();
  selectedPlanItems = new Map<string, any>();

  // Evaluation Modal Properties
  showEvaluationModal = false;
  selectedEvaluationTeacherName = '';
  selectedEvaluationClassName = '';
  selectedReunion: any = null;
  selectedProgramId: string | null = null;

  // Rules Modal Properties
  showRulesModal = false;
  pendingReunion: any = null;
  programRules: string[] = [
    'Mantener la cámara encendida durante toda la sesión.',
    'Estar en un lugar tranquilo y sin ruido.',
    'Ser puntual y respetar el horario de la clase.',
    'Participar activamente en las actividades.',
    'Respetar a los compañeros y al docente.'
  ];

  constructor(
    private programaAyoService: ProgramaAyoService,
    private router: Router,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadAccountsReceivable();
  }

  goBack(): void {
    this.router.navigate(['/private-ayo/dashboard']);
  }

  loadAccountsReceivable(): void {
    this.isLoading = true;
    const user = StorageServices.getCurrentUser();

    if (user && user.id) {
       this.programaAyoService.getProgramaAyo(undefined, undefined, user.id).subscribe({
         next: (response) => {
           const allPrograms = response.data || [];
           const userPrograms = allPrograms.filter(program => {
             if (program.id_nivel && program.id_nivel.estudiantes_id && Array.isArray(program.id_nivel.estudiantes_id)) {
               const isStudent = program.id_nivel.estudiantes_id.some((student: any) => student.id === user.id);
               return isStudent;
             }
             return false;
           });

          this.accountsReceivable = userPrograms.map(program => {
            // Parse study plan immediately for side panel view
            if (Array.isArray(program.plan_estudio_id)) {
                this.parsedStudyPlans.set(String(program.id), this.parseStudyPlan(program.plan_estudio_id));
            }

            return {
                id: program.id,
                programa_ayo_id: program,
            };
          });

          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  getProgramImage(account: any): string {
    const program = account.programa_ayo_id;
    if (program?.img) {
      const imgId = typeof program.img === 'object' ? program.img.id : program.img;
      return `${this.assetsUrl}/${imgId}`;
    }
    if (program?.id_nivel?.imagen) {
      return `${this.assetsUrl}/${program.id_nivel.imagen}`;
    }
    return 'assets/icons/ayo.png';
  }

  parseStudyPlan(rawPlan: any[]): any[] {
    return rawPlan.map(item => {
      const text = item.plan || '';
      const match = text.match(/^(\d+)[.\)\-]?\s*(.*)$/);
      if (match) {
        return {
          number: parseInt(match[1], 10),
          displayNumber: match[1],
          text: match[2],
          original: item
        };
      } else {
        return {
          number: 999999, // Push non-numbered items to the end
          displayNumber: '',
          text: text,
          original: item
        };
      }
    }).sort((a, b) => a.number - b.number);
  }

  getParsedStudyPlan(programId: string | number): any[] {
    return this.parsedStudyPlans.get(String(programId)) || [];
  }

  togglePlanItemSelection(programId: string | number, item: any): void {
    const id = String(programId);
    if (item.original.realizado) return;

    const currentSelected = this.selectedPlanItems.get(id);
    if (currentSelected === item) {
      this.selectedPlanItems.delete(id);
    } else {
      this.selectedPlanItems.set(id, item);
    }
  }

  isPlanItemSelected(programId: string | number, item: any): boolean {
    return this.selectedPlanItems.get(String(programId)) === item;
  }

  hasSelection(programId: string | number): boolean {
    return !!this.selectedPlanItems.get(String(programId));
  }

  saveStudyPlan(program: ProgramaAyo): void {
    const programId = String(program.id);
    const selectedItem = this.selectedPlanItems.get(programId);

    if (!selectedItem) {
      this.notificationService.showError('Error', 'Debe seleccionar un ítem del plan de estudio para guardar.');
      return;
    }

    // Optimistic update handled in subscription or refresh
    this.programaAyoService.updatePlanEstudio(selectedItem.original.id, { realizado: true }).subscribe({
      next: () => {
        this.notificationService.showSuccess('Éxito', 'Plan de estudio actualizado correctamente.');
        
        // Update local state
        selectedItem.original.realizado = true;
        this.selectedPlanItems.delete(programId);
        
        // Re-parse to update view (or just rely on object reference if binding is deep, but sort might be affected if we change things? No, sort is by number)
        // Actually, since we modified the original item object which is referenced in the parsed array, the view should update automatically if change detection runs.
        // But to be safe and cleaner:
        // The parsed array items contain 'original' which is the raw item. 
      },
      error: (err) => {
        console.error('Error updating study plan', err);
        this.notificationService.showError('Error', 'Error al actualizar el plan de estudio.');
      }
    });
  }

  openStudyPlanModal(programa: ProgramaAyo): void {
    this.selectedProgramForStudyPlan = programa;
    if (Array.isArray(programa.plan_estudio_id)) {
        // Use the pre-parsed plan if available, or parse it
        const existing = this.parsedStudyPlans.get(String(programa.id));
        if (existing) {
            this.selectedStudyPlan = existing;
        } else {
            this.selectedStudyPlan = this.parseStudyPlan(programa.plan_estudio_id);
            this.parsedStudyPlans.set(String(programa.id), this.selectedStudyPlan);
        }
    } else {
      this.selectedStudyPlan = [];
    }
    this.showStudyPlanModal = true;
  }

  closeStudyPlanModal(): void {
    this.showStudyPlanModal = false;
    this.selectedStudyPlan = [];
    this.selectedProgramForStudyPlan = null;
  }

   handleTestAndJoin(event: Event, reunion: any): void {
     event.preventDefault();
     if (reunion.link_reunion) {
         this.pendingReunion = reunion;
         this.showRulesModal = true;
     }
   }

   acceptRulesAndJoin(): void {
     if (this.pendingReunion && this.pendingReunion.link_reunion) {
       (window as any).open(this.pendingReunion.link_reunion, '_blank');
     }
     this.closeRulesModal();
   }

   closeRulesModal(): void {
     this.showRulesModal = false;
     this.pendingReunion = null;
   }

  // Evaluation methods
  openEvaluation(reunion: any, programId: string): void {
    console.log('openEvaluation called with programId:', programId);
    if (!programId) {
      console.error('programId is missing in openEvaluation');
    }
    this.selectedReunion = reunion;
    this.selectedProgramId = programId;
    this.selectedEvaluationTeacherName = reunion.id_docente 
      ? `${reunion.id_docente.first_name} ${reunion.id_docente.last_name}` 
      : 'Docente';
    this.selectedEvaluationClassName = reunion.nombre || 'Clase';
    this.showEvaluationModal = true;
  }

  closeEvaluationModal(): void {
    this.showEvaluationModal = false;
    this.selectedReunion = null;
    this.selectedProgramId = null;
    this.selectedEvaluationTeacherName = '';
    this.selectedEvaluationClassName = '';
  }

  handleEvaluationSubmit(evaluationData: any): void {
    const user = StorageServices.getCurrentUser();
    if (!user) {
      this.notificationService.showError('Error', 'No se pudo identificar al usuario.');
      return;
    }

    if (!this.selectedReunion || !this.selectedReunion.id_docente) {
      this.notificationService.showError('Error', 'No se pudo identificar al docente.');
      return;
    }

    const payloads: any[] = [];
    const date = new Date().toISOString().split('T')[0];
    const observations = evaluationData.observations || '';
    const teacherId = this.selectedReunion.id_docente.id;
    const evaluatorName = `${user.first_name} ${user.last_name}`;
    const programId = this.selectedProgramId;

    if (!programId) {
      this.notificationService.showError('Error', 'No se pudo identificar el programa.');
      return;
    }

    // Iterate over keys
    for (const key in evaluationData) {
      // Skip global observations field and individual observation fields (processed with their rating)
      if (key !== 'observations' && !key.startsWith('obs_') && evaluationData.hasOwnProperty(key)) {
        const observation = evaluationData['obs_' + key] || '';
        
        payloads.push({
          fecha: date,
          observaciones: observation,
          docente_id: { id: teacherId },
          evaluado_por: evaluatorName,
          criterio_evaluacion_id: { id: key },
          programa_ayo_id: { id: programId },
          calificacion: evaluationData[key]
        });
      }
    }

    if (payloads.length === 0) {
      this.notificationService.showWarning('Advertencia', 'No hay calificaciones para enviar.');
      return;
    }

    this.programaAyoService.saveCalificacionDocente(payloads).subscribe({
      next: () => {
        this.notificationService.showSuccess('Éxito', 'Evaluación enviada correctamente');
        this.closeEvaluationModal();
      },
      error: (err) => {
        console.error('Error saving evaluation:', err);
        this.notificationService.showError('Error', 'Hubo un error al enviar la evaluación.');
      }
    });
  }

}
