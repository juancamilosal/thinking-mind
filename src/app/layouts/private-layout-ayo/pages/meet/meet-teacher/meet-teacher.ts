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
import { TranslateModule } from '@ngx-translate/core';

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
  selectedLanguage: string | null = null;
  assetsUrl: string = environment.assets;

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

  // Evaluation modal
  showEvaluationModal: boolean = false;
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
  private http = inject(HttpClient);
  private ngZone = inject(NgZone);

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
        record && typeof record === 'object' && record.programa_ayo_id === programId
     );

     const pastTotal = relevantRecords.length;
     const pastAttended = relevantRecords.filter((record: any) => record.asiste === true).length;

     const currentAttended = student.attended ? 1 : 0;

     const finalTotal = pastTotal + 1;
     const finalAttended = pastAttended + currentAttended;

     return Math.round((finalAttended / finalTotal) * 100);
  }

  ngOnInit(): void {
    this.loadGoogleScripts();
    this.loadEvaluationCriteria();

    this.route.queryParams.subscribe(params => {
      if (params['idioma']) {
        this.selectedLanguage = params['idioma'].toUpperCase();
      }
      this.loadTeacherMeetings();
    });

    this.timerSubscription = this.timerService.session$.subscribe(session => {
      this.currentSession = session;
      if (session && session.isActive) {
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
          this.programas = response.data
            .filter(p => p.id_reuniones_meet && p.id_reuniones_meet.length > 0);
          if (!this.selectedLanguage && this.programas.length > 0) {
            this.selectedLanguage = this.programas[0].idioma?.toUpperCase() || null;
          }

        }
        this.isLoading = false;
      },
      error: (error) => {
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
    /*
    if (status === 'completed') {
      this.notificationService.showInfo(
        'Reunión Finalizada',
        'Esta reunión ya ha finalizado.'
      );
      return;
    }
    */

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

    if (currentProgramStudents.length > 0 && meeting.id_reunion) {
      try {
        await this.addParticipantsToMeeting(meeting, currentProgramStudents);
      } catch (error) {

      }
    }

    // Start timer session and open meeting in Angular Zone
    this.ngZone.run(() => {
      const scheduledStart = new Date(meeting.fecha_inicio);
      const scheduledEnd = new Date(meeting.fecha_finalizacion);
      this.timerService.startSession(meeting.id, scheduledStart, scheduledEnd);

      // Open meeting in new tab
      if (meeting.link_reunion) {
        window.open(meeting.link_reunion, '_blank');
      }
    });
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

    this.currentProgramId = currentProgram?.id ? String(currentProgram.id) : null;
    this.currentLevelId = currentProgram?.id_nivel?.id ? String(currentProgram.id_nivel.id) : null;

    const programStudents = currentProgram && Array.isArray((currentProgram as any).estudiantes_id)
      ? (currentProgram as any).estudiantes_id
      : (currentProgram?.id_nivel?.estudiantes_id || []);

    if (currentProgram && programStudents && Array.isArray(programStudents)) {
      // Map students from id_nivel to evaluation objects, ensuring uniqueness
      const uniqueStudentsMap = new Map();

      programStudents.forEach((student: any) => {
        const studentId = student.id || student.directus_users_id;
        if (studentId && !uniqueStudentsMap.has(studentId)) {
          uniqueStudentsMap.set(studentId, student);
        }
      });

      this.students = Array.from(uniqueStudentsMap.values()).map((student: any) => ({
        id: student.id || student.directus_users_id || '',
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
        'Calificaciones Incompletas',
        'Por favor califica a todos los estudiantes que asistieron.'
      );
      return;
    }

    // Validate that rated students have a criterion selected
    const ratedStudents = attendedStudents.filter(s => s.rating > 0);
    const allCriteriaSelected = ratedStudents.every(s => s.selectedCriteriaId);

    if (ratedStudents.length > 0 && !allCriteriaSelected) {
      this.notificationService.showWarning(
        'Criterios Incompletos',
        'Por favor selecciona un criterio para cada calificación.'
      );
      return;
    }

    if (!this.currentProgramId) {
      this.notificationService.showError('Error', 'No se identificó el programa asociado.');
      return;
    }

    // Validate Study Plan Selection
    if (!this.selectedPlanItemForEvaluation && this.evaluationStudyPlan.some(i => !i.original.realizado)) {
      this.notificationService.showWarning(
        'Plan de Estudio',
        'Debe seleccionar un tema del plan de estudio como realizado para finalizar.'
      );
      return;
    }

    this.isLoading = true;

    const processAttendance = () => {
      const studentsWithZeroCredits: { tipo_documento: string; numero_documento: string }[] = [];
      const studentsWithFourCredits: string[] = [];
      const ratedStudentsForUpdate: { tipo_documento: string; numero_documento: string }[] = [];

      const attendanceDataList: any[] = [];
      const usersToUpdate: any[] = [];
      const certificatesToCreate: any[] = [];

      // Collect data for batch requests
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

        // Update student cumulative grade if they attended and have a rating
        if (student.attended && student.rating > 0) {
          const newRating = (Number(student.currentRating) || 0) + Number(student.rating);
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
            calificacion: newRating,
            creditos: newCredits
          };

          // Logic for certification and approval
          if (newCredits === 0) {
            const finalAttendancePercent = this.calculateProjectedAttendance(student);
            const passed = finalAttendancePercent >= 70 && newRating >= 70;

            console.log(`Checking certification for ${student.name}:`, {
                newCredits,
                finalAttendancePercent,
                newRating,
                passed,
                currentLevelId: this.currentLevelId
            });

            updateData.aprobo_ayo = passed;
            updateData.programa_ayo_id = null;

            if (passed) {
               // Create certificate directly using CertificacionService
               if (this.currentLevelId) {
                  const certificateData = {
                     estudiante_id: student.id,
                     nivel_id: this.currentLevelId
                  };
                  console.log('Adding certificate to create:', certificateData);
                  certificatesToCreate.push(certificateData);
               } else {
                   console.warn('Passed but no currentLevelId found. Certificate NOT created.');
               }
            } else {
              console.log(`Student ${student.name} did not pass. Attendance: ${finalAttendancePercent}%, Rating: ${newRating}`);
            }
          }

          usersToUpdate.push(updateData);
        }
      });

      const requests: Observable<any>[] = [];

      // 1. Batch create attendance
      if (attendanceDataList.length > 0) {
        requests.push(this.attendanceService.createAttendances(attendanceDataList));
      }

      // 2. Batch update users
      if (usersToUpdate.length > 0) {
        requests.push(this.userService.updateUsers(usersToUpdate));
      }

      // 3. Batch create certificates
      if (certificatesToCreate.length > 0) {
        requests.push(this.certificacionService.createCertificados(certificatesToCreate));
      }

      // Execute all batch requests
      forkJoin(requests).subscribe({
        next: (responses) => {
          console.log('Batch operations completed', responses);

          // Send students with zero credits to new service
          if (studentsWithZeroCredits.length > 0) {
            const tipo_documento = studentsWithZeroCredits.map(s => s.tipo_documento);
            const numero_documento = studentsWithZeroCredits.map(s => s.numero_documento);

            this.accountReceivableService.newAccountAyo(tipo_documento, numero_documento).subscribe({
              next: () => console.log('Students sent to new service'),
              error: (e) => console.error('Error sending students to new service', e)
            });
          }

          // Update estudiante_ayo status for ALL rated students
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

          // Send students with 4 credits email
          if (studentsWithFourCredits.length > 0) {
            this.programaAyoService.notifyAcudientesFlow(studentsWithFourCredits).subscribe({
              next: () => console.log('Notify Acudientes Flow triggered successfully'),
              error: (e) => console.error('Error triggering Notify Acudientes Flow', e)
            });
          }

          // Create payroll record
          this.createPayrollRecord();
        },
        error: (err) => {
          console.error('Error submitting evaluations:', err);
          this.isLoading = false;
          this.notificationService.showError('Error', 'Hubo un error al guardar las evaluaciones.');
        }
      });
    };

    if (this.selectedPlanItemForEvaluation) {
      this.programaAyoService.updatePlanEstudio(this.selectedPlanItemForEvaluation.original.id, { realizado: true })
        .subscribe({
          next: () => {
            processAttendance();
          },
          error: (err) => {
            this.isLoading = false;
            this.notificationService.showError('Error', 'No se pudo actualizar el plan de estudio.');
          }
        });
    } else {
      processAttendance();
    }
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

  createPayrollRecord(): void {
    const currentUser = StorageServices.getCurrentUser();
    const teacherId = currentUser?.id;
    const session = this.timerService.getSession();

    if (!teacherId || !session || !this.currentProgramId) {
      this.finishEvaluationProcess();
      return;
    }

    // Get current program and meeting
    const currentProgram = this.programas.find(p =>
      p.id_reuniones_meet?.some(m => m.id === session.meetingId)
    );
    const currentMeeting = currentProgram?.id_reuniones_meet?.find(m => m.id === session.meetingId);

    if (!currentMeeting || !currentMeeting.id) {
      console.error('Meeting not found or missing ID');
      this.finishEvaluationProcess();
      return;
    }

    // Get teacher hourly rate and create payroll
    this.payrollService.getTeacherHourlyRate(teacherId).subscribe({
      next: (valorHora) => {
        // Always pay 1 full hour per class, regardless of actual duration
        const payrollData: TeacherPayroll = {
          teacher_id: teacherId,
          reunion_meet_id: currentMeeting.id,
          programa_ayo_id: this.currentProgramId!,
          fecha_clase: new Date().toISOString().split('T')[0],
          hora_inicio_real: session.actualStartTime,
          hora_fin_evaluacion: new Date().toTimeString().split(' ')[0], // HH:mm:ss format for time-only field
          duracion_horas: 1,
          calificado_a_tiempo: true,
          estado_pago: 'Pendiente',
          valor_hora: valorHora,
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

  finishEvaluationProcess(): void {
    this.isLoading = false;
    this.showEvaluationModal = false;
    this.timerService.endSession();
    this.showNotificationBanner = false;

    this.notificationService.showSuccess(
      'Sesión Finalizada',
      'La evaluación y calificaciones han sido guardadas exitosamente.'
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
        this.notificationService.showError('Error', 'Reunión sin ID');
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
        this.notificationService.showError('Error API Google', msg);
        throw error;
    }
  }
}
