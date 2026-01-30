import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { StorageServices } from '../../../../../core/services/storage.services';
import { ProgramaAyo } from '../../../../../core/models/Course';
import { MeetingTimerService } from '../../../../../core/services/meeting-timer.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { environment } from '../../../../../../environments/environment';
import { Subscription } from 'rxjs';

interface StudentEvaluation {
  id: string;
  name: string;
  attended: boolean;
  rating: number;
  comment: string;
}

@Component({
  selector: 'app-meet-teacher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meet-teacher.html',
  styleUrl: './meet-teacher.css'
})
export class TeacherMeetingsComponent implements OnInit, OnDestroy {
  programas: ProgramaAyo[] = [];
  isLoading: boolean = true;
  selectedLanguage: string | null = null;
  assetsUrl: string = environment.assets;

  // Timer related
  currentSession: any = null;
  elapsedTime: string = '00:00';
  showNotificationBanner: boolean = false;
  private timerSubscription: Subscription | null = null;

  // Evaluation modal
  showEvaluationModal: boolean = false;
  students: StudentEvaluation[] = [];
  maxCommentLength: number = 250;

  // Inject services
  private programaAyoService = inject(ProgramaAyoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public timerService = inject(MeetingTimerService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);

  ngOnInit(): void {
    // Get language from query params
    this.route.queryParams.subscribe(params => {
      if (params['idioma']) {
        this.selectedLanguage = params['idioma'].toUpperCase();
      }
      this.loadTeacherMeetings();
    });

    // Subscribe to timer updates
    this.timerSubscription = this.timerService.session$.subscribe(session => {
      this.currentSession = session;
      if (session && session.isActive) {
        this.elapsedTime = this.timerService.getFormattedElapsedTime();

        // Show notification banner if 45 minutes reached
        if (session.elapsedMinutes >= 45 && !this.showNotificationBanner) {
          this.showNotificationBanner = true;
        }
      } else {
        this.elapsedTime = '00:00';
        this.showNotificationBanner = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }

  loadTeacherMeetings(): void {
    this.isLoading = true;

    // Get authenticated teacher ID
    const currentUser = StorageServices.getCurrentUser();
    const teacherId = currentUser?.id;

    if (!teacherId) {
      console.error('No teacher ID found in session');
      this.isLoading = false;
      return;
    }

    // Fetch programs with expanded relations, filtered by teacher ID
    this.programaAyoService.getProgramaAyoDocente(teacherId, this.selectedLanguage || undefined).subscribe({
      next: (response) => {
        if (response.data) {
          // Filter programs that have meetings (service already filters by teacher)
          this.programas = response.data
            .filter(p => p.id_reuniones_meet && p.id_reuniones_meet.length > 0);

          // Auto-detect language from programs if not already set
          if (!this.selectedLanguage && this.programas.length > 0) {
            this.selectedLanguage = this.programas[0].idioma?.toUpperCase() || null;
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading teacher meetings:', error);
        this.isLoading = false;
      }
    });
  }

  getMeetingStatus(meeting: any): 'upcoming' | 'in-progress' | 'completed' {
    const now = new Date();
    const start = new Date(meeting.fecha_inicio);
    const end = new Date(meeting.fecha_finalizacion);

    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'in-progress';
    return 'completed';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in-progress':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'upcoming':
        return 'Próxima';
      case 'in-progress':
        return 'En Curso';
      case 'completed':
        return 'Finalizada';
      default:
        return '';
    }
  }

  accessMeeting(meeting: any): void {
    const status = this.getMeetingStatus(meeting);

    // Check if there's already an active session
    const existingSession = this.timerService.getSession();
    if (existingSession && existingSession.meetingId !== meeting.id) {
      this.notificationService.showWarning(
        'Reunión Activa',
        'Ya tienes una reunión activa. Por favor finaliza la sesión actual antes de iniciar otra.'
      );
      return;
    }

    // Only allow access to upcoming or in-progress meetings
    if (status === 'completed') {
      this.notificationService.showInfo(
        'Reunión Finalizada',
        'Esta reunión ya ha finalizado.'
      );
      return;
    }

    // Start timer session
    this.timerService.startSession(meeting.id);

    // Open meeting in new tab
    if (meeting.link_reunion) {
      window.open(meeting.link_reunion, '_blank');
    }
  }

  endSession(): void {
    // Show evaluation modal instead of directly ending
    this.initializeStudentEvaluations();
    this.showEvaluationModal = true;
  }

  initializeStudentEvaluations(): void {
    // Find the program that contains the current meeting
    const currentProgram = this.programas.find(p =>
      p.id_reuniones_meet?.some(m => m.id === this.currentSession?.meetingId)
    );

    if (currentProgram && currentProgram.id_nivel?.estudiantes_id) {
      // Map students from id_nivel to evaluation objects
      this.students = currentProgram.id_nivel.estudiantes_id.map((student: any) => ({
        id: student.id || student.directus_users_id || '',
        name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
        attended: true,
        rating: 0,
        comment: ''
      }));
    } else {
      // Fallback to empty array if no students found
      this.students = [];
      console.warn('No students found for current meeting');
    }
  }

  setRating(student: StudentEvaluation, rating: number): void {
    student.rating = rating;
  }

  getRatingArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  submitEvaluations(): void {
    // Validate that all students who attended have ratings
    const attendedStudents = this.students.filter(s => s.attended);
    const allRated = attendedStudents.every(s => s.rating > 0);

    if (attendedStudents.length > 0 && !allRated) {
      this.notificationService.showWarning(
        'Calificaciones Incompletas',
        'Por favor califica a todos los estudiantes que asistieron.'
      );
      return;
    }

    // TODO: Send evaluations to backend
    console.log('Evaluaciones:', this.students);

    // Close modal and end session
    this.showEvaluationModal = false;
    this.timerService.endSession();
    this.showNotificationBanner = false;

    // Show success notification
    this.notificationService.showSuccess(
      'Evaluación Guardada',
      'Las evaluaciones han sido guardadas exitosamente.',
      3000
    );
  }

  cancelEvaluation(): void {
    this.confirmationService.showConfirmation(
      {
        title: 'Cancelar Evaluación',
        message: '¿Estás seguro de que deseas cancelar? Se perderán las evaluaciones.',
        confirmText: 'Sí, cancelar',
        cancelText: 'No, continuar',
        type: 'warning'
      },
      () => {
        this.showEvaluationModal = false;
        this.students = [];
      }
    );
  }

  dismissNotification(): void {
    this.showNotificationBanner = false;
  }

  goBack(): void {
    this.router.navigate(['/private/teacher'], {
      queryParams: { idioma: this.selectedLanguage }
    });
  }

  hasActiveSession(meetingId: string): boolean {
    return this.timerService.hasActiveSession(meetingId);
  }
}
