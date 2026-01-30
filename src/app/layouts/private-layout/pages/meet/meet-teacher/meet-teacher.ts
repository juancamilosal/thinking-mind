import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { StorageServices } from '../../../../../core/services/storage.services';
import { ProgramaAyo } from '../../../../../core/models/Course';
import { MeetingTimerService } from '../../../../../core/services/meeting-timer.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { environment } from '../../../../../../environments/environment';
import { Subscription } from 'rxjs';

declare var gapi: any;
declare var google: any;

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
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './meet-teacher.html',
  styleUrl: './meet-teacher.css'
})
export class TeacherMeetingsComponent implements OnInit, OnDestroy {
  programas: ProgramaAyo[] = [];
  isLoading: boolean = true;
  selectedLanguage: string | null = null;
  assetsUrl: string = environment.assets;
  meetingInfos: any[] = [];

  // Google Calendar Integration
  private CLIENT_ID = '879608095413-95f61hvhukdqfba7app9fhmd5g32qho8.apps.googleusercontent.com';
  private DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  private SCOPES = 'https://www.googleapis.com/auth/calendar.events';
  tokenClient: any;
  gapiInited = false;
  gisInited = false;

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
  private http = inject(HttpClient);

  ngOnInit(): void {
    // Load Google Scripts
    this.loadGoogleScripts();

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

          // Extract meeting info
          this.extractMeetingInfo(this.programas);
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

  async accessMeeting(meeting: any, programa: any): Promise<void> {
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

    // 1. Add students to Calendar Event
    let currentProgramStudents: string[] = [];
    if (programa?.id_nivel?.estudiantes_id && Array.isArray(programa.id_nivel.estudiantes_id)) {
        currentProgramStudents = programa.id_nivel.estudiantes_id
            .map((s: any) => s.email?.trim())
            .filter((email: string) => email && email.length > 0);
    }

    // Also check root level estudiantes_id as fallback or addition if needed, based on previous logic
    if (programa?.estudiantes_id && Array.isArray(programa.estudiantes_id)) {
         const rootStudents = programa.estudiantes_id
            .map((s: any) => s.email?.trim())
            .filter((email: string) => email && email.length > 0);
         currentProgramStudents = [...new Set([...currentProgramStudents, ...rootStudents])];
    }

    if (currentProgramStudents.length > 0 && meeting.id_reunion) {
      try {
        await this.addParticipantsToMeeting(meeting, currentProgramStudents);
      } catch (error) {
        console.error('Error adding participants (non-blocking for meeting access):', error);
        // We continue even if this fails, so the teacher can still enter
      }
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

  extractMeetingInfo(data: any[]): void {
    const meetings: any[] = [];

    if (Array.isArray(data)) {
        data.forEach(program => {
            if (program.id_reuniones_meet && Array.isArray(program.id_reuniones_meet)) {
                program.id_reuniones_meet.forEach((reunion: any) => {
                    if (reunion.id_reunion) {
                        meetings.push({
                            id_reunion: reunion.id_reunion,
                            link_reunion: reunion.link_reunion || ''
                        });
                    }
                });
            }
        });
    }

    this.meetingInfos = meetings;
    console.log('Información de reuniones extraída:', this.meetingInfos);
}

  // Google Calendar Integration Helpers
  loadGoogleScripts() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => this.gapiLoaded();
    document.body.appendChild(script);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => this.gisLoaded();
    document.body.appendChild(gisScript);
  }

  gapiLoaded() {
    gapi.load('client', async () => {
      await gapi.client.init({
        discoveryDocs: [this.DISCOVERY_DOC],
      });
      this.gapiInited = true;
    });
  }

  gisLoaded() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      callback: '',
    });
    this.gisInited = true;
  }

  ensureCalendarToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          console.error('Token Error:', resp);
          reject(resp);
        } else {
          // Update gapi client with new token
          if (gapi.client) {
            gapi.client.setToken(resp);
          }
          console.log('Token Received (Safe):', resp.access_token ? 'YES (Length: ' + resp.access_token.length + ')' : 'NO');
          resolve(resp.access_token);
        }
      };

      // Always request a fresh token to avoid 401 from stale/mismatched credentials
      // Using 'consent' forces the popup to ensure we get a valid token for THIS Client ID
      console.log('Requesting fresh access token (prompt: consent)...');
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  async addParticipantsToMeeting(reunion: any, emailsToAdd: string[]): Promise<void> {
    console.log('--> addParticipantsToMeeting START', reunion.id_reunion, emailsToAdd);

    if (!reunion.id_reunion) {
        this.notificationService.showError('Error', 'Reunión sin ID');
        return;
    }

    try {
        console.log('1. Getting Token...');
        const token = await this.ensureCalendarToken();
        console.log('Token received (len):', token ? token.length : 0);

        if (!token) {
            throw new Error('No se obtuvo un token válido.');
        }

        // Explicitly construct headers as requested
        let headers = new HttpHeaders();
        headers = headers.set('Authorization', `Bearer ${token}`);
        headers = headers.set('Content-Type', 'application/json');

        const baseUrl = `https://content.googleapis.com/calendar/v3/calendars/primary/events/${reunion.id_reunion}?alt=json`;

        // 1. Get existing event
        console.log('2. GET event details...');
        const event: any = await lastValueFrom(this.http.get(baseUrl, { headers }));
        console.log('Event details received:', event);

        const existingAttendees = event.attendees || [];

        // 2. Simple merge: existing + new
        const newAttendees = emailsToAdd
            .filter(email => !existingAttendees.some((a: any) => a.email === email))
            .map(email => ({ email }));

        if (newAttendees.length === 0) {
            console.log('No hay nuevos participantes para agregar.');
            return;
        }
        const finalAttendees = [...existingAttendees, ...newAttendees];
        const patchUrl = `${baseUrl}&sendUpdates=all`;
        await lastValueFrom(this.http.patch(patchUrl, {
            attendees: finalAttendees
        }, { headers }));

    } catch (error: any) {
        console.error('--> Error in addParticipantsToMeeting:', error);
        const msg = error?.error?.error?.message || error.message || 'Error desconocido';
        this.notificationService.showError('Error API Google', msg);
        throw error; // Re-throw to handle in calling method if needed
    }
  }
}
