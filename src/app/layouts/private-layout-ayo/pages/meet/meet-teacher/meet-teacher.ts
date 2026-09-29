import { Component, OnInit, OnDestroy, inject, NgZone } from '@angular/core';
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
import { PayrollService } from '../../../../../core/services/payroll.service';
import { TeacherPayroll } from '../../../../../core/models/Payroll';
import { environment } from '../../../../../../environments/environment';
import { Subscription, forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AttendanceService } from '../../../../../core/services/attendance.service';
import { UserService } from '../../../../../core/services/user.service';
import { AccountReceivableService } from '../../../../../core/services/account-receivable.service';
import { StudentService } from '../../../../../core/services/student.service';
import { CertificacionService } from '../../../../../core/services/certificacion.service';
import { Attendance } from '../../../../../core/models/Attendance';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ReunionGeneral } from '../../../../../core/models/Meeting';
import { ReunionGeneralService } from '../../../../../core/services/reunion-general.service';

declare var gapi: any;
declare var google: any;

interface StudentEvaluation {
  id: string;
  name: string;
  attended: boolean;
  rating: number;
  comment: string;
  currentRating: number;
  currentCredits: number;
  tipo_documento?: string;
  numero_documento?: string;
  email_acudiente?: string;
  asistencia_id?: any[];
  selectedCriteriaId?: string;
}

interface CriterioEvaluacionEstudiante {
  id: string;
  nombre: string;
  calificacion: number;
  criterio: string;
}

@Component({
  selector: 'app-meet-teacher',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, TranslateModule],
  templateUrl: './meet-teacher.html',
  styleUrl: './meet-teacher.css'
})
export class TeacherMeetingsComponent implements OnInit, OnDestroy {
  programas: ProgramaAyo[] = [];
  isLoading: boolean = true;
  isLoadingGeneralPrograms: boolean = false;
  selectedLanguage: string | null = null;
  assetsUrl: string = environment.assets;
  generalPrograms: ReunionGeneral[] = [];

  // Study Plan Modal Properties
  showStudyPlanModal = false;
  selectedStudyPlan: any[] = [];
  selectedProgramForStudyPlan: ProgramaAyo | null = null;


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
  private autoClosingSession: boolean = false;
  private lastAutoCloseCheck: number = 0;

  // Evaluation modal
  showEvaluationModal: boolean = false;
  // Indica que la calificación se está haciendo fuera de horario (aplica penalización en nómina)
  isLateGrading: boolean = false;
  readonly LATE_GRADING_PENALTY: number = 5000;
  // Reunión que se está calificando fuera de horario (cuando no hay sesión activa)
  private lateGradingMeetingId: string | null = null;
  // Fecha de la clase que se está calificando fuera de horario (formato yyyy-MM-dd)
  lateGradingDate: string = '';
  todayDate: string = new Date().toISOString().split('T')[0];

  // Modo de prueba: permite practicar la calificación sin consumir servicios
  isTestMode: boolean = false;
  private readonly TEST_PROGRAM_ID = 'test-program';
  students: StudentEvaluation[] = [];
  maxCommentLength: number = 250;
  currentProgramId: string | null = null;
  currentLevelId: string | null = null;
  evaluationStudyPlan: any[] = [];
  selectedPlanItemForEvaluation: any = null;
  evaluationCriteria: CriterioEvaluacionEstudiante[] = [];

  // Students List Modal Properties
  showStudentsModal = false;
  selectedStudents: any[] = [];
  selectedProgramForStudents: ProgramaAyo | null = null;
  showRatingHistoryModal = false;
  isLoadingRatingHistory = false;
  selectedStudentForHistory: any | null = null;
  ratingHistory: Attendance[] = [];
  ratingHistoryStats: { total: number; attended: number; absent: number; attendancePercent: number; averageRating: number } | null = null;

  // Inject services
  private programaAyoService = inject(ProgramaAyoService);
  private attendanceService = inject(AttendanceService);
  private userService = inject(UserService);
  private payrollService = inject(PayrollService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public timerService = inject(MeetingTimerService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private accountReceivableService = inject(AccountReceivableService);
  private studentService = inject(StudentService);
  private certificacionService = inject(CertificacionService);
  private reunionGeneralService = inject(ReunionGeneralService);
  private translate = inject(TranslateService);
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);

  ngOnInit(): void {
    this.loadGoogleScripts();
    this.loadEvaluationCriteria();

    this.route.queryParams.subscribe(params => {
      if (params['idioma']) {
        this.selectedLanguage = params['idioma'].toUpperCase();
      }
      this.loadTeacherMeetings();
      this.loadGeneralPrograms();
    });

    this.timerSubscription = this.timerService.session$.subscribe(session => {
      this.currentSession = session;
      if (session && session.isActive) {
        // PRUEBAS: auto-cierre por horario DESACTIVADO temporalmente. Descomentar para reactivar.
        // La comprobación de auto-cierre se ejecuta como máximo una vez por minuto.
        // Si la hora actual ya pasó los 10 min posteriores a la fecha_finalizacion,
        // cerrar automáticamente la sesión y marcar califico_hoy en el usuario.
        // const nowMs = Date.now();
        // if (nowMs - this.lastAutoCloseCheck >= 60 * 1000) {
        //   this.lastAutoCloseCheck = nowMs;
        //   if (this.hasSessionEndTimePassed(session) && !this.autoClosingSession) {
        //     this.autoClosingSession = true;
        //     this.handleGradingDeadlineExpired();
        //     return;
        //   }
        // }
        this.elapsedTime = this.timerService.getFormattedElapsedTime();
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

  openStudentsModal(programa: ProgramaAyo): void {
    this.selectedProgramForStudents = programa;
    if (Array.isArray((programa as any).estudiantes_id)) {
      this.selectedStudents = (programa as any).estudiantes_id;
    } else if (programa.id_nivel && Array.isArray(programa.id_nivel.estudiantes_id)) {
      this.selectedStudents = programa.id_nivel.estudiantes_id;
    } else {
      this.selectedStudents = [];
    }
    this.showStudentsModal = true;
  }

  closeStudentsModal(): void {
    this.showStudentsModal = false;
    this.selectedStudents = [];
    this.selectedProgramForStudents = null;
    this.closeRatingHistoryModal();
  }

  openRatingHistoryModal(student: any): void {
    if (!student || !student.id) return;

    this.selectedStudentForHistory = student;
    this.showRatingHistoryModal = true;
    this.isLoadingRatingHistory = true;
    this.ratingHistory = [];
    this.ratingHistoryStats = null;

    const filter: any = { estudiante_id: student.id };
    if (this.selectedProgramForStudents?.id) {
      filter.programa_ayo_id = this.selectedProgramForStudents.id;
    }

    const fields = '*,criterio_evaluacion_estudiante_id.*,programa_ayo_id.*,programa_ayo_id.id_nivel.*';

    this.attendanceService.getAttendances(1, 250, undefined, filter, '-fecha', fields).subscribe({
      next: (response) => {
        this.ratingHistory = (response?.data || []) as Attendance[];
        const total = this.ratingHistory.length;
        const attended = this.ratingHistory.filter(r => r?.asiste === true).length;
        const absent = total - attended;
        const attendancePercent = total > 0 ? Math.round((attended / total) * 100) : 0;
        const attendedWithRating = this.ratingHistory
          .filter(r => r?.asiste === true)
          .map(r => Number((r as any)?.calificacion))
          .filter(v => Number.isFinite(v));
        const averageRating = attendedWithRating.length > 0
          ? Math.round((attendedWithRating.reduce((sum, v) => sum + v, 0) / attendedWithRating.length) * 10) / 10
          : 0;

        this.ratingHistoryStats = { total, attended, absent, attendancePercent, averageRating };
        this.isLoadingRatingHistory = false;
      },
      error: () => {
        this.isLoadingRatingHistory = false;
        this.ratingHistory = [];
        this.ratingHistoryStats = null;
        this.notificationService.showError(this.translate.instant('teacherMeetings.notifications.error'), this.translate.instant('teacherMeetings.notifications.ratingHistoryError'));
      }
    });
  }

  closeRatingHistoryModal(): void {
    this.showRatingHistoryModal = false;
    this.isLoadingRatingHistory = false;
    this.selectedStudentForHistory = null;
    this.ratingHistory = [];
    this.ratingHistoryStats = null;
  }

  hasStudents(programa: ProgramaAyo): boolean {
    // En modo de prueba siempre hay estudiantes (se generan ficticios)
    if (this.isTestMode) return true;

    const studentsFromLevel = programa.id_nivel?.estudiantes_id;
    const studentsFromRoot = (programa as any).estudiantes_id;

    const hasLevelStudents = Array.isArray(studentsFromLevel) && studentsFromLevel.length > 0;
    const hasRootStudents = Array.isArray(studentsFromRoot) && studentsFromRoot.length > 0;

    return hasLevelStudents || hasRootStudents;
  }

  getStudentAttendance(student: any): number {
    if (!student.asistencia_id || !Array.isArray(student.asistencia_id) || !this.selectedProgramForStudents) {
      return 0;
    }

    const programId = this.selectedProgramForStudents.id;
    const relevantRecords = student.asistencia_id.filter((record: any) =>
      record && typeof record === 'object' && record.programa_ayo_id === programId
    );

    if (relevantRecords.length === 0) return 0;

    const attendedCount = relevantRecords.filter((record: any) => record.asiste === true).length;

    return Math.round((attendedCount / relevantRecords.length) * 100);
  }

  getStudentProgramRating(student: any): number {
    if (!student.asistencia_id || !Array.isArray(student.asistencia_id) || !this.selectedProgramForStudents) {
      return 0;
    }
    const programId = this.selectedProgramForStudents.id;
    const relevantRecords = student.asistencia_id.filter((record: any) => {
      if (!record || typeof record !== 'object') return false;
      const rid = record.programa_ayo_id;
      const recProgramId = typeof rid === 'object' ? (rid && rid.id ? rid.id : rid) : rid;
      return recProgramId === programId;
    });
    if (relevantRecords.length === 0) return 0;
    return relevantRecords.reduce((sum: number, r: any) => {
      const val = Number(r.calificacion);
      return Number.isFinite(val) ? sum + val : sum;
    }, 0);
  }
  calculateProjectedAttendance(student: any): number {
     if (!student.accountInfo && !student.asistencia_id) {
        return student.attended ? 100 : 0;
     }

     const records = student.asistencia_id || [];
     const programId = this.currentProgramId;

     const relevantRecords = records.filter((record: any) =>
        record && typeof record === 'object' && (typeof record.programa_ayo_id === 'object' ? record.programa_ayo_id?.id : record.programa_ayo_id) === programId
     );

     const pastTotal = relevantRecords.length;
     const pastAttended = relevantRecords.filter((record: any) => record.asiste === true).length;

     const currentAttended = student.attended ? 1 : 0;

     const finalTotal = pastTotal + 1;
     const finalAttended = pastAttended + currentAttended;

     return Math.round((finalAttended / finalTotal) * 100);
  }

  loadEvaluationCriteria(): void {
    this.programaAyoService.getCriteriosEvaluacionEstudiante().subscribe({
      next: (response) => {
        if (response.data) {
          this.evaluationCriteria = response.data;
        }
      },
      error: (error) => {
        console.error('Error loading evaluation criteria:', error);
      }
    });
  }

  loadTeacherMeetings(): void {
    this.isLoading = true;
    const currentUser = StorageServices.getCurrentUser();
    const teacherId = currentUser?.id;

    if (!teacherId) {
      this.isLoading = false;
      return;
    }

    this.programaAyoService.getProgramaAyoDocente(teacherId, this.selectedLanguage || undefined).subscribe({
      next: (response) => {
        if (response.data) {
          const programas = response.data as any[];

          // Filtrar programas y reuniones para que solo queden las del docente actual
          const filtered = programas
            .map(programa => {
              const reuniones = Array.isArray(programa.id_reuniones_meet)
                ? programa.id_reuniones_meet.filter((meet: any) => {
                    if (!meet || !meet.id_docente) return false;
                    const docente = meet.id_docente;
                    const docenteId = typeof docente === 'object' ? docente.id : docente;
                    return docenteId === teacherId;
                  })
                : [];

              return {
                ...programa,
                id_reuniones_meet: reuniones
              };
            })
            .filter(programa => Array.isArray(programa.id_reuniones_meet) && programa.id_reuniones_meet.length > 0);

          this.programas = filtered;

          if (!this.selectedLanguage && this.programas.length > 0) {
            this.selectedLanguage = this.programas[0].idioma?.toUpperCase() || null;
          }
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadGeneralPrograms(): void {
    const currentUser = StorageServices.getCurrentUser();
    const teacherId = currentUser?.id;

    if (!teacherId) {
      this.generalPrograms = [];
      this.isLoadingGeneralPrograms = false;
      return;
    }

    this.isLoadingGeneralPrograms = true;
    const params: any = {
      fields: '*,id_reuniones_meet.*,id_reuniones_meet.id_docente.*'
    };

    this.reunionGeneralService.list(params).subscribe({
      next: (response) => {
        const data = response?.data || [];
        const programs = Array.isArray(data) ? data : [];

        const filtered = programs
          .map((program) => {
            const meetings = Array.isArray(program.id_reuniones_meet)
              ? program.id_reuniones_meet.filter((meet: any) => {
                if (!meet || !meet.id_docente) return false;
                const docente = meet.id_docente;
                const docenteId = typeof docente === 'object' ? docente.id : docente;
                return docenteId === teacherId;
              })
              : [];

            return {
              ...program,
              id_reuniones_meet: meetings
            };
          })
          .filter((program) => Array.isArray(program.id_reuniones_meet) && program.id_reuniones_meet.length > 0);

        this.generalPrograms = filtered;
        this.isLoadingGeneralPrograms = false;
      },
      error: () => {
        this.generalPrograms = [];
        this.isLoadingGeneralPrograms = false;
      }
    });
  }

  getGeneralProgramImage(program: ReunionGeneral): string {
    if (program.img) {
      return `${this.assetsUrl}/${program.img}`;
    }
    return 'assets/icons/grupo.png';
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
        return this.translate.instant('teacherMeetings.statusUpcoming');
      case 'in-progress':
        return this.translate.instant('teacherMeetings.statusInProgress');
      case 'completed':
        return this.translate.instant('teacherMeetings.statusCompleted');
      default:
        return '';
    }
  }

  async accessMeeting(meeting: any, programa: any): Promise<void> {
    // PRUEBAS: bloqueo por califico_hoy DESACTIVADO temporalmente. Descomentar para reactivar.
    // Si el docente ya calificó hoy, no permitir acceder a más reuniones
    // if (this.isGradingClosedForToday()) {
    //   this.notificationService.showWarning(
    //     'Calificaciones cerradas',
    //     'Calificaciones cerradas por el día de hoy.'
    //   );
    //   return;
    // }

    const status = this.getMeetingStatus(meeting);

    // Check if meeting is within allowed access window
    if (!this.canAccessMeeting(meeting)) {
      const start = new Date(meeting.fecha_inicio);
      const minutesUntilStart = Math.ceil((start.getTime() - Date.now()) / 60000);

      if (minutesUntilStart > 0) {
        this.notificationService.showWarning(
          this.translate.instant('teacherMeetings.notifications.meetingUnavailableTitle'),
          this.translate.instant('teacherMeetings.notifications.meetingUnavailableBody', { minutes: minutesUntilStart })
        );
        return;
      } else {
        this.notificationService.showInfo(
          this.translate.instant('teacherMeetings.notifications.meetingEndedTitle'),
          this.translate.instant('teacherMeetings.notifications.meetingEndedBody')
        );
        return;
      }
    }

    // Check if there's already an active session
    const existingSession = this.timerService.getSession();
    if (existingSession && existingSession.meetingId !== meeting.id) {
      this.notificationService.showWarning(
        this.translate.instant('teacherMeetings.notifications.activeMeetingTitle'),
        this.translate.instant('teacherMeetings.notifications.activeMeetingBody')
      );
      return;
    }

    if (!this.hasStudents(programa)) {
      this.notificationService.showWarning(
        this.translate.instant('teacherMeetings.notifications.notice'),
        this.translate.instant('teacherMeetings.notifications.noStudentsToStart')
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

    // Also check root level estudiantes_id as fallback or addition if needed
    if (programa?.estudiantes_id && Array.isArray(programa.estudiantes_id)) {
         const rootStudents = programa.estudiantes_id
            .map((s: any) => s.email?.trim())
            .filter((email: string) => email && email.length > 0);
         currentProgramStudents = [...new Set([...currentProgramStudents, ...rootStudents])];
    }

    // En modo de prueba no se consume la API de Google Calendar
    if (!this.isTestMode && currentProgramStudents.length > 0 && meeting.id_reunion) {
      try {
        await this.addParticipantsToMeeting(meeting, currentProgramStudents);
      } catch (error) {
        console.warn('Could not add participants to meeting:', error);
      }
    }

    // Start timer session and open meeting in Angular Zone
    this.ngZone.run(() => {
      const scheduledStart = new Date(meeting.fecha_inicio);
      const scheduledEnd = new Date(meeting.fecha_finalizacion);
      this.timerService.startSession(meeting.id, scheduledStart, scheduledEnd, 'program', this.isTestMode);

      // Open meeting in new tab (en modo de prueba no se abre la reunión real)
      if (!this.isTestMode && meeting.link_reunion) {
        window.open(meeting.link_reunion, '_blank');
      }
    });
  }

  accessGeneralMeeting(meeting: any): void {
    // PRUEBAS: bloqueo por califico_hoy DESACTIVADO temporalmente. Descomentar para reactivar.
    // Si el docente ya calificó hoy, no permitir acceder a más reuniones
    // if (this.isGradingClosedForToday()) {
    //   this.notificationService.showWarning(
    //     'Calificaciones cerradas',
    //     'Calificaciones cerradas por el día de hoy.'
    //   );
    //   return;
    // }

    // Check if meeting is within allowed access window
    if (!this.canAccessMeeting(meeting)) {
      const start = new Date(meeting.fecha_inicio);
      const minutesUntilStart = Math.ceil((start.getTime() - Date.now()) / 60000);

      if (minutesUntilStart > 0) {
        this.notificationService.showWarning(
          this.translate.instant('teacherMeetings.notifications.meetingUnavailableTitle'),
          this.translate.instant('teacherMeetings.notifications.meetingUnavailableBody', { minutes: minutesUntilStart })
        );
        return;
      } else {
        this.notificationService.showInfo(
          this.translate.instant('teacherMeetings.notifications.meetingEndedTitle'),
          this.translate.instant('teacherMeetings.notifications.meetingEndedBody')
        );
        return;
      }
    }

    const existingSession = this.timerService.getSession();
    if (existingSession && existingSession.meetingId !== meeting.id) {
      this.notificationService.showWarning(
        this.translate.instant('teacherMeetings.notifications.activeMeetingTitle'),
        this.translate.instant('teacherMeetings.notifications.activeMeetingBody')
      );
      return;
    }

    this.ngZone.run(() => {
      const scheduledStart = new Date(meeting.fecha_inicio);
      const scheduledEnd = new Date(meeting.fecha_finalizacion);
      this.timerService.startSession(meeting.id, scheduledStart, scheduledEnd, 'general', this.isTestMode);

      // En modo de prueba no se abre la reunión real
      if (!this.isTestMode && meeting.link_reunion) {
        window.open(meeting.link_reunion, '_blank');
      }
    });
  }

  endSession(): void {
    const session = this.timerService.getSession();
    if (!session || !session.isActive) return;

    if (session.source === 'general') {
      this.confirmationService.showConfirmation(
        {
          title: this.translate.instant('teacherMeetings.notifications.endSessionTitle'),
          message: this.translate.instant('teacherMeetings.notifications.endSessionMessage'),
          confirmText: this.translate.instant('teacherMeetings.notifications.endSessionConfirm'),
          cancelText: this.translate.instant('teacherMeetings.notifications.endSessionCancel'),
          type: 'warning'
        },
        () => {
          this.createPayrollRecordForGeneralMeeting();
        }
      );
      return;
    }

    this.isLateGrading = false;
    this.initializeStudentEvaluations();

    if (this.students.length === 0) {
      this.notifyNoStudentsToGrade();
      return;
    }

    this.showEvaluationModal = true;
  }

  /**
   * Cierra la reunión y devuelve todo a su estado normal sin consumir ningún servicio
   * (ni nómina, ni asistencias, ni califico_hoy). Funciona igual en modo normal y de prueba.
   */
  closeMeeting(): void {
    this.confirmationService.showConfirmation(
      {
        title: this.translate.instant('teacherMeetings.closeMeetingTitle'),
        message: this.translate.instant('teacherMeetings.closeMeetingMessage'),
        confirmText: this.translate.instant('teacherMeetings.closeMeetingConfirm'),
        cancelText: this.translate.instant('teacherMeetings.closeMeetingCancel'),
        type: 'warning'
      },
      () => {
        this.resetMeetingState();
        this.notificationService.showSuccess(
          this.translate.instant('teacherMeetings.closeMeetingDoneTitle'),
          this.translate.instant('teacherMeetings.closeMeetingDoneBody')
        );
      }
    );
  }

  /**
   * Devuelve la pantalla a su estado normal: cierra el temporizador, limpia la evaluación
   * en curso y oculta banners. No consume ningún servicio.
   */
  private resetMeetingState(): void {
    this.timerService.endSession();
    this.showEvaluationModal = false;
    this.students = [];
    this.evaluationStudyPlan = [];
    this.selectedPlanItemForEvaluation = null;
    this.currentProgramId = null;
    this.currentLevelId = null;
    this.resetLateGrading();
    this.elapsedTime = '00:00';
    this.showNotificationBanner = false;
    this.isLoading = false;
  }

  /**
   * Activa/desactiva el modo de prueba. En modo de prueba el docente puede practicar
   * la calificación con datos ficticios y sin consumir ningún servicio.
   */
  toggleTestMode(): void {
    this.isTestMode = !this.isTestMode;

    // Al cambiar de modo se limpia todo el estado: evaluación, temporizador y banners,
    // para que la app quede exactamente como en su estado normal.
    this.resetMeetingState();

    if (this.isTestMode) {
      this.notificationService.showInfo(
        this.translate.instant('teacherMeetings.testMode.bannerTitle'),
        this.translate.instant('teacherMeetings.testMode.bannerBody')
      );
    }
  }

  /**
   * Genera estudiantes ficticios para practicar la calificación en modo de prueba.
   */
  private buildTestStudents(): StudentEvaluation[] {
    const baseName = this.translate.instant('teacherMeetings.testMode.testStudent');
    return [1, 2, 3].map(i => ({
      id: `test-student-${i}`,
      name: `${baseName} ${i}`,
      attended: true,
      rating: 0,
      comment: '',
      currentRating: 0,
      currentCredits: 8,
      asistencia_id: []
    }));
  }

  /**
   * Genera un plan de estudio ficticio para el modo de prueba.
   */
  private buildTestStudyPlan(): any[] {
    const baseTopic = this.translate.instant('teacherMeetings.testMode.testTopic');
    return [1, 2, 3].map(i => ({
      number: i,
      displayNumber: String(i),
      text: `${baseTopic} ${i}`,
      original: { id: `test-plan-${i}`, plan: `${i}. ${baseTopic} ${i}`, realizado: false }
    }));
  }

  /**
   * Notificación cuando no hay estudiantes para calificar.
   */
  private notifyNoStudentsToGrade(): void {
    this.notificationService.showWarning(
      this.translate.instant('teacherMeetings.noStudentsToGradeTitle'),
      this.translate.instant('teacherMeetings.noStudentsToGradeBody')
    );
  }

  /**
   * Reinicia el estado de la calificación fuera de horario.
   */
  private resetLateGrading(): void {
    this.isLateGrading = false;
    this.lateGradingMeetingId = null;
    this.lateGradingDate = '';
  }

  /**
   * Abre la evaluación de estudiantes marcándola como calificación fuera de horario.
   * No requiere sesión activa (se puede calificar sin acceder a la reunión).
   * Advierte al docente que se aplicará una penalización sobre el valor_total de la nómina.
   */
  gradeOutOfSchedule(meeting: any, programa: any): void {
    if (!this.hasStudents(programa)) {
      this.notifyNoStudentsToGrade();
      return;
    }

    this.confirmationService.showConfirmation(
      {
        title: this.translate.instant('teacherMeetings.lateGradingConfirmTitle'),
        message: this.translate.instant('teacherMeetings.lateGradingConfirmMessage', { penalty: this.LATE_GRADING_PENALTY }),
        confirmText: this.translate.instant('teacherMeetings.lateGradingConfirmYes'),
        cancelText: this.translate.instant('teacherMeetings.lateGradingConfirmCancel'),
        type: 'warning'
      },
      () => {
        this.isLateGrading = true;
        this.lateGradingMeetingId = meeting?.id || null;
        // La fecha de la clase inicia en blanco: el docente debe seleccionarla
        this.lateGradingDate = '';
        this.initializeStudentEvaluations(programa);

        if (this.students.length === 0) {
          this.resetLateGrading();
          this.notifyNoStudentsToGrade();
          return;
        }

        this.showEvaluationModal = true;
      }
    );
  }

  private createPayrollRecordForGeneralMeeting(): void {
    // MODO DE PRUEBA: no se crea el registro de nómina
    if (this.isTestMode) {
      this.finishTestEvaluation();
      return;
    }

    const currentUser = StorageServices.getCurrentUser();
    const teacherId = currentUser?.id;
    const session = this.timerService.getSession();

    if (!teacherId || !session?.meetingId) {
      this.finishGeneralMeetingClose();
      return;
    }

    this.isLoading = true;

    this.payrollService.getTeacherHourlyRate(teacherId).subscribe({
      next: (valorHora) => {
        const payrollData: TeacherPayroll = {
          teacher_id: teacherId,
          reunion_meet_id: session.meetingId,
          programa_ayo_id: null,
          fecha_clase: new Date().toISOString().split('T')[0],
          hora_inicio_real: session.actualStartTime,
          hora_fin_evaluacion: new Date().toTimeString().split(' ')[0],
          duracion_horas: 1,
          calificado_a_tiempo: true,
          estado_pago: 'Pendiente',
          valor_hora: valorHora,
          valor_total: valorHora
        };

        this.payrollService.createPayrollRecord(payrollData).subscribe({
          next: () => {
            this.finishGeneralMeetingClose();
          },
          error: () => {
            this.finishGeneralMeetingClose();
          }
        });
      },
      error: () => {
        this.finishGeneralMeetingClose();
      }
    });
  }

  private finishGeneralMeetingClose(): void {
    this.isLoading = false;
    this.showEvaluationModal = false;
    this.students = [];
    this.timerService.endSession();
    this.showNotificationBanner = false;

    this.notificationService.showSuccess(
      this.translate.instant('teacherMeetings.notifications.sessionEndedTitle'),
      this.translate.instant('teacherMeetings.notifications.sessionEndedGeneralBody')
    );

    setTimeout(() => {
      this.router.navigate(['/private-ayo/dashboard-ayo']);
    }, 1500);
  }

  initializeStudentEvaluations(program?: any): void {
    // Usar el programa recibido (calificación fuera de horario) o buscar el de la sesión activa
    const currentProgram = program || this.programas.find(p =>
      p.id_reuniones_meet?.some(m => m.id === this.currentSession?.meetingId)
    );

    this.currentProgramId = currentProgram?.id ? String(currentProgram.id) : null;
    this.currentLevelId = currentProgram?.id_nivel?.id ? String(currentProgram.id_nivel.id) : null;

    const programStudents = currentProgram && Array.isArray((currentProgram as any).estudiantes_id)
      ? (currentProgram as any).estudiantes_id
      : (currentProgram?.id_nivel?.estudiantes_id || []);

    if (currentProgram && programStudents && Array.isArray(programStudents)) {
      // Map students from id_nivel to evaluation objects, ensuring uniqueness
      const uniqueStudentsMap = new Map();

      programStudents.forEach((student: any) => {
        // Determine the actual user object
        // 1. If it's a direct user object (O2M), it has first_name, email etc directly.
        // 2. If it's a junction (M2M), it has directus_users_id (which should be expanded to object).

        let userObj = student;

        if (student.directus_users_id && typeof student.directus_users_id === 'object') {
            userObj = student.directus_users_id;
            // Preserve junction specific fields if needed, but usually we want user fields
            // If asistencia_id is on junction, we might lose it, but usually it's on user.
            // If userObj doesn't have asistencia_id but student does, copy it?
            if (!userObj.asistencia_id && student.asistencia_id) {
                userObj = { ...userObj, asistencia_id: student.asistencia_id };
            }
        }

        const userId = userObj.id;

        if (userId && !uniqueStudentsMap.has(userId)) {
          uniqueStudentsMap.set(userId, userObj);
        }
      });

      this.students = Array.from(uniqueStudentsMap.values()).map((student: any) => ({
        id: student.id,
        name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
        attended: true,
        rating: 0,
        comment: '',
        currentRating: student.calificacion ? Number(student.calificacion) : 0,
        currentCredits: student.creditos ? Number(student.creditos) : 0,
        tipo_documento: student.tipo_documento,
        numero_documento: student.numero_documento,
        email_acudiente: student.email_acudiente,
        asistencia_id: student.asistencia_id
      }));
    } else {
      // Fallback to empty array if no students found
      this.students = [];
    }

    // Populate evaluationStudyPlan
    if (currentProgram && Array.isArray(currentProgram.plan_estudio_id)) {
      const rawPlan = currentProgram.plan_estudio_id as any[];
      this.evaluationStudyPlan = rawPlan.map(item => {
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
            number: 999999,
            displayNumber: '',
            text: text,
            original: item
          };
        }
      }).sort((a, b) => a.number - b.number);
    } else {
      this.evaluationStudyPlan = [];
    }

    // En modo de prueba se completan con datos ficticios los que no existan
    if (this.isTestMode) {
      if (this.students.length === 0) {
        this.students = this.buildTestStudents();
      }
      if (this.evaluationStudyPlan.length === 0) {
        this.evaluationStudyPlan = this.buildTestStudyPlan();
      }
      if (!this.currentProgramId) {
        this.currentProgramId = this.TEST_PROGRAM_ID;
      }
    }

    this.selectedPlanItemForEvaluation = null;
  }

  togglePlanItemSelection(item: any): void {
    if (item.original.realizado) return;

    if (this.selectedPlanItemForEvaluation === item) {
      this.selectedPlanItemForEvaluation = null;
    } else {
      this.selectedPlanItemForEvaluation = item;
    }
  }

  setRating(student: StudentEvaluation, rating: number): void {
    if (student.rating !== rating) {
      student.selectedCriteriaId = undefined;
    }
    student.rating = rating;
  }

  getRatingArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  getRatingLabel(rating: number): string {
    switch (rating) {
      case 1: return 'Exploring';
      case 2: return 'Growing';
      case 3: return 'Moving forward';
      case 4: return 'Shining';
      case 5: return 'Star performer';
      default: return '';
    }
  }

  submitEvaluations(): void {
    // Validate that all students who attended have ratings
    const attendedStudents = this.students.filter(s => s.attended);
    const allRated = attendedStudents.every(s => s.rating > 0);

    if (attendedStudents.length > 0 && !allRated) {
      this.notificationService.showWarning(
        this.translate.instant('teacherMeetings.notifications.incompleteRatingsTitle'),
        this.translate.instant('teacherMeetings.notifications.incompleteRatingsBody')
      );
      return;
    }

    // Validate that rated students have a criterion selected
    const ratedStudents = attendedStudents.filter(s => s.rating > 0);
    const allCriteriaSelected = ratedStudents.every(s => s.selectedCriteriaId);

    if (ratedStudents.length > 0 && !allCriteriaSelected) {
      this.notificationService.showWarning(
        this.translate.instant('teacherMeetings.notifications.incompleteCriteriaTitle'),
        this.translate.instant('teacherMeetings.notifications.incompleteCriteriaBody')
      );
      return;
    }

    if (!this.currentProgramId) {
      this.notificationService.showError(this.translate.instant('teacherMeetings.notifications.error'), this.translate.instant('teacherMeetings.notifications.programNotFound'));
      return;
    }

    // En calificación fuera de horario la fecha de la clase es obligatoria
    if (this.isLateGrading && !this.lateGradingDate) {
      this.notificationService.showWarning(
        this.translate.instant('teacherMeetings.classDate'),
        this.translate.instant('teacherMeetings.classDateRequired')
      );
      return;
    }

    // Validate Study Plan Selection
    if (!this.selectedPlanItemForEvaluation && this.evaluationStudyPlan.some(i => !i.original.realizado)) {
      this.notificationService.showWarning(
        this.translate.instant('teacherMeetings.notifications.studyPlanTitle'),
        this.translate.instant('teacherMeetings.notifications.studyPlanBody')
      );
      return;
    }

    // Check if students have already been graded today
    this.isLoading = true;
    // VALIDACIÓN "Estudiantes Ya Calificados" DESHABILITADA:
    // this.checkIfAlreadyGradedToday().subscribe({
    //   next: (alreadyGraded) => {
    //     if (alreadyGraded) {
    //       this.isLoading = false;
    //       this.notificationService.showWarning(
    //         'Estudiantes Ya Calificados',
    //         'Los estudiantes ya han sido calificados hoy para este programa. Solo se permite una calificación por día.'
    //       );
    //       return;
    //     }
    //     this.processEvaluationSubmission();
    //   },
    //   error: (err) => {
    //     console.error('Error checking if already graded:', err);
    //     this.processEvaluationSubmission();
    //   }
    // });
    this.processEvaluationSubmission();
  }

  /**
   * Check if students have already been graded today for current program
   */
  private checkIfAlreadyGradedToday(): Observable<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const studentIds = this.students.map(s => s.id);

    if (studentIds.length === 0 || !this.currentProgramId) {
      return new Observable(observer => {
        observer.next(false);
        observer.complete();
      });
    }

    const filter: any = {
      fecha: today,
      programa_ayo_id: this.currentProgramId,
      estudiante_id: { _in: studentIds },
      asiste: true
    };

    return this.attendanceService.getAttendances(1, 1, undefined, filter).pipe(
      map(response => {
        const records = response?.data || [];
        return records.length > 0;
      })
    );
  }

  /**
   * Process the evaluation submission after validations
   */
  private processEvaluationSubmission(): void {
    // MODO DE PRUEBA: no se consume ningún servicio, solo se simula el cierre
    if (this.isTestMode) {
      this.finishTestEvaluation();
      return;
    }

    // First, update study plan if selected
    const planUpdateObservable = this.selectedPlanItemForEvaluation
      ? this.programaAyoService.updatePlanEstudio(this.selectedPlanItemForEvaluation.original.id, { realizado: true })
      : new Observable(observer => { observer.next(true); observer.complete(); });

    planUpdateObservable.subscribe({
      next: () => {
        this.processBatchAttendanceAndUpdates();
      },
      error: (err) => {
        this.isLoading = false;
        this.notificationService.showError(this.translate.instant('teacherMeetings.notifications.error'), this.translate.instant('teacherMeetings.notifications.studyPlanUpdateError'));
      }
    });
  }

  /**
   * Process batch attendance records and user updates
   */
  private processBatchAttendanceAndUpdates(): void {
    const studentsWithZeroCredits: { tipo_documento: string; numero_documento: string }[] = [];
    const studentsWithFourCredits: string[] = [];
    const ratedStudentsForUpdate: { tipo_documento: string; numero_documento: string }[] = [];

    const attendanceDataList: any[] = [];
    const usersToUpdate: any[] = [];
    const certificatesToCreate: any[] = [];

    const programId = String(this.currentProgramId || '');

    this.students.forEach(student => {
      const evaluationData: any = {
        calificacion: student.rating,
        estudiante_id: student.id,
        programa_ayo_id: this.currentProgramId,
        asiste: student.attended,
        observaciones: student.comment,
        fecha: new Date().toISOString().split('T')[0],
        criterio_evaluacion_estudiante_id: student.selectedCriteriaId
      };
      attendanceDataList.push(evaluationData);

      const currentCredits = Number(student.currentCredits) || 0;
      const newCredits = currentCredits > 0 ? currentCredits - 1 : 0;

      if (newCredits === 0 && student.tipo_documento && student.numero_documento) {
        studentsWithZeroCredits.push({
          tipo_documento: student.tipo_documento,
          numero_documento: student.numero_documento
        });
      }

      if (newCredits === 4 && student.email_acudiente) {
        studentsWithFourCredits.push(student.email_acudiente);
      }

      if (student.tipo_documento && student.numero_documento) {
        ratedStudentsForUpdate.push({
          tipo_documento: student.tipo_documento,
          numero_documento: student.numero_documento
        });
      }

      const updateData: any = {
        id: student.id,
        creditos: newCredits
      };

      if (newCredits === 0) {
        const finalAttendancePercent = this.calculateProjectedAttendance(student);
        const pastRatingSum = Array.isArray(student.asistencia_id)
          ? student.asistencia_id.reduce((sum: number, record: any) => {
              if (!record || typeof record !== 'object') return sum;
              const rid = record.programa_ayo_id;
              const recProgramId = typeof rid === 'object' ? (rid && rid.id ? rid.id : rid) : rid;
              if (String(recProgramId || '') !== programId) return sum;
              if (record.asiste !== true) return sum;
              const val = Number(record.calificacion);
              return Number.isFinite(val) ? sum + val : sum;
            }, 0)
          : 0;
        const currentMeetingRating = student.attended ? (Number(student.rating) || 0) : 0;
        const projectedRatingSum = pastRatingSum + currentMeetingRating;

        const passed = finalAttendancePercent >= 70 && projectedRatingSum >= 80;
        updateData.aprobo_ayo = passed;
        // Guardar el programa actual en programa_ayo_anterior antes de limpiar programa_ayo_id
        updateData.programa_ayo_anterior = this.currentProgramId;
        updateData.programa_ayo_id = null;

        if (passed && this.currentLevelId) {
          certificatesToCreate.push({
            estudiante_id: student.id,
            nivel_id: this.currentLevelId
          });
        }
      }

      usersToUpdate.push(updateData);
    });

    const requests: Observable<any>[] = [];
    if (attendanceDataList.length > 0) {
      requests.push(this.attendanceService.createAttendances(attendanceDataList));
    }
    if (usersToUpdate.length > 0) {
      requests.push(this.userService.updateUsers(usersToUpdate));
    }
    if (certificatesToCreate.length > 0) {
      requests.push(this.certificacionService.createCertificados(certificatesToCreate));
    }

    forkJoin(requests).subscribe({
      next: () => {
        if (studentsWithZeroCredits.length > 0) {
          const tipo_documento = studentsWithZeroCredits.map(s => s.tipo_documento);
          const numero_documento = studentsWithZeroCredits.map(s => s.numero_documento);

          this.accountReceivableService.newAccountAyo(tipo_documento, numero_documento).subscribe({
            next: () => console.log('Students sent to new service'),
            error: (e) => console.error('Error sending students to new service', e)
          });
        }

        if (ratedStudentsForUpdate.length > 0) {
          ratedStudentsForUpdate.forEach(s => {
            this.studentService.searchStudentByDocument(s.tipo_documento, s.numero_documento).subscribe({
              next: (res) => {
                if (res.data && res.data.length > 0) {
                  const studentId = res.data[0].id;
                  if (studentId) {
                    this.studentService.updateStudent(studentId, { estudiante_ayo: true } as any).subscribe({
                      next: () => console.log(`Updated estudiante_ayo for student ${s.numero_documento}`),
                      error: (e) => console.error(`Error updating estudiante_ayo for student ${s.numero_documento}`, e)
                    });
                  }
                }
              },
              error: (e) => console.error(`Error searching student ${s.numero_documento}`, e)
            });
          });
        }

        if (studentsWithFourCredits.length > 0) {
          this.programaAyoService.notifyAcudientesFlow(studentsWithFourCredits).subscribe({
            next: () => console.log('Notify Acudientes Flow triggered successfully'),
            error: (e) => console.error('Error triggering Notify Acudientes Flow', e)
          });
        }

        this.createPayrollRecord();
      },
      error: (err) => {
        console.error('Error submitting evaluations:', err);
        this.isLoading = false;
        this.notificationService.showError(this.translate.instant('teacherMeetings.notifications.error'), this.translate.instant('teacherMeetings.notifications.saveEvaluationsError'));
      }
    });
  }

  /**
   * Check if meeting can be accessed (10 minutes before start until end)
   * @param meeting The meeting to check
   * @returns true if meeting can be accessed
   */
  canAccessMeeting(meeting: any): boolean {
    // VALIDACIÓN DE FECHA DESHABILITADA: siempre permitir acceso a la reunión
    // (antes mostraba "Disponible en..." y deshabilitaba el botón).
    return true;
  }

  /**
   * Get the reason why a meeting cannot be accessed
   * @param meeting The meeting to check
   * @returns Descriptive message or null if can access
   */
  getMeetingAccessMessage(meeting: any): string | null {
    // VALIDACIÓN DE FECHA DESHABILITADA (mensaje "Disponible en..."):
    // if (this.canAccessMeeting(meeting)) return null;
    //
    // const now = new Date();
    // const start = new Date(meeting.fecha_inicio);
    // const end = new Date(meeting.fecha_finalizacion);
    // const accessStart = new Date(start.getTime() - 10 * 60 * 1000);
    //
    // if (now < accessStart) {
    //   const minutesUntil = Math.ceil((accessStart.getTime() - now.getTime()) / 60000);
    //   return `Disponible en ${minutesUntil} minutos`;
    // } else if (now > end) {
    //   return 'Reunión finalizada';
    // }
    //
    // return null;
    return null;
  }

  cancelEvaluation(): void {
    this.confirmationService.showConfirmation(
      {
        title: this.translate.instant('teacherMeetings.cancelEvaluationTitle'),
        message: this.translate.instant('teacherMeetings.cancelEvaluationMessage'),
        confirmText: this.translate.instant('teacherMeetings.cancelEvaluationYes'),
        cancelText: this.translate.instant('teacherMeetings.cancelEvaluationNo'),
        type: 'warning'
      },
      () => {
        this.showEvaluationModal = false;
        this.students = [];
        this.resetLateGrading();
      }
    );
  }

  dismissNotification(): void {
    this.showNotificationBanner = false;
  }

  /**
   * Determina si la hora actual ya pasó la fecha_finalizacion de la reunión activa,
   * comparando SOLO la hora del día (hh:mm:ss), sin importar la fecha.
   */
  private hasSessionEndTimePassed(session: any): boolean {
    const endTime = this.getActiveMeetingEndTime(session);

    if (!endTime || isNaN(endTime.getTime())) {
      console.log('[auto-cierre] No se encontró endTime válido -> no cierra');
      return false;
    }

    // La sesión debe cerrarse 10 minutos DESPUÉS de la fecha_finalizacion.
    // Ej: si la reunión termina a las 6:20, el cierre es a las 6:30 o después.
    const deadline = new Date(endTime.getTime() + 10 * 60 * 1000);

    const now = new Date();
    const deadlineSeconds = deadline.getHours() * 3600 + deadline.getMinutes() * 60 + deadline.getSeconds();
    const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const pastDeadline = nowSeconds > deadlineSeconds;

    // DEBUG temporal - revisar consola del navegador
    console.log('[auto-cierre] fin reunión:', endTime.getHours() + ':' + endTime.getMinutes(),
      '| deadline (+10min):', deadline.getHours() + ':' + deadline.getMinutes() + ':' + deadline.getSeconds(),
      '| ahora:', now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds(),
      '| debe cerrar:', pastDeadline);

    return pastDeadline;
  }

  /**
   * Obtiene la fecha_finalizacion de la reunión activa. Busca primero en las reuniones
   * cargadas (programas y generales) y, como respaldo, usa scheduledEndTime de la sesión.
   */
  private getActiveMeetingEndTime(session: any): Date | null {
    const meetingId = session?.meetingId;
    if (meetingId) {
      for (const programa of this.programas) {
        const meeting = (programa as any).id_reuniones_meet?.find((m: any) => m.id === meetingId);
        if (meeting?.fecha_finalizacion) return new Date(meeting.fecha_finalizacion);
      }
      for (const program of this.generalPrograms) {
        const meeting = (program as any).id_reuniones_meet?.find((m: any) => m.id === meetingId);
        if (meeting?.fecha_finalizacion) return new Date(meeting.fecha_finalizacion);
      }
    }
    if (session?.scheduledEndTime) return new Date(session.scheduledEndTime);
    return null;
  }

  /**
   * Se ejecuta cuando la hora actual ya pasó los 10 minutos posteriores a la fecha_finalizacion
   * (comparando solo la hora del día) sin que el docente cierre/califique la reunión. Cierra la
   * sesión, devuelve el temporizador a su estado normal y marca califico_hoy: true en el usuario.
   */
  private handleGradingDeadlineExpired(): void {
    // Cerrar el temporizador y volver a su estado normal
    this.timerService.endSession();
    this.showEvaluationModal = false;
    this.showNotificationBanner = false;
    this.elapsedTime = '00:00';

    this.markCalificoHoy();
    this.autoClosingSession = false;
  }

  /**
   * Marca califico_hoy: true en el usuario actual (docente): consume el servicio de
   * actualización y sincroniza el current_user en storage.
   */
  private markCalificoHoy(): void {
    const currentUser = StorageServices.getCurrentUser();
    const userId = currentUser?.id;
    if (!userId) return;

    this.userService.updateUser(userId, { califico_hoy: true }).subscribe({
      next: () => {
        // Mantener sincronizado el current_user en storage
        StorageServices.setUserData({ ...currentUser, califico_hoy: true });
      },
      error: (err) => {
        console.error('Error actualizando califico_hoy:', err);
      }
    });
  }

  createPayrollRecord(): void {
    const currentUser = StorageServices.getCurrentUser();
    const teacherId = currentUser?.id;
    const session = this.timerService.getSession();

    // En calificación fuera de horario puede no haber sesión activa
    const meetingId = session?.meetingId || this.lateGradingMeetingId;

    if (!teacherId || !meetingId || !this.currentProgramId) {
      this.finishEvaluationProcess();
      return;
    }

    // Get current program and meeting
    const currentProgram = this.programas.find(p =>
      p.id_reuniones_meet?.some(m => m.id === meetingId)
    );
    const currentMeeting = currentProgram?.id_reuniones_meet?.find(m => m.id === meetingId);

    if (!currentMeeting || !currentMeeting.id) {
      console.error('Meeting not found or missing ID');
      this.finishEvaluationProcess();
      return;
    }

    // Get teacher hourly rate and create payroll
    this.payrollService.getTeacherHourlyRate(teacherId).subscribe({
      next: (valorHora) => {
        // Si se calificó fuera de horario, se descuenta la penalización del valor hora
        const valorHoraFinal = this.isLateGrading
          ? Math.max(0, valorHora - this.LATE_GRADING_PENALTY)
          : valorHora;

        // Always pay 1 full hour per class, regardless of actual duration
        const payrollData: TeacherPayroll = {
          teacher_id: teacherId,
          reunion_meet_id: currentMeeting.id,
          programa_ayo_id: this.currentProgramId!,
          // En calificación fuera de horario se usa la fecha seleccionada por el docente
          fecha_clase: this.isLateGrading && this.lateGradingDate
            ? this.lateGradingDate
            : new Date().toISOString().split('T')[0],
          hora_inicio_real: session?.actualStartTime,
          hora_fin_evaluacion: new Date().toTimeString().split(' ')[0], // HH:mm:ss format for time-only field
          duracion_horas: 1,
          calificado_a_tiempo: !this.isLateGrading,
          estado_pago: 'Pendiente',
          valor_hora: valorHoraFinal,
          valor_total: valorHora
        };

        this.payrollService.createPayrollRecord(payrollData).subscribe({
          next: (response) => {
            this.finishEvaluationProcess();
          },
          error: (err) => {
            console.error('Error creating payroll record:', err);
            this.finishEvaluationProcess();
          }
        });
      },
      error: (err) => {
        console.error('Error getting hourly rate:', err);
        this.finishEvaluationProcess();
      }
    });
  }

  /**
   * Cierra el flujo de calificación en modo de prueba: no guarda nada, no crea nómina
   * y no redirige. Solo limpia el estado para poder volver a practicar.
   */
  private finishTestEvaluation(): void {
    this.isLoading = false;
    this.showEvaluationModal = false;
    this.students = [];
    this.resetLateGrading();
    this.timerService.endSession();
    this.showNotificationBanner = false;

    this.notificationService.showSuccess(
      this.translate.instant('teacherMeetings.testMode.successTitle'),
      this.translate.instant('teacherMeetings.testMode.successBody')
    );
  }

  finishEvaluationProcess(): void {
    this.isLoading = false;
    this.showEvaluationModal = false;
    this.resetLateGrading();
    this.timerService.endSession();
    this.showNotificationBanner = false;

    // PRUEBAS: marcado de califico_hoy DESACTIVADO temporalmente. Descomentar para reactivar.
    // Marcar califico_hoy: true al guardar y finalizar la evaluación de estudiantes
    // this.markCalificoHoy();

    this.notificationService.showSuccess(
      this.translate.instant('teacherMeetings.notifications.sessionEndedTitle'),
      this.translate.instant('teacherMeetings.notifications.sessionEndedBody')
    );

    setTimeout(() => {
      this.router.navigate(['/private-ayo/dashboard-ayo']);
    }, 1500);
  }

  goBack(): void {
    this.router.navigate(['/private-ayo/dashboard-ayo'], {
      queryParams: { idioma: this.selectedLanguage },
      queryParamsHandling: 'merge'
    });
  }

  hasActiveSession(meetingId: string): boolean {
    return this.timerService.hasActiveSession(meetingId);
  }

  /**
   * Indica si el docente ya cerró/calificó por el día de hoy (califico_hoy === true).
   * Cuando es true no se permite acceder a nuevas reuniones.
   */
  isGradingClosedForToday(): boolean {
    const currentUser = StorageServices.getCurrentUser();
    return currentUser?.califico_hoy === true;
  }

  /**
   * Indica si la hora actual está dentro del rango horario de la reunión
   * (entre la hora de fecha_inicio y la de fecha_finalizacion), comparando solo la hora del día.
   */
  isWithinMeetingTimeRange(meeting: any): boolean {
    // En modo de prueba todos los botones quedan habilitados
    if (this.isTestMode) return true;

    if (!meeting?.fecha_inicio || !meeting?.fecha_finalizacion) return false;

    const start = new Date(meeting.fecha_inicio);
    const end = new Date(meeting.fecha_finalizacion);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

    const toSeconds = (d: Date) => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    const now = new Date();
    const nowSeconds = toSeconds(now);

    return nowSeconds >= toSeconds(start) && nowSeconds <= toSeconds(end);
  }

  openStudyPlanModal(programa: ProgramaAyo): void {
    this.selectedProgramForStudyPlan = programa;
    if (Array.isArray(programa.plan_estudio_id)) {
      const rawPlan = programa.plan_estudio_id as any[];
      this.selectedStudyPlan = rawPlan.map(item => {
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
        this.ngZone.run(() => {
          if (resp.error) {
            reject(resp);
          } else {
            if (gapi.client) {
              gapi.client.setToken(resp);
            }
            resolve(resp.access_token);
          }
        });
      };
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  async addParticipantsToMeeting(reunion: any, emailsToAdd: string[]): Promise<void> {
    if (!reunion.id_reunion) {
        this.notificationService.showError(this.translate.instant('teacherMeetings.notifications.error'), this.translate.instant('teacherMeetings.notifications.meetingWithoutId'));
        return;
    }

    try {
        const token = await this.ensureCalendarToken();
        if (!token) {
            throw new Error('No se obtuvo un token válido.');
        }

        let headers = new HttpHeaders();
        headers = headers.set('Authorization', `Bearer ${token}`);
        headers = headers.set('Content-Type', 'application/json');

        const baseUrl = `https://content.googleapis.com/calendar/v3/calendars/primary/events/${reunion.id_reunion}?alt=json`;
        const event: any = await lastValueFrom(this.http.get(baseUrl, { headers }));
        const currentAttendees = event.attendees || [];
        const organizerEmail = event.organizer?.email?.toLowerCase();

        // Lista autoritativa de estudiantes (Normalizamos a minúsculas)
        const targetEmails = new Set(emailsToAdd.map(e => e.toLowerCase()));

        const finalAttendees: any[] = [];
        let changesNeeded = false;

        // 1. Construir lista final basada SOLO en estudiantes activos (Forzando 'accepted')
        for (const email of emailsToAdd) {
            const existing = currentAttendees.find((a: any) => a.email?.toLowerCase() === email.toLowerCase());
            if (existing) {
                // Si existe, preservamos info pero forzamos accepted
                if (existing.responseStatus !== 'accepted') {
                    changesNeeded = true;
                }
                finalAttendees.push({ ...existing, responseStatus: 'accepted' });
            } else {
                // Nuevo estudiante
                finalAttendees.push({ email, responseStatus: 'accepted' });
                changesNeeded = true;
            }
        }

        // 2. Preservar al organizador si estaba en la lista y no es un estudiante
        if (organizerEmail && !targetEmails.has(organizerEmail)) {
            const organizerEntry = currentAttendees.find((a: any) => a.email?.toLowerCase() === organizerEmail);
            if (organizerEntry) {
                finalAttendees.push(organizerEntry);
            }
        }

        // 3. Detectar si hay eliminaciones (Gente en calendar que NO está en finalAttendees)
        const finalEmailsSet = new Set(finalAttendees.map(a => a.email?.toLowerCase()));
        const attendeesToRemove = currentAttendees.filter((a: any) => !finalEmailsSet.has(a.email?.toLowerCase()));

        if (attendeesToRemove.length > 0) {
            changesNeeded = true;
            console.log('Eliminando asistentes obsoletos:', attendeesToRemove.map((a:any) => a.email));
        }

        console.log('Sincronización de asistentes:', {
            totalEstudiantes: emailsToAdd.length,
            asistentesFinales: finalAttendees.length,
            cambiosDetectados: changesNeeded
        });

        if (!changesNeeded) {
            return;
        }

        const patchUrl = `${baseUrl}&sendUpdates=all`;
        await lastValueFrom(this.http.patch(patchUrl, {
            attendees: finalAttendees,
            guestsCanSeeOtherGuests: true
        }, { headers }));

    } catch (error: any) {
        const msg = error?.error?.error?.message || error.message || 'Error desconocido';
        this.notificationService.showError(this.translate.instant('teacherMeetings.notifications.googleApiError'), msg);
        throw error;
    }
  }
}
