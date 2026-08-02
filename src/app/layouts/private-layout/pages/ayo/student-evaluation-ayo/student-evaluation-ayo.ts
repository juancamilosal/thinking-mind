import { Component, OnInit, OnDestroy, ApplicationRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../../../core/services/user.service';
import { AttendanceService } from '../../../../../core/services/attendance.service';
import { ConfirmationService } from '../../../../../core/services/confirmation.service';
import { ProgramaAyoService } from '../../../../../core/services/programa-ayo.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { AccountReceivableService } from '../../../../../core/services/account-receivable.service';
import { StudentService } from '../../../../../core/services/student.service';
import { CertificacionService } from '../../../../../core/services/certificacion.service';
import { Roles } from '../../../../../core/const/Roles';
import { Router } from '@angular/router';
import { Subject, Subscription, Observable, forkJoin, of, throwError } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { catchError, finalize, switchMap } from 'rxjs/operators';

interface StudentStat {
  studentId: string;
  studentName: string;
  studentEmail: string;
  avatar?: string;
  averageRating: number;
  totalEvaluations: number;
  lastEvaluationDate: string;
}

@Component({
  selector: 'app-student-evaluation-ayo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-evaluation-ayo.html'
})
export class StudentEvaluationAyoComponent implements OnInit, OnDestroy {
  isLoading = true;
  isLoadingDetail = false;
  isLoadingAttendance = false;
  students: any[] = [];
  selectedStudent: StudentStat | null = null;
  state: 'list' | 'detail' = 'list';

  // Filters for student list
  searchTerm: string = '';
  private searchSubject = new Subject<string>();
  private searchSubscription: Subscription | undefined;

  // Pagination for student list (server-side, via Directus)
  currentPage = 1;
  itemsPerPage = 10;
  itemsPerPageOptions = [10, 25, 50, 100];
  totalItems = 0;
  Math = Math;

  // Detail view data
  attendanceRecords: any[] = [];

  // Filters for detail view
  filterDateStart: string = '';
  filterDateEnd: string = '';
  filterProgram: string = '';
  filterCriterion: string = '';

  // Options for filters
  uniquePrograms: string[] = [];
  uniqueCriteria: string[] = [];

  selectedObservation: string | null = null;
  isObservationModalOpen = false;
  deletingAttendanceId: string | null = null;

  // Add rating modal (single student evaluation)
  showAddRatingModal = false;
  isSavingRating = false;
  isCheckingCredits = false;
  studentCredits = 0;
  studentProgram: any = null;
  studentLevelId: string | null = null;
  studentTipoDocumento?: string;
  studentNumeroDocumento?: string;
  studentEmailAcudiente?: string;
  studentAsistencias: any[] = [];
  evaluationCriteria: any[] = [];
  maxCommentLength = 250;
  newRating = {
    attended: true,
    rating: 0,
    comment: '',
    selectedCriteriaId: undefined as string | undefined,
    programId: ''
  };

  constructor(
    private userService: UserService,
    private attendanceService: AttendanceService,
    private confirmationService: ConfirmationService,
    private programaAyoService: ProgramaAyoService,
    private notificationService: NotificationService,
    private accountReceivableService: AccountReceivableService,
    private studentService: StudentService,
    private certificacionService: CertificacionService,
    private appRef: ApplicationRef,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  openObservationModal(observation: string) {
    if (observation) {
      this.selectedObservation = observation;
      this.isObservationModalOpen = true;
    }
  }

  closeObservationModal() {
    this.isObservationModalOpen = false;
    this.selectedObservation = null;
  }

  getStarsArray(score: any): number[] {
    if (!score || isNaN(Number(score))) {
      return [];
    }
    const count = Math.round(Number(score));
    return Array(count).fill(0);
  }

  ngOnInit() {
    this.loadStudents();
    
    // Setup search subscription with debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(term => {
      this.loadStudents(term);
    });
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    // Restaurar el scroll del fondo si el componente se destruye con el modal abierto
    document.body.style.overflow = '';
  }

  onSearchChange() {
    this.currentPage = 1;
    this.searchSubject.next(this.searchTerm);
  }

  loadStudents(search?: string) {
    this.isLoading = true;
    this.userService.getUsersByRole(Roles.STUDENT, search, this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        this.students = (response.data || []).map((user: any) => ({
          studentId: user.id,
          studentName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          studentEmail: user.email,
          avatar: user.avatar
        }));
        this.totalItems = response.meta?.filter_count ?? this.students.length;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading students', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredStudents() {
    return this.students;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.itemsPerPage));
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadStudents(this.searchTerm || undefined);
    }
  }

  goToPreviousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  goToNextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  onItemsPerPageChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.itemsPerPage = parseInt(target.value, 10);
    this.currentPage = 1;
    this.loadStudents(this.searchTerm || undefined);
  }

  selectStudent(student: any) {
    this.isLoadingDetail = true;
    this.state = 'detail';

    // Initialize selected student with basic info
    this.selectedStudent = {
      ...student,
      averageRating: 0,
      totalEvaluations: 0,
      lastEvaluationDate: ''
    };

    // Reset detail filters
    this.filterDateStart = '';
    this.filterDateEnd = '';
    this.filterProgram = '';
    this.filterCriterion = '';

    // Clear previous attendance data
    this.attendanceRecords = [];

    // Load Attendance
    this.loadAttendance(student.studentId);
  }

  applyFilters() {
    if (this.selectedStudent) {
      this.loadAttendance(this.selectedStudent.studentId);
    }
  }

  loadAttendance(studentId: string) {
    this.isLoadingAttendance = true;
    
    // Fields to fetch: include related data for criteria and program
    const fields = '*,criterio_evaluacion_estudiante_id.*,programa_ayo_id.*,programa_ayo_id.id_nivel.nivel';
    
    // Build Directus filter object
    const filter: any = {
      'estudiante_id': studentId
    };

    if (this.filterDateStart) {
      filter.fecha = { ...filter.fecha, _gte: this.filterDateStart };
    }
    if (this.filterDateEnd) {
      filter.fecha = { ...filter.fecha, _lte: this.filterDateEnd };
    }
    if (this.filterProgram) {
      filter.programa_ayo_id = { id_nivel: { nivel: { _eq: this.filterProgram } } };
    }
    if (this.filterCriterion) {
      filter.criterio_evaluacion_estudiante_id = { nombre: { _eq: this.filterCriterion } };
    }

    this.attendanceService.getAttendances(1, 100, undefined, filter, '-fecha', fields).subscribe({
        next: (response) => {
            this.attendanceRecords = response.data || [];
            
            // Only extract options if they haven't been populated yet (to preserve options during filtering)
            if (this.uniquePrograms.length === 0 && this.uniqueCriteria.length === 0) {
              this.extractFilterOptions();
            }
            
            this.processDetailData();
            this.isLoadingAttendance = false;
            this.isLoadingDetail = false;
            this.cdr.detectChanges();
        },
        error: (err) => {
            console.error('Error loading attendance', err);
            this.isLoadingAttendance = false;
            this.isLoadingDetail = false;
            this.cdr.detectChanges();
        }
    });
  }

  extractFilterOptions() {
    const programs = new Set<string>();
    const criteria = new Set<string>();

    this.attendanceRecords.forEach(record => {
        if (record.programa_ayo_id?.id_nivel?.nivel) {
            programs.add(record.programa_ayo_id.id_nivel.nivel);
        }
        if (record.criterio_evaluacion_estudiante_id?.nombre) {
            criteria.add(record.criterio_evaluacion_estudiante_id.nombre);
        }
    });

    this.uniquePrograms = Array.from(programs).sort();
    this.uniqueCriteria = Array.from(criteria).sort();
  }



  processDetailData() {
    if (!this.selectedStudent) return;
    if (this.attendanceRecords.length === 0) {
      this.selectedStudent.averageRating = 0;
      this.selectedStudent.totalEvaluations = 0;
      this.selectedStudent.lastEvaluationDate = '';
      return;
    }

    // Calculate stats from attendance records
    const totalRecords = this.attendanceRecords.length;
    let totalScore = 0;
    let validScores = 0;
    let lastDate = '';

    this.attendanceRecords.forEach(record => {
      // Assuming 'calificacion' is the score field
      if (record.calificacion !== null && record.calificacion !== undefined) {
        totalScore += Number(record.calificacion);
        validScores++;
      }

      // Determine the latest date
      if (!lastDate || (record.fecha && new Date(record.fecha) > new Date(lastDate))) {
        lastDate = record.fecha;
      }
    });

    this.selectedStudent.averageRating = validScores > 0 ? totalScore / validScores : 0;
    this.selectedStudent.totalEvaluations = totalRecords; // Or total attendances
    this.selectedStudent.lastEvaluationDate = lastDate;
  }

  // ---- Agregar Calificación (evaluación individual, misma mecánica de meet-teacher) ----

  openAddRatingModal(): void {
    if (!this.selectedStudent || this.isCheckingCredits) return;

    // Validar que el estudiante tenga al menos un crédito disponible y un nivel asignado,
    // y traer toda la información necesaria para replicar la lógica de calificación docente
    this.isCheckingCredits = true;
    this.userService.getUserById(
      this.selectedStudent.studentId,
      'id,creditos,nivel_id,tipo_documento,numero_documento,email_acudiente,asistencia_id.*,programa_ayo_id.*,programa_ayo_id.id_nivel.*'
    ).subscribe({
      next: (userRes: any) => {
        this.isCheckingCredits = false;
        const data = userRes?.data || {};
        this.studentCredits = Number(data?.creditos) || 0;

        if (this.studentCredits <= 0) {
          this.notificationService.showWarning(
            'Sin Créditos Disponibles',
            'El estudiante no tiene créditos disponibles para poder calificarlo.'
          );
          this.cdr.detectChanges();
          return;
        }

        const nivelId = data?.nivel_id;
        const hasNivel = typeof nivelId === 'object' ? !!nivelId?.id : !!nivelId;
        if (!hasNivel) {
          this.notificationService.showWarning(
            'Sin Curso Asignado',
            'El estudiante debe estar asignado a un curso AYO para poder ser calificado.'
          );
          this.cdr.detectChanges();
          return;
        }

        this.studentLevelId = typeof nivelId === 'object' ? String(nivelId.id) : String(nivelId);

        const programa = data?.programa_ayo_id;
        const hasPrograma = typeof programa === 'object' ? !!programa?.id : !!programa;
        if (!hasPrograma) {
          this.notificationService.showWarning(
            'Sin Programa Asignado',
            'No está asignado a un Programa AYO para poder calificarlo.'
          );
          this.cdr.detectChanges();
          return;
        }

        this.studentProgram = programa && typeof programa === 'object' ? programa : null;
        const programId = this.studentProgram?.id || (typeof programa === 'string' ? programa : '');

        this.studentTipoDocumento = data?.tipo_documento;
        this.studentNumeroDocumento = data?.numero_documento;
        this.studentEmailAcudiente = data?.email_acudiente;
        this.studentAsistencias = Array.isArray(data?.asistencia_id) ? data.asistencia_id : [];

        this.newRating = {
          attended: true,
          rating: 0,
          comment: '',
          selectedCriteriaId: undefined,
          programId: programId ? String(programId) : ''
        };

        if (this.evaluationCriteria.length === 0) {
          this.loadEvaluationCriteria();
        }
        this.showAddRatingModal = true;
        document.body.style.overflow = 'hidden';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isCheckingCredits = false;
        console.error('Error checking student credits', err);
        this.notificationService.showError(
          'Error',
          'No se pudieron consultar los créditos del estudiante. Intente nuevamente.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  closeAddRatingModal(): void {
    this.showAddRatingModal = false;
    document.body.style.overflow = '';
    this.cdr.detectChanges();
  }

  loadEvaluationCriteria(): void {
    this.programaAyoService.getCriteriosEvaluacionEstudiante().subscribe({
      next: (response) => {
        if (response.data) {
          this.evaluationCriteria = response.data;
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        console.error('Error loading evaluation criteria:', error);
      }
    });
  }

  getProgramLabel(program: any): string {
    const idioma = program?.idioma ? `${program.idioma} - ` : '';
    const nivel = program?.id_nivel?.nivel || 'Programa';
    return `${idioma}${nivel}`;
  }

  setNewRating(rating: number): void {
    if (this.newRating.rating !== rating) {
      this.newRating.selectedCriteriaId = undefined;
    }
    this.newRating.rating = rating;
    this.cdr.detectChanges();
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

  /**
   * Réplica de TeacherMeetingsComponent.calculateProjectedAttendance para un solo estudiante:
   * calcula el % de asistencia proyectado dentro del programa asignado, incluyendo el registro actual.
   */
  private calculateProjectedAttendance(): number {
    const records = this.studentAsistencias || [];
    const programId = this.newRating.programId;

    if (!programId) {
      return this.newRating.attended ? 100 : 0;
    }

    const relevantRecords = records.filter((record: any) => {
      if (!record || typeof record !== 'object') return false;
      const rid = record.programa_ayo_id;
      const recProgramId = typeof rid === 'object' ? (rid && rid.id ? rid.id : rid) : rid;
      return String(recProgramId || '') === String(programId);
    });

    const pastTotal = relevantRecords.length;
    const pastAttended = relevantRecords.filter((record: any) => record.asiste === true).length;
    const currentAttended = this.newRating.attended ? 1 : 0;

    const finalTotal = pastTotal + 1;
    const finalAttended = pastAttended + currentAttended;

    return Math.round((finalAttended / finalTotal) * 100);
  }

  submitNewRating(): void {
    if (!this.selectedStudent) return;

    if (this.studentCredits <= 0) {
      this.notificationService.showWarning(
        'Sin Créditos Disponibles',
        'El estudiante no tiene créditos disponibles para poder calificarlo.'
      );
      return;
    }

    if (!this.newRating.programId) {
      this.notificationService.showWarning(
        'Sin Programa Asignado',
        'No está asignado a un Programa AYO para poder calificarlo.'
      );
      return;
    }

    if (this.newRating.attended && this.newRating.rating === 0) {
      this.notificationService.showWarning(
        'Calificación Incompleta',
        'Por favor califica al estudiante.'
      );
      return;
    }

    if (this.newRating.attended && this.newRating.rating > 0 && !this.newRating.selectedCriteriaId) {
      this.notificationService.showWarning(
        'Criterio Incompleto',
        'Por favor selecciona un criterio para la calificación.'
      );
      return;
    }

    this.isSavingRating = true;
    this.processStudentEvaluation();
  }

  /**
   * Réplica de TeacherMeetingsComponent.processBatchAttendanceAndUpdates, adaptada a un solo estudiante:
   * crea el registro de asistencia, descuenta el crédito, evalúa aprobación al llegar a 0 créditos
   * (emite certificado si aplica y libera el programa), y dispara los mismos efectos secundarios
   * (cuenta por cobrar, notificación a acudientes, marca estudiante_ayo).
   */
  private processStudentEvaluation(): void {
    const student = this.selectedStudent!;
    const studentId = student.studentId;

    const attendanceData: any = {
      calificacion: this.newRating.attended ? this.newRating.rating : 0,
      estudiante_id: studentId,
      programa_ayo_id: this.newRating.programId || null,
      asiste: this.newRating.attended,
      observaciones: this.newRating.comment,
      fecha: new Date().toISOString().split('T')[0],
      criterio_evaluacion_estudiante_id: this.newRating.attended ? this.newRating.selectedCriteriaId : null
    };

    const currentCredits = Number(this.studentCredits) || 0;
    const newCredits = currentCredits > 0 ? currentCredits - 1 : 0;

    const willReachZeroCredits = newCredits === 0 && !!this.studentTipoDocumento && !!this.studentNumeroDocumento;
    const willReachFourCredits = newCredits === 4 && !!this.studentEmailAcudiente;
    const canMarkEstudianteAyo = !!this.studentTipoDocumento && !!this.studentNumeroDocumento;

    const updateData: any = {
      creditos: newCredits
    };

    let willCreateCertificate = false;

    if (newCredits === 0) {
      const finalAttendancePercent = this.calculateProjectedAttendance();
      const programId = String(this.newRating.programId || '');
      const pastRatingSum = this.studentAsistencias.reduce((sum: number, record: any) => {
        if (!record || typeof record !== 'object') return sum;
        const rid = record.programa_ayo_id;
        const recProgramId = typeof rid === 'object' ? (rid && rid.id ? rid.id : rid) : rid;
        if (String(recProgramId || '') !== programId) return sum;
        if (record.asiste !== true) return sum;
        const val = Number(record.calificacion);
        return Number.isFinite(val) ? sum + val : sum;
      }, 0);
      const currentMeetingRating = this.newRating.attended ? (Number(this.newRating.rating) || 0) : 0;
      const projectedRatingSum = pastRatingSum + currentMeetingRating;

      const passed = finalAttendancePercent >= 70 && projectedRatingSum >= 80;
      updateData.aprobo_ayo = passed;
      updateData.programa_ayo_id = null;

      if (passed && this.studentLevelId) {
        willCreateCertificate = true;
      }
    }

    const requests: Observable<any>[] = [
      this.attendanceService.createAttendance(attendanceData),
      this.userService.updateUser(studentId, updateData)
    ];

    if (willCreateCertificate) {
      requests.push(this.certificacionService.createCertificado({
        estudiante_id: studentId,
        nivel_id: this.studentLevelId
      }));
    }

    forkJoin(requests).subscribe({
      next: () => {
        if (willReachZeroCredits) {
          this.accountReceivableService.newAccountAyo(
            [this.studentTipoDocumento!],
            [this.studentNumeroDocumento!]
          ).subscribe({
            next: () => console.log('Student sent to new account service'),
            error: (e) => console.error('Error sending student to new account service', e)
          });
        }

        if (canMarkEstudianteAyo) {
          this.studentService.searchStudentByDocument(this.studentTipoDocumento!, this.studentNumeroDocumento!).subscribe({
            next: (res) => {
              if (res.data && res.data.length > 0) {
                const foundStudentId = res.data[0].id;
                if (foundStudentId) {
                  this.studentService.updateStudent(foundStudentId, { estudiante_ayo: true } as any).subscribe({
                    next: () => console.log(`Updated estudiante_ayo for student ${this.studentNumeroDocumento}`),
                    error: (e) => console.error(`Error updating estudiante_ayo for student ${this.studentNumeroDocumento}`, e)
                  });
                }
              }
            },
            error: (e) => console.error(`Error searching student ${this.studentNumeroDocumento}`, e)
          });
        }

        if (willReachFourCredits) {
          this.programaAyoService.notifyAcudientesFlow([this.studentEmailAcudiente!]).subscribe({
            next: () => console.log('Notify Acudientes Flow triggered successfully'),
            error: (e) => console.error('Error triggering Notify Acudientes Flow', e)
          });
        }

        this.isSavingRating = false;
        this.closeAddRatingModal();
        this.notificationService.showSuccess(
          'Calificación Guardada',
          'La asistencia y calificación se registraron exitosamente.'
        );
        // Refrescar historial y opciones de filtros
        this.uniquePrograms = [];
        this.uniqueCriteria = [];
        if (this.selectedStudent) {
          this.loadAttendance(this.selectedStudent.studentId);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error creating attendance record', err);
        this.isSavingRating = false;
        this.notificationService.showError(
          'Error',
          'No se pudo guardar la calificación. Intente nuevamente.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  deleteAttendanceRecord(record: any): void {
    if (!this.selectedStudent || !record?.id) return;

    this.confirmationService.showConfirmation(
      {
        title: 'Eliminar calificación',
        message: '¿Estás seguro de que deseas eliminar esta calificación?',
        confirmText: 'Sí, eliminar',
        cancelText: 'Cancelar',
        type: 'danger'
      },
      () => this.executeDeleteAttendanceRecord(record)
    );
  }

  private executeDeleteAttendanceRecord(record: any): void {
    if (!this.selectedStudent || !record?.id) return;

    const attendanceId = String(record.id);
    const studentId = this.selectedStudent.studentId;
    const decrement = Number(record.calificacion);
    const delta = Number.isFinite(decrement) ? decrement : 0;

    this.deletingAttendanceId = attendanceId;

    this.userService.getUserById(studentId, 'id,calificacion').pipe(
      switchMap((userRes: any) => {
        const prevCalificacion = Number(userRes?.data?.calificacion) || 0;
        const nextCalificacion = Math.max(0, prevCalificacion - delta);

        const update$ = delta > 0
          ? this.userService.updateUser(studentId, { calificacion: nextCalificacion } as any)
          : of(null);

        return update$.pipe(
          switchMap(() => this.attendanceService.deleteAttendance(attendanceId)),
          catchError((err) => {
            if (delta > 0) {
              this.userService.updateUser(studentId, { calificacion: prevCalificacion } as any).subscribe();
            }
            return throwError(() => err);
          })
        );
      }),
      finalize(() => {
        this.deletingAttendanceId = null;
        this.appRef.tick();
      })
    ).subscribe({
      next: () => {
        this.attendanceRecords = this.attendanceRecords.filter(r => String(r.id) !== attendanceId);
        if (this.attendanceRecords.length === 0) {
          this.uniquePrograms = [];
          this.uniqueCriteria = [];
        }
        this.processDetailData();
        this.extractFilterOptions();
        this.cdr.detectChanges();
        this.appRef.tick();
      },
      error: (err) => {
        console.error('Error deleting attendance record', err);
      }
    });
  }

  goBack() {
    if (this.state === 'detail') {
        this.state = 'list';
        this.selectedStudent = null;
        this.attendanceRecords = [];
    } else {
        this.router.navigate(['/private/ayo']);
    }
  }
}
